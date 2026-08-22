/**
 * Writes controller values into ioBroker states: sysinfo states, the advanced
 * dosage/electrolysis flags, per-object data states, relay auto/on-off states,
 * and object-name updates. The "when to publish" decisions (change detection,
 * force-update) stay in the adapter's poll callback; this collaborator owns the
 * "how to write" I/O, injected via {@link StatePublisherDeps} for testability.
 * Writes go through `setStateChanged`, so unchanged values emit no state events.
 */

import {
    GetStateCategory,
    type GetStateDataObject,
    type GetStateDataSysInfo,
    type RelayDataInterpreter,
} from 'procon-ip';
import { buildId } from './mapping';

/** Data-object fields that are published as states, in the original order. */
const PUBLISHED_FIELDS = ['value', 'category', 'label', 'unit', 'displayValue', 'active'];

/** Collaborators the publisher needs from its host adapter, injected for testability. */
export interface StatePublisherDeps {
    /** Logger for debug/error output. */
    log: { debug(message: string): void; error(message: string): void };
    /** The adapter namespace, e.g. `procon-ip.0`. */
    namespace: string;
    /**
     * Write a state value only if it changed (adapter `setStateChanged`) —
     * keeps the poll loop from emitting redundant state events every cycle.
     */
    setStateChanged(id: string, value: ioBroker.StateValue, ack: boolean): Promise<unknown>;
    /** Resolve an ioBroker object by full id (adapter `getObjectAsync`). */
    getObject(id: string): Promise<ioBroker.Object | null | undefined>;
    /** Overwrite an ioBroker object (adapter `setObject`). */
    setObject(id: string, obj: ioBroker.SettableObject): Promise<unknown>;
    /** List the state objects under a channel (adapter `getStatesOfAsync`). */
    getStatesOf(id: string): Promise<ioBroker.StateObject[] | undefined>;
    /** Interprets relay auto/on state from a data object. */
    relayDataInterpreter: RelayDataInterpreter;
    /** Whether external relays are enabled on the controller. */
    isExtRelaysEnabled(): boolean;
}

/**
 * Publishes controller values to ioBroker states. Behaviour is identical to the
 * previous inline `main.ts` publishing methods.
 */
export class StatePublisher {
    private readonly deps: StatePublisherDeps;

    /**
     * @param deps injected adapter collaborators.
     */
    public constructor(deps: StatePublisherDeps) {
        this.deps = deps;
    }

    private id(...parts: (string | number)[]): string {
        return buildId(this.deps.namespace, ...parts);
    }

    private isRelayToPublish(obj: GetStateDataObject): boolean {
        return (
            (obj.category as GetStateCategory) === GetStateCategory.RELAYS ||
            ((obj.category as GetStateCategory) === GetStateCategory.EXTERNAL_RELAYS && this.deps.isExtRelaysEnabled())
        );
    }

    /**
     * Publish a single raw sysinfo state (`info.system.<key>`).
     *
     * @param key the sysinfo key.
     * @param value the sysinfo value (stringified for the state).
     */
    public publishSysInfoState(key: string, value: number | string): void {
        this.deps.log.debug(`Updating sys info state ${key}: ${value}`);
        this.deps.setStateChanged(this.id('info', 'system', key), String(value), true).catch(e => {
            this.deps.log.error(`Failed setting state for '${key}': ${e}`);
        });
    }

    /**
     * Publish the derived dosage-enabled / electrolysis flags — but only when
     * bootstrapping or when the controller's dosage-control byte changed.
     *
     * @param sysInfo the current sysinfo snapshot.
     * @param opts change-detection context.
     * @param opts.bootstrapped whether the first publish pass has completed.
     * @param opts.previousDosageControl the dosage-control byte from the last snapshot.
     */
    public publishAdvancedSysInfo(
        sysInfo: GetStateDataSysInfo,
        opts: { bootstrapped: boolean; previousDosageControl: number },
    ): void {
        if (opts.bootstrapped && sysInfo.dosageControl === opts.previousDosageControl) {
            return;
        }
        this.deps.log.debug('Updating advanced sys info states');
        const flags: [string, boolean][] = [
            ['phPlusDosageEnabled', sysInfo.isPhPlusDosageEnabled()],
            ['phMinusDosageEnabled', sysInfo.isPhMinusDosageEnabled()],
            ['chlorineDosageEnabled', sysInfo.isChlorineDosageEnabled()],
            ['electrolysis', sysInfo.isElectrolysis()],
        ];
        for (const [key, value] of flags) {
            this.deps.setStateChanged(this.id('info', 'system', key), value, true).catch(e => {
                this.deps.log.error(`Failed setting state for '${this.id('info', 'system', key)}': ${e}`);
            });
        }
    }

    /**
     * Publish a data object's field states (and, for relays, its switch states).
     *
     * @param obj the controller data object.
     */
    public publishDataState(obj: GetStateDataObject): void {
        for (const field of Object.keys(obj).filter(f => PUBLISHED_FIELDS.indexOf(f) > -1)) {
            this.deps
                .setStateChanged(this.id(obj.category, obj.categoryId, field), obj[field] as ioBroker.StateValue, true)
                .catch(e => {
                    this.deps.log.error(`Failed setting state for '${obj.label}': ${e}`);
                });
        }
        if (this.isRelayToPublish(obj)) {
            this.publishRelayState(obj);
        }
    }

    /**
     * Publish a relay's `.auto` and `.onOff` switch states.
     *
     * @param obj the relay data object.
     */
    public publishRelayState(obj: GetStateDataObject): void {
        this.deps
            .setStateChanged(
                this.id(obj.category, obj.categoryId, 'auto'),
                this.deps.relayDataInterpreter.isAuto(obj),
                true,
            )
            .catch(e => {
                this.deps.log.error(`Failed setting auto/manual switch state for '${obj.label}': ${e}`);
            });
        this.deps
            .setStateChanged(
                this.id(obj.category, obj.categoryId, 'onOff'),
                this.deps.relayDataInterpreter.isOn(obj),
                true,
            )
            .catch(e => {
                this.deps.log.error(`Failed setting onOff switch state for '${obj.label}': ${e}`);
            });
    }

    /**
     * Sync an object's (and its states') `common.name` to the controller label.
     *
     * @param obj the controller data object whose label changed.
     */
    public async updateObjectCommonName(obj: GetStateDataObject): Promise<void> {
        const objId = this.id(obj.category, obj.categoryId);
        const ioObj = await this.deps.getObject(objId);
        if (ioObj) {
            ioObj.common.name = obj.label;
            await this.deps.setObject(objId, ioObj);
        }
        const objStates = await this.deps.getStatesOf(objId);
        if (objStates) {
            for (const state of objStates) {
                state.common.name = obj.label;
                await this.deps.setObject(state._id, state);
            }
        }
    }
}
