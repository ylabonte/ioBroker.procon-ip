import { Adapter, AdapterOptions } from '@iobroker/adapter-core';
import {
    IGetStateServiceConfig,
    CommandService,
    GetStateService,
    UsrcfgCgiService,
    RelayDataInterpreter,
    GetStateData,
    GetStateDataSysInfo,
    SetStateService,
    GetDmxService,
    DmxService,
} from 'procon-ip';
import {
    buildServiceConfig,
    dmxShouldBeActive,
    dmxStatusText,
    errorMessage,
    isValidURL,
    shouldUpdateState,
} from './mapping';
import { CommandHandler } from './command-handler';
import { ObjectProvisioner } from './object-provisioner';
import { StatePublisher } from './state-publisher';
import { DmxController } from './dmx-controller';

// Augment the adapter.config object with the actual types
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ioBroker {
        interface AdapterConfig {
            controllerUrl: string;
            basicAuth: boolean;
            username: string;
            password: string;
            updateInterval: number;
            requestTimeout: number;
            errorTolerance: number;
            dmxPolling: 'auto' | 'never';
        }
    }
}

/**
 * ProCon.IP pool-controller adapter: polls the controller's state into ioBroker
 * objects/states and relays user-driven relay, dosage and timer commands back to
 * the controller. Pure, adapter-independent decision logic lives in `./mapping`.
 */
export class ProconIp extends Adapter {
    private _relayDataInterpreter!: RelayDataInterpreter;
    private _getStateService!: GetStateService;
    private _setStateService!: SetStateService;
    private _usrcfgCgiService!: UsrcfgCgiService;
    private _commandService!: CommandService;
    private _commandHandler!: CommandHandler;
    private _objectProvisioner!: ObjectProvisioner;
    private _statePublisher!: StatePublisher;
    private _dmxController!: DmxController;
    private _forceUpdate: number[];
    private _stateData: GetStateData;
    private _bootstrapped = false;
    private _objectsCreated = false;
    /**
     * Tracks the controller's DMX-enabled state across polls so DMX channels are
     * provisioned/removed only on an actual on↔off transition. `null` until the
     * first successful poll has been reconciled.
     */
    private _dmxEnabled: boolean | null = null;
    /**
     * Timer for the offset DMX read. The DMX poll is deliberately scheduled at
     * the midpoint of the update interval so it does not fire back-to-back with
     * the GetState request — the controller's single-connection HTTP/1.0 firmware
     * resets a connection that arrives while it is still handling another.
     */
    private _dmxPollTimer?: ioBroker.Timeout;

    /**
     * @param options adapter options forwarded to the ioBroker `Adapter` base;
     *   the adapter name is always `procon-ip`.
     */
    public constructor(options: Partial<AdapterOptions> = {}) {
        super({
            ...options,
            name: 'procon-ip',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this._forceUpdate = new Array<number>();
        this._stateData = new GetStateData();
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        let connectionApproved = false;
        let connectErrorLogged = false;
        await this.setStateChangedAsync('info.connection', false, true);

        if (this.config.controllerUrl.length < 1 || !isValidURL(this.config.controllerUrl)) {
            this.log.warn(`Invalid controller URL ('${this.config.controllerUrl}') supplied.`);
            return;
        }

        // procon-ip 2.x reads `controllerUrl` (inherited from this.config) and
        // `timeout`; the old `baseUrl` input is no longer consumed (the service
        // derives its base URL from controllerUrl), so it is not set here.
        const serviceConfig = buildServiceConfig(this.config);
        this._relayDataInterpreter = new RelayDataInterpreter(this.log);
        this._getStateService = new GetStateService(serviceConfig as IGetStateServiceConfig, this.log);
        this._setStateService = new SetStateService(serviceConfig, this.log);
        this._usrcfgCgiService = new UsrcfgCgiService(
            serviceConfig,
            this.log,
            this._getStateService,
            this._relayDataInterpreter,
        );
        this._commandService = new CommandService(serviceConfig, this.log);
        this._commandHandler = new CommandHandler({
            log: this.log,
            getObject: id => this.getObjectAsync(id),
            getState: id => this.getStateAsync(id),
            getStateData: () => this._stateData,
            markForceUpdate: id => this._forceUpdate.push(id),
            usrcfgCgiService: this._usrcfgCgiService,
            commandService: this._commandService,
            setStateService: this._setStateService,
            ackCommand: (id, value) => {
                void this.setState(id, value, true).catch(() => {});
            },
        });
        this._objectProvisioner = new ObjectProvisioner({
            log: this.log,
            namespace: this.namespace,
            getObject: id => this.getObjectAsync(id),
            extendObject: (id, obj) => this.extendObjectAsync(id, obj),
            delObject: (id, options) => this.delObjectAsync(id, options),
            isDosageControl: relayId => this._getStateService.data.isDosageControl(relayId),
            isExtRelaysEnabled: () => this._stateData.sysInfo.isExtRelaysEnabled(),
        });
        this._statePublisher = new StatePublisher({
            log: this.log,
            namespace: this.namespace,
            setStateChanged: (id, value, ack) => this.setStateChangedAsync(id, value, ack),
            getObject: id => this.getObjectAsync(id),
            setObject: async (id, obj) => this.setObject(id, obj),
            getStatesOf: id => this.getStatesOfAsync(id),
            relayDataInterpreter: this._relayDataInterpreter,
            isExtRelaysEnabled: () => this._stateData.sysInfo.isExtRelaysEnabled(),
        });
        // The DMX controller is always constructed (cheap — it only polls/writes
        // when DMX is active). Whether DMX is actually exposed is decided at
        // runtime from the controller's own DMX flag; see syncDmx().
        this._dmxController = new DmxController({
            log: this.log,
            namespace: this.namespace,
            getDmxService: new GetDmxService(serviceConfig, this.log),
            dmxService: new DmxService(serviceConfig, this.log),
            setStateChanged: (id, value, ack) => this.setStateChangedAsync(id, value, ack),
            ackCommand: (id, value) => {
                void this.setState(id, value, true).catch(() => {});
            },
            now: () => Date.now(),
        });

        this.log.debug(`GetStateService url: ${this._getStateService.url}`);
        this.log.debug(`UsrcfgCgiService url: ${this._usrcfgCgiService.url}`);

        // Initial fetch + object bootstrap. If the controller is unreachable at
        // startup, do not abort: keep going and let the polling loop below retry
        // and bootstrap on the first successful poll (resilient startup).
        try {
            const initialData = await this._getStateService.update();
            this._stateData = initialData;
            await this.bootstrapObjects(initialData);
        } catch (e: unknown) {
            this.log.warn(
                `Could not reach the controller at startup (${
                    e instanceof Error ? e.message : String(e)
                }). Will keep polling until it becomes available.`,
            );
        }

        // Start the polling service directly. Objects were already bootstrapped
        // above (or will be on the first successful poll if the controller was
        // unreachable at startup), so there is nothing to defer.
        this._getStateService.start(
            async (data: GetStateData) => {
                this.log.silly(`Start processing new GetState.csv`);
                connectionApproved = true;
                connectErrorLogged = false;

                // Create objects on the first successful poll if startup couldn't
                await this.bootstrapObjects(data);

                // Set sys info states (only those whose value changed)
                data.sysInfo.toArrayOfObjects().forEach(info => {
                    if (!this._bootstrapped || info.value !== this._stateData.sysInfo[info.key]) {
                        this._statePublisher.publishSysInfoState(info.key, info.value);
                    }
                });

                this._statePublisher.publishAdvancedSysInfo(data.sysInfo, {
                    bootstrapped: this._bootstrapped,
                    previousDosageControl: this._stateData.sysInfo.dosageControl,
                });

                // Set actual sensor and actor/relay object states
                data.objects.forEach(obj => {
                    // `previous` is undefined until the first successful poll
                    // has populated `_stateData` (e.g. after a failed startup).
                    const previous = this._stateData.getDataObject(obj.id);
                    this.log.silly(`Processing '${obj.label}' (${obj.category}) — current value: ${obj.displayValue}`);

                    // Only update when value has changed or update is forced (on state change)
                    const forceObjStateUpdate = this._forceUpdate.indexOf(obj.id);
                    if (
                        shouldUpdateState({
                            bootstrapped: this._bootstrapped,
                            forced: forceObjStateUpdate >= 0,
                            hasPrevious: !!previous,
                            previousValue: previous?.value,
                            currentValue: obj.value,
                        })
                    ) {
                        if (previous && previous.label != obj.label) {
                            this.log.debug(`Updating label for '${obj.label}' (${obj.category})`);
                            this._statePublisher.updateObjectCommonName(obj).catch((e: unknown) => {
                                this.log.error(`Failed fixing label for '${obj.label}': ${errorMessage(e)}`);
                            });
                        }
                        this.log.debug(`Updating value for '${obj.label}' (${obj.category})`);
                        this._statePublisher.publishDataState(obj);
                        if (forceObjStateUpdate > -1) {
                            this._forceUpdate.splice(forceObjStateUpdate, 1);
                        }
                    }
                });

                this.log.silly(`Updating data object for next comparison`);
                this._stateData = data;
                this._bootstrapped = true;
                await this.syncDmx(data.sysInfo);
                this.setStateChangedAsync('info.connection', true, true).catch(() => {});
            },
            (e: unknown) => {
                this.setStateChangedAsync('info.connection', false, true).catch(() => {});
                // Keep the polling loop running so the adapter recovers on its
                // own once the controller becomes reachable again. Log the
                // "cannot connect yet" warning only once per outage.
                if (!connectionApproved && !connectErrorLogged) {
                    connectErrorLogged = true;
                    this.log.warn(
                        `Could not connect to the controller (${
                            e instanceof Error ? e.message : String(e)
                        }). Retrying until it becomes available.`,
                    );
                }
            },
        );

        // Subscribe only to the writable command channels, not every relay
        // state — so our own acknowledged value writes don't wake onStateChange.
        for (const category of ['relays', 'externalRelays']) {
            for (const suffix of ['onOff', 'auto', 'timer', 'dosageTimer']) {
                this.subscribeStates(`${category}.*.${suffix}`);
            }
        }
        // The `dmx.*` subscription is managed by syncDmx() — it is only active
        // while the controller reports DMX as enabled.
    }

    /**
     * Reconcile the exposed DMX channels with the effective DMX state — the
     * controller's live flag (`sysInfo.isDmxEnabled()`) unless the config's DMX
     * polling mode is `never` (a hard opt-out). Channels are provisioned and
     * subscribed the moment DMX becomes active, removed again when it goes off,
     * and while active the DMX read is scheduled at the *midpoint* of the poll
     * interval (see {@link scheduleDmxPoll}) rather than fired inline. Runs on
     * every successful poll; only the on↔off transition does provisioning work.
     * The first call also clears any stale DMX channels left from a previous run.
     *
     * @param sysInfo the current sysinfo snapshot from the latest poll.
     */
    private async syncDmx(sysInfo: GetStateDataSysInfo): Promise<void> {
        const enabled = dmxShouldBeActive(this.config.dmxPolling, sysInfo.isDmxEnabled());
        const previous = this._dmxEnabled;
        this._dmxEnabled = enabled;

        if (enabled === previous) {
            // Steady state: (re)schedule the offset DMX read while active, nothing while inactive.
            if (enabled) {
                this.scheduleDmxPoll();
            }
            return;
        }

        if (enabled) {
            this.log.info('DMX is enabled on the controller — activating dmx.CH01…CH16.');
            await this._objectProvisioner.provisionDmx();
            this.subscribeStates('dmx.*');
            await this._dmxController.poll(); // populate immediately on activation
        } else {
            this.clearDmxPoll();
            this.unsubscribeStates('dmx.*');
            await this._objectProvisioner.deprovisionDmx();
            if (previous) {
                // Only log a real transition, not the first-poll leftover sweep.
                this.log.info('DMX was disabled on the controller — removed the dmx channels.');
            }
        }
    }

    /**
     * Schedule the DMX read at the midpoint of the update interval, so it does
     * not collide with the GetState request on the controller's single-connection
     * HTTP/1.0 firmware. Replaces any pending timer; runs at most once per cycle.
     * Uses the adapter's managed timer so it is auto-cleared on unload.
     */
    private scheduleDmxPoll(): void {
        this.clearDmxPoll();
        const offset = Math.max(250, Math.floor(this.config.updateInterval / 2));
        this._dmxPollTimer = this.setTimeout(() => {
            this._dmxPollTimer = undefined;
            this._dmxController.poll().catch((e: unknown) => this.log.debug(`DMX poll error: ${errorMessage(e)}`));
        }, offset);
    }

    /** Cancel a pending offset DMX read (on deactivation and shutdown). */
    private clearDmxPoll(): void {
        if (this._dmxPollTimer) {
            this.clearTimeout(this._dmxPollTimer);
            this._dmxPollTimer = undefined;
        }
    }

    /**
     * Answer admin `sendTo` messages. Serves the live DMX status indicator
     * (`getDmxStatus`) with the effective state as `{ text, style }` for the
     * jsonConfig `textSendTo` traffic light.
     *
     * @param obj the incoming message.
     */
    private onMessage(obj: ioBroker.Message): void {
        if (obj.command === 'getDmxStatus') {
            const status = dmxStatusText(this.config.dmxPolling, this._stateData.sysInfo.isDmxEnabled());
            if (obj.callback) {
                this.sendTo(obj.from, obj.command, { text: status.text, style: { color: status.color } }, obj.callback);
            }
        }
    }

    /**
     * Create the adapter's objects. Runs once — either on startup or, if the
     * controller was unreachable then, on the first successful poll.
     *
     * @param data the current controller state used to derive the objects
     */
    private async bootstrapObjects(data: GetStateData): Promise<void> {
        if (this._objectsCreated) {
            return;
        }
        this.log.debug(`Initially setting adapter objects`);
        await this._objectProvisioner.provisionSysInfo(data.sysInfo);
        await this._objectProvisioner.provisionStateData(data.objects);
        // DMX objects are provisioned on demand by syncDmx() once the first poll
        // reveals whether the controller has DMX enabled.
        this._objectsCreated = true;
    }

    // Is called when adapter shuts down - callback has to be called under any circumstances!
    private onUnload(callback: () => void): void {
        try {
            // Stop the service loop (this also handles the info.connection state)
            this.clearDmxPoll();
            this._getStateService?.stop();
            this.setStateChangedAsync('info.connection', false, true).catch(() => {});
        } catch (e: unknown) {
            this.log.error(`Failed to stop GetState service: ${String(e)}`);
        } finally {
            callback();
        }
    }

    // Is called if a subscribed state changes
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (!state) {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
            return;
        }
        if (state.ack) {
            // The state is already acknowledged -> no need to change anything
            return;
        }

        if (this._dmxController.isDmxChannel(id)) {
            this._dmxController.handleWrite(id, state.val as number).catch(e => {
                this.log.error(`Error on DMX write (${id}): ${e}`);
            });
            return;
        }

        this._commandHandler.dispatch(id, state);
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<AdapterOptions> | undefined) => new ProconIp(options);
} else {
    // otherwise start the instance directly
    (() => new ProconIp())();
}
