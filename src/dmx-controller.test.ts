/**
 * Unit tests for DmxController. The DMX services, state writes and the clock are
 * injected as stubs — no live adapter, no controller.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import type { GetDmxData } from 'procon-ip';
import { DmxController, type DmxControllerDeps } from './dmx-controller';

// A minimal GetDmxData: iterable of {index,name,value} channels with a set().
function fakeDmxData(values: number[]): GetDmxData {
    const channels = values.map((value, index) => ({
        index,
        name: `CH${String(index + 1).padStart(2, '0')}`,
        value,
    }));
    return {
        set: sinon.stub().callsFake((index: number, value: number) => {
            channels[index].value = value;
        }),
        [Symbol.iterator]: () => channels[Symbol.iterator](),
    } as unknown as GetDmxData;
}

interface HarnessResult {
    controller: DmxController;
    getDmx: sinon.SinonStub;
    dmxSet: sinon.SinonStub;
    setStateChanged: sinon.SinonStub;
    ackCommand: sinon.SinonStub;
    log: { debug: sinon.SinonStub; error: sinon.SinonStub };
    clock: { t: number };
}

function harness(dmxData?: GetDmxData): HarnessResult {
    const getDmx = sinon.stub().resolves(dmxData ?? fakeDmxData(new Array(16).fill(0)));
    const dmxSet = sinon.stub().resolves();
    const setStateChanged = sinon.stub().resolves();
    const ackCommand = sinon.stub();
    const log = { debug: sinon.stub(), error: sinon.stub() };
    const clock = { t: 1000 };
    const deps: DmxControllerDeps = {
        log,
        namespace: 'procon-ip.0',
        getDmxService: { update: getDmx },
        dmxService: { set: dmxSet },
        setStateChanged,
        ackCommand,
        now: () => clock.t,
    };
    return { controller: new DmxController(deps), getDmx, dmxSet, setStateChanged, ackCommand, log, clock };
}

describe('DmxController.isDmxChannel', () => {
    it('recognises dmx channel ids', () => {
        const h = harness();
        expect(h.controller.isDmxChannel('procon-ip.0.dmx.CH05')).to.be.true;
        expect(h.controller.isDmxChannel('procon-ip.0.relays.2.onOff')).to.be.false;
    });
});

describe('DmxController.poll', () => {
    it('publishes every channel value', async () => {
        const values = Array.from({ length: 16 }, (_, i) => i * 10);
        const h = harness(fakeDmxData(values));
        await h.controller.poll();
        expect(h.setStateChanged.callCount).to.equal(16);
        expect(h.setStateChanged.calledWith('procon-ip.0.dmx.CH01', 0, true)).to.be.true;
        expect(h.setStateChanged.calledWith('procon-ip.0.dmx.CH03', 20, true)).to.be.true;
    });
    it('logs and does not throw when the DMX read fails', async () => {
        const h = harness();
        h.getDmx.rejects(new Error('offline'));
        await h.controller.poll();
        expect(h.log.error.calledOnce).to.be.true;
        expect(h.setStateChanged.called).to.be.false;
    });
    it('logs a transient connection reset at debug, not error (it self-heals next poll)', async () => {
        const h = harness();
        h.getDmx.rejects(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }));
        await h.controller.poll();
        expect(h.log.error.called, 'no error log for a transient reset').to.be.false;
        expect(h.log.debug.calledOnce, 'transient reset logged at debug').to.be.true;
        expect(h.setStateChanged.called).to.be.false;
    });
    it('does not republish inside the post-write quiet window', async () => {
        const h = harness(fakeDmxData(new Array(16).fill(0)));
        await h.controller.handleWrite('procon-ip.0.dmx.CH01', 200); // sets quietUntil = 1000 + 1500
        h.setStateChanged.resetHistory();
        h.clock.t = 2000; // still < 2500
        await h.controller.poll();
        expect(h.setStateChanged.called).to.be.false;
        // once the quiet window passes, polling publishes again
        h.clock.t = 3000;
        await h.controller.poll();
        expect(h.setStateChanged.callCount).to.equal(16);
    });
});

describe('DmxController.handleWrite', () => {
    it('sets the channel in the shadow, pushes the full frame, and acks', async () => {
        const data = fakeDmxData(new Array(16).fill(0));
        const h = harness(data);
        await h.controller.handleWrite('procon-ip.0.dmx.CH04', 128);
        // channel index 3 (CH04) updated in the shadow
        expect((data.set as sinon.SinonStub).calledOnceWithExactly(3, 128)).to.be.true;
        // full frame pushed
        expect(h.dmxSet.calledOnceWithExactly(data)).to.be.true;
        // command acknowledged
        expect(h.ackCommand.calledOnceWithExactly('procon-ip.0.dmx.CH04', 128)).to.be.true;
    });
    it('ignores a non-DMX id', async () => {
        const h = harness();
        await h.controller.handleWrite('procon-ip.0.relays.2.onOff', 1);
        expect(h.dmxSet.called).to.be.false;
        expect(h.ackCommand.called).to.be.false;
    });
    it('logs and does not throw when the DMX write fails', async () => {
        const h = harness();
        h.dmxSet.rejects(new Error('offline'));
        await h.controller.handleWrite('procon-ip.0.dmx.CH01', 10);
        expect(h.log.error.calledOnce).to.be.true;
        expect(h.ackCommand.called).to.be.false;
    });
});
