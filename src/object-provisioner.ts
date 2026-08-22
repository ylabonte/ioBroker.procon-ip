/**
 * Creates and *heals* the adapter's ioBroker objects (channels + states) for the
 * controller's sysinfo and data objects. Every object *shape* comes from the pure
 * builders in `./mapping`; this collaborator owns only the write I/O, injected via
 * {@link ObjectProvisionerDeps} so it is testable with plain stubs.
 *
 * Self-healing (H1): objects are written with `extendObject` and stamped with
 * `native.objectSchemaVersion`. An object whose stamp already matches
 * {@link OBJECT_SCHEMA_VERSION} is left untouched. A missing object is created
 * with its full definition; an out-of-date object is healed by extending only
 * the adapter-owned structural fields ({@link STRUCTURAL_COMMON_KEYS}) — the
 * user-facing `name` and `smartName` are deliberately preserved (the label is
 * synced separately, only on a real controller-label change).
 *
 * Bump {@link OBJECT_SCHEMA_VERSION} whenever the object definitions change so
 * existing installs re-heal exactly once.
 */

import { GetStateCategory, type GetStateDataObject, type GetStateDataSysInfo } from 'procon-ip';
import {
    booleanFlagStateCommon,
    buildId,
    dataFieldStateCommon,
    dmxChannelStateCommon,
    isLightLabel,
    relayAutoStateCommon,
    relayControlId,
    relayOnOffStateCommon,
    relayTimerStateCommon,
    sysInfoStateCommon,
} from './mapping';

/** Bump when the object definitions change, to trigger a one-time re-heal. */
export const OBJECT_SCHEMA_VERSION = 1;

/** Adapter-owned `common` fields that self-healing may overwrite on existing objects. */
const STRUCTURAL_COMMON_KEYS = ['type', 'role', 'read', 'write', 'unit'] as const;

// Keep only the structural (adapter-owned) keys of a `common`, preserving name/smartName.
function structuralCommon(common: ioBroker.StateCommon): Partial<ioBroker.StateCommon> {
    const source = common as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of STRUCTURAL_COMMON_KEYS) {
        if (key in source) {
            out[key] = source[key];
        }
    }
    return out;
}

/** A settable object definition (without the schema stamp, which is added here). */
interface ObjectDefinition {
    type: ioBroker.ObjectType;
    common: ioBroker.StateCommon | ioBroker.ChannelCommon;
    native: Record<string, unknown>;
}

/** Collaborators the provisioner needs from its host adapter, injected for testability. */
export interface ObjectProvisionerDeps {
    /** Logger for error output. */
    log: { error(message: string): void };
    /** The adapter namespace, e.g. `procon-ip.0`. */
    namespace: string;
    /** Read an existing object (adapter `getObjectAsync`) to check its schema stamp. */
    getObject(id: string): Promise<ioBroker.Object | null | undefined>;
    /** Create-or-merge an object (adapter `extendObject`). */
    extendObject(id: string, obj: ioBroker.PartialObject): Promise<unknown>;
    /** Whether the given relay control id is a dosage-control relay. */
    isDosageControl(relayId: number): boolean;
    /** Whether external relays are enabled on the controller. */
    isExtRelaysEnabled(): boolean;
}

/**
 * Provisions (and heals) sysinfo and data-object channels/states.
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
     * Write one object with self-healing semantics: skip if already at the
     * current schema version, create in full if missing, otherwise heal only
     * the structural fields. Always stamps the current schema version.
     *
     * @param id the full object id.
     * @param definition the object type, full `common`, and native payload.
     */
    private async provision(id: string, definition: ObjectDefinition): Promise<void> {
        const existing = await this.deps.getObject(id);
        if (existing && existing.native?.objectSchemaVersion === OBJECT_SCHEMA_VERSION) {
            return;
        }
        const common = existing ? structuralCommon(definition.common as ioBroker.StateCommon) : definition.common;
        const payload = {
            type: definition.type,
            common,
            native: { ...definition.native, objectSchemaVersion: OBJECT_SCHEMA_VERSION },
        } as unknown as ioBroker.PartialObject;
        await this.deps.extendObject(id, payload);
    }

    /**
     * Create/heal the `info.system` channel, one state per raw sysinfo key, and
     * the derived boolean flag states (dosage-enabled flags + electrolysis).
     *
     * @param data the current sysinfo snapshot.
     */
    public async provisionSysInfo(data: GetStateDataSysInfo): Promise<void> {
        await this.provision(this.id('info', 'system'), { type: 'channel', common: { name: 'SysInfo' }, native: {} });
        for (const sysInfo of data.toArrayOfObjects()) {
            await this.provision(this.id('info', 'system', sysInfo.key), {
                type: 'state',
                common: sysInfoStateCommon(sysInfo.key),
                native: {},
            });
        }
        await this.provision(this.id('info', 'system', 'phPlusDosageEnabled'), {
            type: 'state',
            common: booleanFlagStateCommon('pH+ enabled'),
            native: {},
        });
        await this.provision(this.id('info', 'system', 'phMinusDosageEnabled'), {
            type: 'state',
            common: booleanFlagStateCommon('pH- enabled'),
            native: {},
        });
        await this.provision(this.id('info', 'system', 'chlorineDosageEnabled'), {
            type: 'state',
            common: booleanFlagStateCommon('CL enabled'),
            native: {},
        });
        await this.provision(this.id('info', 'system', 'electrolysis'), {
            type: 'state',
            common: booleanFlagStateCommon('Electrolysis'),
            native: {},
        });
    }

    /**
     * Create/heal the `dmx` channel and its 16 writable channel states
     * (`dmx.CH01` … `dmx.CH16`). Only called when DMX is enabled in the config.
     */
    public async provisionDmx(): Promise<void> {
        await this.provision(this.id('dmx'), { type: 'channel', common: { name: 'DMX512' }, native: {} });
        for (let i = 0; i < 16; i++) {
            const name = `CH${String(i + 1).padStart(2, '0')}`;
            await this.provision(this.id('dmx', name), {
                type: 'state',
                common: dmxChannelStateCommon(name),
                native: { dmxChannelIndex: i },
            });
        }
    }

    /**
     * Create/heal a channel per category and the states for each data object.
     *
     * @param objects the controller data objects.
     */
    public async provisionStateData(objects: GetStateDataObject[]): Promise<void> {
        let lastObjCategory = '';
        for (const obj of objects) {
            if (lastObjCategory !== obj.category) {
                await this.provision(this.id(obj.category), {
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
        await this.provision(this.id(obj.category, obj.categoryId), {
            type: 'channel',
            common: { name: obj.label },
            native: {},
        });
        for (const field of Object.keys(obj)) {
            const common = dataFieldStateCommon(obj, field);
            if (!common) {
                continue;
            }
            await this.provision(this.id(obj.category, obj.categoryId, field), {
                type: 'state',
                common,
                native: obj,
            });
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
        const native = obj as unknown as Record<string, unknown>;

        await this.provision(this.id(obj.category, obj.categoryId, 'auto'), {
            type: 'state',
            common: relayAutoStateCommon(obj, isLight),
            native,
        });
        await this.provision(this.id(obj.category, obj.categoryId, 'onOff'), {
            type: 'state',
            common: relayOnOffStateCommon(obj, isLight, isDosageRelay),
            native,
        });

        // Dosage relays get a `.dosageTimer`, the rest a `.timer`; both share one shape.
        const timerChannel = isDosageRelay ? 'dosageTimer' : 'timer';
        await this.provision(this.id(obj.category, obj.categoryId, timerChannel), {
            type: 'state',
            common: relayTimerStateCommon(obj),
            native,
        });
    }
}
