/**
 * Unit tests for StatePublisher. setState / getObject / setObject / getStatesOf
 * and the relay interpreter are injected as stubs — no live adapter.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
    GetStateCategory,
    type GetStateDataObject,
    type GetStateDataSysInfo,
    type RelayDataInterpreter,
} from 'procon-ip';
import { StatePublisher, type StatePublisherDeps } from './state-publisher';

interface Harness {
    publisher: StatePublisher;
    setState: sinon.SinonStub;
    setObject: sinon.SinonStub;
    getObject: sinon.SinonStub;
    getStatesOf: sinon.SinonStub;
    isAuto: sinon.SinonStub;
    isOn: sinon.SinonStub;
    log: { debug: sinon.SinonStub; error: sinon.SinonStub };
}

// Assemble a StatePublisher with stubbed I/O.
function harness(opts?: { isExtRelaysEnabled?: boolean }): Harness {
    const setState = sinon.stub().resolves();
    const setObject = sinon.stub().resolves();
    const getObject = sinon.stub().resolves({ _id: 'x', type: 'channel', common: { name: 'old' }, native: {} });
    const getStatesOf = sinon.stub().resolves([{ _id: 'x.value', common: { name: 'old' } }]);
    const isAuto = sinon.stub().returns(true);
    const isOn = sinon.stub().returns(false);
    const log = { debug: sinon.stub(), error: sinon.stub() };
    const deps: StatePublisherDeps = {
        log,
        namespace: 'procon-ip.0',
        setState,
        getObject,
        setObject,
        getStatesOf,
        relayDataInterpreter: { isAuto, isOn } as unknown as RelayDataInterpreter,
        isExtRelaysEnabled: () => opts?.isExtRelaysEnabled ?? true,
    };
    return { publisher: new StatePublisher(deps), setState, setObject, getObject, getStatesOf, isAuto, isOn, log };
}

// A GetStateDataObject-shaped fixture.
function dataObj(o: Partial<GetStateDataObject>): GetStateDataObject {
    return {
        id: 0,
        category: 'relays',
        categoryId: 2,
        label: 'Pump',
        value: 21,
        unit: 'C',
        displayValue: '21',
        active: true,
        ...o,
    } as unknown as GetStateDataObject;
}

// The (id, value) pairs passed to setState.
function writes(stub: sinon.SinonStub): Array<[string, unknown]> {
    return stub.getCalls().map(c => [c.args[0] as string, c.args[1]]);
}

describe('StatePublisher.publishSysInfoState', () => {
    it('writes info.system.<key> with the stringified value (ack)', () => {
        const h = harness();
        h.publisher.publishSysInfoState('phValue', 7);
        expect(h.setState.calledOnceWithExactly('procon-ip.0.info.system.phValue', '7', true)).to.be.true;
    });
});

describe('StatePublisher.publishAdvancedSysInfo', () => {
    const sysInfo = {
        dosageControl: 5,
        isPhPlusDosageEnabled: () => true,
        isPhMinusDosageEnabled: () => false,
        isChlorineDosageEnabled: () => true,
        isElectrolysis: () => false,
    } as unknown as GetStateDataSysInfo;

    it('publishes all four flags on the first (not-yet-bootstrapped) pass', () => {
        const h = harness();
        h.publisher.publishAdvancedSysInfo(sysInfo, { bootstrapped: false, previousDosageControl: 5 });
        const ids = writes(h.setState).map(w => w[0]);
        expect(ids).to.have.members([
            'procon-ip.0.info.system.phPlusDosageEnabled',
            'procon-ip.0.info.system.phMinusDosageEnabled',
            'procon-ip.0.info.system.chlorineDosageEnabled',
            'procon-ip.0.info.system.electrolysis',
        ]);
    });
    it('skips publishing when bootstrapped and the dosage-control byte is unchanged', () => {
        const h = harness();
        h.publisher.publishAdvancedSysInfo(sysInfo, { bootstrapped: true, previousDosageControl: 5 });
        expect(h.setState.called).to.be.false;
    });
    it('publishes when the dosage-control byte changed', () => {
        const h = harness();
        h.publisher.publishAdvancedSysInfo(sysInfo, { bootstrapped: true, previousDosageControl: 4 });
        expect(h.setState.callCount).to.equal(4);
    });
});

describe('StatePublisher.publishDataState', () => {
    it('writes the six published field states', () => {
        const h = harness();
        h.publisher.publishDataState(dataObj({ category: 'temperatures', categoryId: 0 }));
        const ids = writes(h.setState).map(w => w[0]);
        expect(ids).to.include('procon-ip.0.temperatures.0.value');
        expect(ids).to.include('procon-ip.0.temperatures.0.label');
        expect(ids).to.include('procon-ip.0.temperatures.0.active');
        expect(ids).to.not.include('procon-ip.0.temperatures.0.id');
    });
    it('also writes relay switch states for a relay', () => {
        const h = harness();
        h.publisher.publishDataState(dataObj({ category: 'relays', categoryId: 2 }));
        const ids = writes(h.setState).map(w => w[0]);
        expect(ids).to.include('procon-ip.0.relays.2.auto');
        expect(ids).to.include('procon-ip.0.relays.2.onOff');
    });
    it('skips relay switch states for external relays when disabled', () => {
        const h = harness({ isExtRelaysEnabled: false });
        h.publisher.publishDataState(dataObj({ category: String(GetStateCategory.EXTERNAL_RELAYS), categoryId: 0 }));
        const ids = writes(h.setState).map(w => w[0]);
        expect(ids.some(i => i.endsWith('.auto'))).to.be.false;
    });
});

describe('StatePublisher.publishRelayState', () => {
    it('writes auto (isAuto) and onOff (isOn) values', () => {
        const h = harness();
        h.publisher.publishRelayState(dataObj({ category: 'relays', categoryId: 2 }));
        const pairs = writes(h.setState);
        expect(pairs).to.deep.include(['procon-ip.0.relays.2.auto', true]);
        expect(pairs).to.deep.include(['procon-ip.0.relays.2.onOff', false]);
    });
});

describe('StatePublisher.updateObjectCommonName', () => {
    it('renames the channel object and each of its states to the new label', async () => {
        const h = harness();
        await h.publisher.updateObjectCommonName(dataObj({ category: 'relays', categoryId: 2, label: 'New Name' }));
        // channel object rewritten with the new name
        const channelCall = h.setObject.getCalls().find(c => c.args[0] === 'procon-ip.0.relays.2');
        expect(channelCall, 'channel setObject').to.exist;
        expect((channelCall!.args[1] as ioBroker.Object).common.name).to.equal('New Name');
        // and its state object
        const stateCall = h.setObject.getCalls().find(c => c.args[0] === 'x.value');
        expect(stateCall, 'state setObject').to.exist;
        expect((stateCall!.args[1] as ioBroker.StateObject).common.name).to.equal('New Name');
    });
});
