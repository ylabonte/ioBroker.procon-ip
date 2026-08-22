/**
 * Unit tests for ObjectProvisioner. setObjectNotExists and the controller-state
 * predicates are injected as stubs — no live adapter, no controller.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { GetStateCategory, type GetStateDataObject, type GetStateDataSysInfo } from 'procon-ip';
import { ObjectProvisioner, type ObjectProvisionerDeps } from './object-provisioner';

// Assemble an ObjectProvisioner with a stubbed setObjectNotExists.
function harness(opts?: { isDosageControl?: (id: number) => boolean; isExtRelaysEnabled?: boolean }): {
    provisioner: ObjectProvisioner;
    setObjectNotExists: sinon.SinonStub;
    log: { error: sinon.SinonStub };
} {
    const setObjectNotExists = sinon.stub().resolves({ id: 'x' });
    const log = { error: sinon.stub() };
    const deps: ObjectProvisionerDeps = {
        log,
        namespace: 'procon-ip.0',
        setObjectNotExists,
        isDosageControl: opts?.isDosageControl ?? (() => false),
        isExtRelaysEnabled: () => opts?.isExtRelaysEnabled ?? true,
    };
    return { provisioner: new ObjectProvisioner(deps), setObjectNotExists, log };
}

// The first argument (the id) of every setObjectNotExists call.
function idsFrom(stub: sinon.SinonStub): string[] {
    return stub.getCalls().map(c => c.args[0] as string);
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
    it('creates the info.system channel, a state per key, and the four flags', async () => {
        const h = harness();
        const sysInfo = {
            toArrayOfObjects: () => [
                { key: 'phValue', value: 7 },
                { key: 'temp', value: 25 },
            ],
        } as unknown as GetStateDataSysInfo;
        await h.provisioner.provisionSysInfo(sysInfo);
        const ids = idsFrom(h.setObjectNotExists);
        for (const id of [
            'procon-ip.0.info.system',
            'procon-ip.0.info.system.phValue',
            'procon-ip.0.info.system.temp',
            'procon-ip.0.info.system.phPlusDosageEnabled',
            'procon-ip.0.info.system.phMinusDosageEnabled',
            'procon-ip.0.info.system.chlorineDosageEnabled',
            'procon-ip.0.info.system.electrolysis',
        ]) {
            expect(ids, id).to.include(id);
        }
    });
});

describe('ObjectProvisioner.provisionStateData', () => {
    it('creates each category channel once and the object channel + field states', async () => {
        const h = harness();
        await h.provisioner.provisionStateData([
            dataObj({ category: 'temperatures', categoryId: 0, label: 'Pool' }),
            dataObj({ category: 'temperatures', categoryId: 1, label: 'Air' }),
        ]);
        await settle();
        const ids = idsFrom(h.setObjectNotExists);
        expect(ids.filter(i => i === 'procon-ip.0.temperatures')).to.have.lengthOf(1);
        expect(ids).to.include('procon-ip.0.temperatures.0');
        expect(ids).to.include('procon-ip.0.temperatures.0.value');
        expect(ids).to.include('procon-ip.0.temperatures.1.value');
    });
});

describe('ObjectProvisioner relay objects', () => {
    it('creates auto/onOff and a .timer for a non-dosage relay', async () => {
        const h = harness({ isDosageControl: () => false });
        await h.provisioner.provisionStateData([dataObj({ category: 'relays', categoryId: 2, label: 'Pump' })]);
        await settle();
        const ids = idsFrom(h.setObjectNotExists);
        expect(ids).to.include('procon-ip.0.relays.2.auto');
        expect(ids).to.include('procon-ip.0.relays.2.onOff');
        expect(ids).to.include('procon-ip.0.relays.2.timer');
        expect(ids).to.not.include('procon-ip.0.relays.2.dosageTimer');
    });
    it('creates a .dosageTimer for a dosage relay (relayControlId 2)', async () => {
        const h = harness({ isDosageControl: id => id === 2 });
        await h.provisioner.provisionStateData([dataObj({ category: 'relays', categoryId: 2, label: 'Chlorine' })]);
        await settle();
        const ids = idsFrom(h.setObjectNotExists);
        expect(ids).to.include('procon-ip.0.relays.2.dosageTimer');
        expect(ids).to.not.include('procon-ip.0.relays.2.timer');
    });
    it('skips relay states for external relays when they are disabled', async () => {
        const h = harness({ isExtRelaysEnabled: false });
        await h.provisioner.provisionStateData([
            dataObj({ category: String(GetStateCategory.EXTERNAL_RELAYS), categoryId: 0, label: 'Ext' }),
        ]);
        await settle();
        const ids = idsFrom(h.setObjectNotExists);
        expect(ids.some(i => i.endsWith('.auto'))).to.be.false;
    });
});
