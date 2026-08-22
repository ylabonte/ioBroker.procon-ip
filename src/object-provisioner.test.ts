/**
 * Unit tests for ObjectProvisioner. getObject / extendObject and the
 * controller-state predicates are injected as stubs — no live adapter.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { GetStateCategory, type GetStateDataObject, type GetStateDataSysInfo } from 'procon-ip';
import { ObjectProvisioner, type ObjectProvisionerDeps, OBJECT_SCHEMA_VERSION } from './object-provisioner';

interface HarnessResult {
    provisioner: ObjectProvisioner;
    extendObject: sinon.SinonStub;
    getObject: sinon.SinonStub;
    log: { error: sinon.SinonStub };
}

// Assemble an ObjectProvisioner. By default every object is missing (getObject
// resolves null), so everything is created; pass `existing` to simulate objects
// already in the DB (keyed by id) for the self-healing paths.
function harness(opts?: {
    isDosageControl?: (id: number) => boolean;
    isExtRelaysEnabled?: boolean;
    existing?: Record<string, ioBroker.Object>;
}): HarnessResult {
    const extendObject = sinon.stub().resolves();
    const getObject = sinon.stub().callsFake((id: string) => Promise.resolve(opts?.existing?.[id] ?? null));
    const log = { error: sinon.stub() };
    const deps: ObjectProvisionerDeps = {
        log,
        namespace: 'procon-ip.0',
        getObject,
        extendObject,
        isDosageControl: opts?.isDosageControl ?? (() => false),
        isExtRelaysEnabled: () => opts?.isExtRelaysEnabled ?? true,
    };
    return { provisioner: new ObjectProvisioner(deps), extendObject, getObject, log };
}

// The ids passed to extendObject.
function idsFrom(stub: sinon.SinonStub): string[] {
    return stub.getCalls().map(c => c.args[0] as string);
}

// The common written for a given id.
function commonFor(stub: sinon.SinonStub, id: string): Record<string, unknown> | undefined {
    const call = stub.getCalls().find(c => c.args[0] === id);
    return call ? ((call.args[1] as ioBroker.PartialObject).common as Record<string, unknown>) : undefined;
}

// A GetStateDataObject-shaped fixture.
function dataObj(o: Partial<GetStateDataObject>): GetStateDataObject {
    return {
        id: 0,
        category: 'relays',
        categoryId: 0,
        label: 'Relay',
        value: 1,
        unit: 'C',
        displayValue: '1',
        active: true,
        ...o,
    } as unknown as GetStateDataObject;
}

// Let the fire-and-forget provisionDataObject microtasks settle.
function settle(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
}

describe('ObjectProvisioner.provisionSysInfo', () => {
    it('creates the info.system channel, a state per key, and the four flags (with schema stamp)', async () => {
        const h = harness();
        const sysInfo = {
            toArrayOfObjects: () => [{ key: 'phValue', value: 7 }],
        } as unknown as GetStateDataSysInfo;
        await h.provisioner.provisionSysInfo(sysInfo);
        const ids = idsFrom(h.extendObject);
        for (const id of [
            'procon-ip.0.info.system',
            'procon-ip.0.info.system.phValue',
            'procon-ip.0.info.system.phPlusDosageEnabled',
            'procon-ip.0.info.system.electrolysis',
        ]) {
            expect(ids, id).to.include(id);
        }
        // schema version stamped into native
        const call = h.extendObject.getCalls().find(c => c.args[0] === 'procon-ip.0.info.system.phValue')!;
        expect((call.args[1] as ioBroker.PartialObject).native).to.deep.include({
            objectSchemaVersion: OBJECT_SCHEMA_VERSION,
        });
    });
});

describe('ObjectProvisioner self-healing (H1)', () => {
    const relayObj = dataObj({ category: 'relays', categoryId: 2, label: 'Pump', active: true });

    it('skips an object already at the current schema version', async () => {
        const id = 'procon-ip.0.relays.2.onOff';
        const h = harness({
            isDosageControl: () => false,
            existing: {
                [id]: {
                    _id: id,
                    type: 'state',
                    common: {},
                    native: { objectSchemaVersion: OBJECT_SCHEMA_VERSION },
                } as unknown as ioBroker.Object,
            },
        });
        await h.provisioner['provisionRelayObject'](relayObj);
        await settle();
        expect(idsFrom(h.extendObject)).to.not.include(id);
    });

    it('creates a missing object with the full common (name + smartName)', async () => {
        const h = harness({ isDosageControl: () => false });
        await h.provisioner['provisionRelayObject'](relayObj);
        await settle();
        const common = commonFor(h.extendObject, 'procon-ip.0.relays.2.onOff')!;
        expect(common.name).to.equal('Pump'); // full definition on create
        expect(common).to.have.property('smartName');
        expect(common.role).to.equal('switch');
    });

    it('heals an out-of-date object with structural fields only (preserving name/smartName)', async () => {
        const id = 'procon-ip.0.relays.2.onOff';
        const h = harness({
            isDosageControl: () => false,
            existing: {
                [id]: {
                    _id: id,
                    type: 'state',
                    common: { name: 'My Pump' },
                    native: {},
                } as unknown as ioBroker.Object, // no schema stamp
            },
        });
        await h.provisioner['provisionRelayObject'](relayObj);
        await settle();
        const common = commonFor(h.extendObject, id)!;
        expect(common.role).to.equal('switch'); // structural field healed
        expect(common).to.not.have.property('name'); // preserved
        expect(common).to.not.have.property('smartName'); // preserved
    });
});

describe('ObjectProvisioner relay objects', () => {
    it('creates auto/onOff and a .timer for a non-dosage relay', async () => {
        const h = harness({ isDosageControl: () => false });
        await h.provisioner.provisionStateData([dataObj({ category: 'relays', categoryId: 2, label: 'Pump' })]);
        await settle();
        const ids = idsFrom(h.extendObject);
        expect(ids).to.include('procon-ip.0.relays.2.auto');
        expect(ids).to.include('procon-ip.0.relays.2.onOff');
        expect(ids).to.include('procon-ip.0.relays.2.timer');
        expect(ids).to.not.include('procon-ip.0.relays.2.dosageTimer');
    });
    it('creates a .dosageTimer for a dosage relay (relayControlId 2)', async () => {
        const h = harness({ isDosageControl: id => id === 2 });
        await h.provisioner.provisionStateData([dataObj({ category: 'relays', categoryId: 2, label: 'Chlorine' })]);
        await settle();
        const ids = idsFrom(h.extendObject);
        expect(ids).to.include('procon-ip.0.relays.2.dosageTimer');
        expect(ids).to.not.include('procon-ip.0.relays.2.timer');
    });
    it('skips relay states for external relays when they are disabled', async () => {
        const h = harness({ isExtRelaysEnabled: false });
        await h.provisioner.provisionStateData([
            dataObj({ category: String(GetStateCategory.EXTERNAL_RELAYS), categoryId: 0, label: 'Ext' }),
        ]);
        await settle();
        expect(idsFrom(h.extendObject).some(i => i.endsWith('.auto'))).to.be.false;
    });
});

describe('ObjectProvisioner.provisionDmx', () => {
    it('creates the dmx channel and the 16 channel states (CH01..CH16)', async () => {
        const h = harness();
        await h.provisioner.provisionDmx();
        const ids = idsFrom(h.extendObject);
        expect(ids).to.include('procon-ip.0.dmx');
        expect(ids).to.include('procon-ip.0.dmx.CH01');
        expect(ids).to.include('procon-ip.0.dmx.CH16');
        expect(ids.filter(i => /\.dmx\.CH\d{2}$/.test(i))).to.have.lengthOf(16);
    });
});
