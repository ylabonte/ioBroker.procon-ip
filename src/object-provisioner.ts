/**
 * Creates the adapter's ioBroker objects (channels + states) for the controller's
 * sysinfo and data objects. Every object *shape* comes from the pure builders in
 * `./mapping`; this collaborator owns only the "create if absent" I/O, injected
 * via {@link ObjectProvisionerDeps} so it is testable with plain stubs. Part B
 * will swap the writer (`setObjectNotExists` → `extendObject`) here in one place.
 */

import { GetStateCategory, type GetStateDataObject, type GetStateDataSysInfo } from 'procon-ip';
import {
    booleanFlagStateCommon,
    buildId,
    dataFieldStateCommon,
    errorMessage,
    isLightLabel,
    relayAutoStateCommon,
    relayControlId,
    relayOnOffStateCommon,
    relayTimerStateCommon,
    sysInfoStateCommon,
} from './mapping';

/** Collaborators the provisioner needs from its host adapter, injected for testability. */
export interface ObjectProvisionerDeps {
    /** Logger for error output. */
    log: { error(message: string): void };
    /** The adapter namespace, e.g. `procon-ip.0`. */
    namespace: string;
    /** Create an object only if it does not yet exist (adapter `setObjectNotExists`). */
    setObjectNotExists(id: string, obj: ioBroker.SettableObject): Promise<unknown>;
    /** Whether the given relay control id is a dosage-control relay. */
    isDosageControl(relayId: number): boolean;
    /** Whether external relays are enabled on the controller. */
    isExtRelaysEnabled(): boolean;
}

/**
 * Provisions sysinfo and data-object channels/states. Behaviour is identical to
 * the previous inline `main.ts` provisioning methods.
 */
export class ObjectProvisioner {
    private readonly deps: ObjectProvisionerDeps;

    /**
     * @param deps injected adapter collaborators.
     */
    public constructor(deps: ObjectProvisionerDeps) {
        this.deps = deps;
    }

    private id(...parts: (string | number)[]): string {
        return buildId(this.deps.namespace, ...parts);
    }

    /**
     * Create the `info.system` channel, one state per raw sysinfo key, and the
     * derived boolean flag states (dosage-enabled flags + electrolysis).
     *
     * @param data the current sysinfo snapshot.
     */
    public async provisionSysInfo(data: GetStateDataSysInfo): Promise<void> {
        await this.deps.setObjectNotExists(this.id('info', 'system'), {
            type: 'channel',
            common: { name: 'SysInfo' },
            native: {},
        });
        for (const sysInfo of data.toArrayOfObjects()) {
            await this.deps.setObjectNotExists(this.id('info', 'system', sysInfo.key), {
                type: 'state',
                common: sysInfoStateCommon(sysInfo.key),
                native: {},
            });
        }
        await this.deps.setObjectNotExists(this.id('info', 'system', 'phPlusDosageEnabled'), {
            type: 'state',
            common: booleanFlagStateCommon('pH+ enabled'),
            native: {},
        });
        await this.deps.setObjectNotExists(this.id('info', 'system', 'phMinusDosageEnabled'), {
            type: 'state',
            common: booleanFlagStateCommon('pH- enabled'),
            native: {},
        });
        await this.deps.setObjectNotExists(this.id('info', 'system', 'chlorineDosageEnabled'), {
            type: 'state',
            common: booleanFlagStateCommon('CL enabled'),
            native: {},
        });
        await this.deps.setObjectNotExists(this.id('info', 'system', 'electrolysis'), {
            type: 'state',
            common: booleanFlagStateCommon('Electrolysis'),
            native: {},
        });
    }

    /**
     * Create a channel per category and the states for each data object.
     *
     * @param objects the controller data objects.
     */
    public async provisionStateData(objects: GetStateDataObject[]): Promise<void> {
        let lastObjCategory = '';
        for (const obj of objects) {
            if (lastObjCategory !== obj.category) {
                await this.deps.setObjectNotExists(this.id(obj.category), {
                    type: 'channel',
                    common: { name: obj.category },
                    native: {},
                });
                lastObjCategory = obj.category;
            }
            this.provisionDataObject(obj).catch(e =>
                this.deps.log.error(`Failed setting objects for '${obj.label}': ${e}`),
            );
        }
    }

    private async provisionDataObject(obj: GetStateDataObject): Promise<void> {
        await this.deps.setObjectNotExists(this.id(obj.category, obj.categoryId), {
            type: 'channel',
            common: { name: obj.label },
            native: {},
        });
        for (const field of Object.keys(obj)) {
            const common = dataFieldStateCommon(obj, field);
            if (!common) {
                continue;
            }
            try {
                await this.deps.setObjectNotExists(this.id(obj.category, obj.categoryId, field), {
                    type: 'state',
                    common,
                    native: obj,
                });
            } catch (e: unknown) {
                this.deps.log.error(`Failed setting object '${obj.label}': ${errorMessage(e)}`);
            }
        }

        if (
            (obj.category as GetStateCategory) === GetStateCategory.RELAYS ||
            ((obj.category as GetStateCategory) === GetStateCategory.EXTERNAL_RELAYS && this.deps.isExtRelaysEnabled())
        ) {
            await this.provisionRelayObject(obj);
        }
    }

    private async provisionRelayObject(obj: GetStateDataObject): Promise<void> {
        const isLight = isLightLabel(obj.label);
        const relayId = relayControlId(obj);
        const isDosageRelay = this.deps.isDosageControl(relayId);

        await this.deps.setObjectNotExists(this.id(obj.category, obj.categoryId, 'auto'), {
            type: 'state',
            common: relayAutoStateCommon(obj, isLight),
            native: obj,
        });
        await this.deps.setObjectNotExists(this.id(obj.category, obj.categoryId, 'onOff'), {
            type: 'state',
            common: relayOnOffStateCommon(obj, isLight, isDosageRelay),
            native: obj,
        });

        // Dosage relays get a `.dosageTimer`, the rest a `.timer`; both share one shape.
        const timerChannel = isDosageRelay ? 'dosageTimer' : 'timer';
        await this.deps.setObjectNotExists(this.id(obj.category, obj.categoryId, timerChannel), {
            type: 'state',
            common: relayTimerStateCommon(obj),
            native: obj,
        });
    }
}
