/**
 * Handles user-driven state changes (relay auto/on-off, dosage timer, relay
 * timer) by translating them into procon-ip service calls.
 *
 * All adapter/runtime dependencies are injected via {@link CommandHandlerDeps},
 * so the routing and the per-command logic are unit-testable with plain stubs —
 * no live ioBroker Adapter and no network. `src/main.ts` constructs one of these
 * in `onReady` and forwards `onStateChange` to {@link CommandHandler.dispatch}.
 */

import type { CommandService, GetStateData, GetStateDataObject, SetStateService, UsrcfgCgiService } from 'procon-ip';
import { classifyCommand, errorMessage, relayControlId, relayTimerId } from './mapping';

/** Minimal logger surface the command handler needs (subset of ioBroker.Logger). */
export interface CommandLogger {
    /** Log an informational message. */
    info(message: string): void;
    /** Log an error message. */
    error(message: string): void;
}

/**
 * Everything the command handler needs from its host adapter, injected so the
 * handler can be exercised without a live adapter or controller.
 */
export interface CommandHandlerDeps {
    /** Logger for info/error output. */
    log: CommandLogger;
    /** Resolve an ioBroker object by full id (adapter `getObjectAsync`). */
    getObject(id: string): Promise<ioBroker.Object | null | undefined>;
    /** Resolve an ioBroker state by full id (adapter `getStateAsync`). */
    getState(id: string): Promise<ioBroker.State | null | undefined>;
    /** The current controller snapshot — re-read on each call (it is swapped every poll). */
    getStateData(): GetStateData;
    /** Mark a controller data-object id for a forced re-publish on the next poll. */
    markForceUpdate(dataObjectId: number): void;
    /** Service issuing relay on/off/auto writes to `/usrcfg.cgi`. */
    usrcfgCgiService: UsrcfgCgiService;
    /** Service issuing chlorine/pH dosage commands. */
    commandService: CommandService;
    /** Service issuing relay timer writes. */
    setStateService: SetStateService;
    /**
     * Acknowledge the command state with the requested value right after a
     * successful controller write, so the UI reflects the command immediately
     * instead of waiting for the next poll.
     */
    ackCommand(id: string, value: ioBroker.StateValue): void;
}

/**
 * Routes and executes the four writable relay command channels. Behaviour is
 * identical to the previous inline `main.ts` handlers.
 */
export class CommandHandler {
    private readonly deps: CommandHandlerDeps;

    /**
     * @param deps injected adapter/runtime collaborators.
     */
    public constructor(deps: CommandHandlerDeps) {
        this.deps = deps;
    }

    /**
     * Route a changed state to the matching command handler by its id suffix.
     * Non-command ids are ignored. Handler rejections are logged, never thrown.
     *
     * @param id the full id of the changed state.
     * @param state the new (unacknowledged) state.
     */
    public dispatch(id: string, state: ioBroker.State): void {
        switch (classifyCommand(id)) {
            case 'auto':
                this.relayToggleAuto(id, state).catch(e => this.deps.log.error(`Error on relay toggle (${id}): ${e}`));
                break;
            case 'onOff':
                this.relayToggleOnOff(id, state).catch(e => this.deps.log.error(`Error on relay toggle (${id}): ${e}`));
                break;
            case 'dosageTimer':
                this.setDosageTimer(id, state).catch(e => this.deps.log.error(`Error on manual dosage (${id}): ${e}`));
                break;
            case 'timer':
                this.setRelayTimer(id, state).catch(e => this.deps.log.error(`Error on relay timer (${id}): ${e}`));
                break;
        }
    }

    private async resolveObject(objectId: string): Promise<ioBroker.Object> {
        const obj = await this.deps.getObject(objectId);
        if (!obj) {
            throw new Error(`Cannot handle state change for non-existent object '${objectId}'`);
        }
        return obj;
    }

    /**
     * Toggle a relay to auto (when the incoming value is truthy) or to its
     * current on/off state otherwise.
     *
     * @param objectId the `.auto` state id.
     * @param state the new state.
     */
    public async relayToggleAuto(objectId: string, state: ioBroker.State): Promise<void> {
        const onOffState = await this.deps.getState(objectId.replace(/\.auto$/, '.onOff'));
        if (!onOffState) {
            throw new Error(`Cannot get onOff state to toggle '${objectId}'`);
        }

        const obj = await this.resolveObject(objectId);
        const dataObject: GetStateDataObject = this.deps.getStateData().getDataObject(Number(obj.native.id));
        this.deps.markForceUpdate(dataObject.id);
        try {
            if (state.val) {
                this.deps.log.info(`Switching ${obj.native.label}: auto`);
                await this.deps.usrcfgCgiService.setAuto(dataObject);
            } else if (onOffState.val) {
                this.deps.log.info(`Switching ${obj.native.label}: on`);
                await this.deps.usrcfgCgiService.setOn(dataObject);
            } else {
                this.deps.log.info(`Switching ${obj.native.label}: off`);
                await this.deps.usrcfgCgiService.setOff(dataObject);
            }
            this.deps.ackCommand(objectId, state.val);
        } catch (e: unknown) {
            this.deps.log.error(`Error on switching operation: ${errorMessage(e)}`);
        }
    }

    /**
     * Switch a relay on or off according to the incoming boolean value.
     *
     * @param objectId the `.onOff` state id.
     * @param state the new state.
     */
    public async relayToggleOnOff(objectId: string, state: ioBroker.State): Promise<void> {
        const obj = await this.resolveObject(objectId);
        const dataObject: GetStateDataObject = this.deps.getStateData().getDataObject(Number(obj.native.id));
        this.deps.markForceUpdate(dataObject.id);
        try {
            if (state.val) {
                this.deps.log.info(`Switching ${obj.native.label}: on`);
                await this.deps.usrcfgCgiService.setOn(dataObject);
            } else {
                this.deps.log.info(`Switching ${obj.native.label}: off`);
                await this.deps.usrcfgCgiService.setOff(dataObject);
            }
            this.deps.ackCommand(objectId, state.val);
        } catch (e: unknown) {
            this.deps.log.error(`Error on switching operation: ${errorMessage(e)}`);
        }
    }

    /**
     * Start a manual dosage for the relay's dosage-control channel (chlorine,
     * pH-minus or pH-plus, selected by the relay's control id).
     *
     * @param objectId the `.dosageTimer` state id.
     * @param state the new state (dosage duration in seconds).
     */
    public async setDosageTimer(objectId: string, state: ioBroker.State): Promise<void> {
        const obj = await this.resolveObject(objectId);
        const dataObject: GetStateDataObject = this.deps.getStateData().getDataObject(Number(obj.native.id));
        const relayId = relayControlId(dataObject);
        this.deps.markForceUpdate(dataObject.id);
        try {
            const stateValNumber = state.val as number;
            const data = this.deps.getStateData();
            if (relayId === data.getChlorineDosageControlId()) {
                await this.deps.commandService.setChlorineDosage(stateValNumber);
            } else if (relayId === data.getPhMinusDosageControlId()) {
                await this.deps.commandService.setPhMinusDosage(stateValNumber);
            } else if (relayId === data.getPhPlusDosageControlId()) {
                await this.deps.commandService.setPhPlusDosage(stateValNumber);
            }
            this.deps.log.info(`Setting dosage timer ${obj.native.label} for ${state.val} seconds`);
            this.deps.ackCommand(objectId, state.val);
        } catch (e: unknown) {
            this.deps.log.error(`Error setting dosage timer: ${errorMessage(e)}`);
        }
    }

    /**
     * Set the run timer for a (non-dosage) relay.
     *
     * @param objectId the `.timer` state id.
     * @param state the new state (timer duration in seconds).
     */
    public async setRelayTimer(objectId: string, state: ioBroker.State): Promise<void> {
        const obj = await this.resolveObject(objectId);
        const dataObject: GetStateDataObject = this.deps.getStateData().getDataObject(Number(obj.native.id));
        const relayId = relayTimerId(dataObject);
        this.deps.markForceUpdate(dataObject.id);
        try {
            const stateValNumber = state.val as number;
            await this.deps.setStateService.setTimer(relayId, stateValNumber);
            this.deps.log.info(`Setting timer for ${obj.native.label} to ${state.val} seconds`);
            this.deps.ackCommand(objectId, state.val);
        } catch (e: unknown) {
            this.deps.log.error(`Error setting relay timer: ${errorMessage(e)}`);
        }
    }
}
