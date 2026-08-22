/**
 * Unit tests for the CommandHandler collaborator. All adapter/service
 * dependencies are sinon stubs — no live ioBroker Adapter, no controller.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { CommandHandler, type CommandHandlerDeps } from './command-handler';

// Build a minimal ioBroker.State.
function makeState(val: unknown): ioBroker.State {
    return { val, ack: false, ts: 0, lc: 0, from: 'test', q: 0 } as ioBroker.State;
}

// Build a minimal ioBroker.Object with the native fields the handler reads.
function makeObj(nativeId: number, label = 'Relay 1'): ioBroker.Object {
    return { _id: 'x', type: 'state', common: {}, native: { id: nativeId, label } } as unknown as ioBroker.Object;
}

interface DataObjectStub {
    id: number;
    category: string;
    categoryId: number;
    label: string;
}

interface Harness {
    deps: CommandHandlerDeps;
    handler: CommandHandler;
    forced: number[];
    usrcfg: { setOn: sinon.SinonStub; setOff: sinon.SinonStub; setAuto: sinon.SinonStub };
    command: {
        setChlorineDosage: sinon.SinonStub;
        setPhMinusDosage: sinon.SinonStub;
        setPhPlusDosage: sinon.SinonStub;
    };
    setStateService: { setTimer: sinon.SinonStub };
    log: { info: sinon.SinonStub; error: sinon.SinonStub };
    getObject: sinon.SinonStub;
    getState: sinon.SinonStub;
}

// Assemble a CommandHandler with fully stubbed dependencies. `opts.dataObject`
// is what getStateData().getDataObject returns; `opts.controlIds` are the three
// dosage-control ids the snapshot reports.
function harness(opts: {
    dataObject: DataObjectStub;
    controlIds?: { chlorine?: number; phMinus?: number; phPlus?: number };
}): Harness {
    const forced: number[] = [];
    const usrcfg = {
        setOn: sinon.stub().resolves(),
        setOff: sinon.stub().resolves(),
        setAuto: sinon.stub().resolves(),
    };
    const command = {
        setChlorineDosage: sinon.stub().resolves(),
        setPhMinusDosage: sinon.stub().resolves(),
        setPhPlusDosage: sinon.stub().resolves(),
    };
    const setStateService = { setTimer: sinon.stub().resolves() };
    const log = { info: sinon.stub(), error: sinon.stub() };
    const getObject = sinon.stub().resolves(makeObj(opts.dataObject.id, opts.dataObject.label));
    const getState = sinon.stub().resolves(makeState(false));

    const stateData = {
        getDataObject: (_id: number): DataObjectStub => opts.dataObject,
        getChlorineDosageControlId: (): number => opts.controlIds?.chlorine ?? -1,
        getPhMinusDosageControlId: (): number => opts.controlIds?.phMinus ?? -2,
        getPhPlusDosageControlId: (): number => opts.controlIds?.phPlus ?? -3,
    };

    // Cast the service stubs through unknown — only the methods the handler uses matter.
    const deps: CommandHandlerDeps = {
        log,
        getObject,
        getState,
        getStateData: () => stateData as unknown as ReturnType<CommandHandlerDeps['getStateData']>,
        markForceUpdate: (id: number) => forced.push(id),
        usrcfgCgiService: usrcfg as unknown as CommandHandlerDeps['usrcfgCgiService'],
        commandService: command as unknown as CommandHandlerDeps['commandService'],
        setStateService: setStateService as unknown as CommandHandlerDeps['setStateService'],
    };

    return {
        deps,
        handler: new CommandHandler(deps),
        forced,
        usrcfg,
        command,
        setStateService,
        log,
        getObject,
        getState,
    };
}

const RELAY = { id: 5, category: 'relays', categoryId: 2, label: 'Pump' };

describe('CommandHandler.dispatch routing', () => {
    it('routes each command suffix to its handler and ignores others', () => {
        const h = harness({ dataObject: RELAY });
        const auto = sinon.stub(h.handler, 'relayToggleAuto').resolves();
        const onOff = sinon.stub(h.handler, 'relayToggleOnOff').resolves();
        const dosage = sinon.stub(h.handler, 'setDosageTimer').resolves();
        const timer = sinon.stub(h.handler, 'setRelayTimer').resolves();

        const st = makeState(true);
        h.handler.dispatch('procon-ip.0.relays.2.auto', st);
        h.handler.dispatch('procon-ip.0.relays.2.onOff', st);
        h.handler.dispatch('procon-ip.0.relays.2.dosageTimer', st);
        h.handler.dispatch('procon-ip.0.relays.2.timer', st);
        h.handler.dispatch('procon-ip.0.relays.2.value', st); // not a command

        expect(auto.calledOnceWithExactly('procon-ip.0.relays.2.auto', st)).to.be.true;
        expect(onOff.calledOnceWithExactly('procon-ip.0.relays.2.onOff', st)).to.be.true;
        expect(dosage.calledOnceWithExactly('procon-ip.0.relays.2.dosageTimer', st)).to.be.true;
        expect(timer.calledOnceWithExactly('procon-ip.0.relays.2.timer', st)).to.be.true;
    });
});

describe('CommandHandler.relayToggleAuto', () => {
    it('switches to auto when the value is truthy', async () => {
        const h = harness({ dataObject: RELAY });
        await h.handler.relayToggleAuto('procon-ip.0.relays.2.auto', makeState(true));
        expect(h.usrcfg.setAuto.calledOnce).to.be.true;
        expect(h.usrcfg.setOn.called).to.be.false;
        expect(h.forced).to.deep.equal([RELAY.id]);
    });
    it('switches on when value falsy but current onOff is on', async () => {
        const h = harness({ dataObject: RELAY });
        h.getState.resolves(makeState(true)); // onOff currently on
        await h.handler.relayToggleAuto('procon-ip.0.relays.2.auto', makeState(false));
        expect(h.usrcfg.setOn.calledOnce).to.be.true;
        expect(h.usrcfg.setAuto.called).to.be.false;
    });
    it('switches off when value falsy and onOff is off', async () => {
        const h = harness({ dataObject: RELAY });
        h.getState.resolves(makeState(false));
        await h.handler.relayToggleAuto('procon-ip.0.relays.2.auto', makeState(false));
        expect(h.usrcfg.setOff.calledOnce).to.be.true;
    });
    it('throws when the onOff state cannot be read', async () => {
        const h = harness({ dataObject: RELAY });
        h.getState.resolves(null);
        await expect(h.handler.relayToggleAuto('procon-ip.0.relays.2.auto', makeState(true))).to.be.rejectedWith(
            /Cannot get onOff state/,
        );
    });
    it('throws when the object does not exist', async () => {
        const h = harness({ dataObject: RELAY });
        h.getObject.resolves(null);
        await expect(h.handler.relayToggleAuto('procon-ip.0.relays.2.auto', makeState(true))).to.be.rejectedWith(
            /non-existent object/,
        );
    });
    it('propagates a switching-service rejection: the auto paths `return` the promise, so the inner catch is a no-op (behaviour preserved from the original — the dispatch-level catch logs it instead)', async () => {
        const h = harness({ dataObject: RELAY });
        h.usrcfg.setAuto.rejects(new Error('offline'));
        await expect(h.handler.relayToggleAuto('procon-ip.0.relays.2.auto', makeState(true))).to.be.rejectedWith(
            /offline/,
        );
        expect(h.log.error.called).to.be.false;
    });
});

describe('CommandHandler.relayToggleOnOff', () => {
    it('switches on for a truthy value and off for a falsy one', async () => {
        const on = harness({ dataObject: RELAY });
        await on.handler.relayToggleOnOff('procon-ip.0.relays.2.onOff', makeState(true));
        expect(on.usrcfg.setOn.calledOnce).to.be.true;
        expect(on.forced).to.deep.equal([RELAY.id]);

        const off = harness({ dataObject: RELAY });
        await off.handler.relayToggleOnOff('procon-ip.0.relays.2.onOff', makeState(false));
        expect(off.usrcfg.setOff.calledOnce).to.be.true;
    });
    it('logs and swallows a switching-service rejection (onOff awaits, so the inner catch fires)', async () => {
        const h = harness({ dataObject: RELAY });
        h.usrcfg.setOn.rejects(new Error('offline'));
        await h.handler.relayToggleOnOff('procon-ip.0.relays.2.onOff', makeState(true));
        expect(h.log.error.calledOnceWithExactly('Error on switching operation: offline')).to.be.true;
    });
});

describe('CommandHandler.setDosageTimer', () => {
    // relayControlId(RELAY) = categoryId(2) + 0 (internal) = 2
    it('routes to chlorine dosage when the control id matches', async () => {
        const h = harness({ dataObject: RELAY, controlIds: { chlorine: 2 } });
        await h.handler.setDosageTimer('procon-ip.0.relays.2.dosageTimer', makeState(30));
        expect(h.command.setChlorineDosage.calledOnceWithExactly(30)).to.be.true;
    });
    it('routes to pH-minus dosage when the control id matches', async () => {
        const h = harness({ dataObject: RELAY, controlIds: { phMinus: 2 } });
        await h.handler.setDosageTimer('procon-ip.0.relays.2.dosageTimer', makeState(15));
        expect(h.command.setPhMinusDosage.calledOnceWithExactly(15)).to.be.true;
    });
    it('does nothing (no throw) when no dosage-control id matches', async () => {
        const h = harness({ dataObject: RELAY, controlIds: {} });
        await h.handler.setDosageTimer('procon-ip.0.relays.2.dosageTimer', makeState(15));
        expect(h.command.setChlorineDosage.called).to.be.false;
        expect(h.command.setPhMinusDosage.called).to.be.false;
        expect(h.command.setPhPlusDosage.called).to.be.false;
        expect(h.forced).to.deep.equal([RELAY.id]);
    });
});

describe('CommandHandler.setRelayTimer', () => {
    // relayTimerId(RELAY) = categoryId(2) + 1 (internal) = 3
    it('sets the relay timer at the timer address', async () => {
        const h = harness({ dataObject: RELAY });
        await h.handler.setRelayTimer('procon-ip.0.relays.2.timer', makeState(120));
        expect(h.setStateService.setTimer.calledOnceWithExactly(3, 120)).to.be.true;
        expect(h.forced).to.deep.equal([RELAY.id]);
    });
});
