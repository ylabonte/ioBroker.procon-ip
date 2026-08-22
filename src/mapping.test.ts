/**
 * Mock-free unit tests for the pure decision logic in `mapping.ts`.
 * No ioBroker Adapter, no network — just functions of their inputs.
 */

import { expect } from 'chai';
import { GetStateCategory } from 'procon-ip';
import {
    errorMessage,
    isValidURL,
    isExternalRelay,
    isRelayCategory,
    isTemperatureCategory,
    relayControlId,
    relayTimerId,
    classifyCommand,
    isLightLabel,
    shouldUpdateState,
    buildId,
    buildServiceConfig,
} from './mapping';

const RELAYS = String(GetStateCategory.RELAYS);
const EXTERNAL = String(GetStateCategory.EXTERNAL_RELAYS);
const TEMPS = String(GetStateCategory.TEMPERATURES);

describe('mapping.errorMessage', () => {
    it('returns the message of an Error', () => {
        expect(errorMessage(new Error('boom'))).to.equal('boom');
    });
    it('stringifies non-Error values', () => {
        expect(errorMessage('nope')).to.equal('nope');
        expect(errorMessage(42)).to.equal('42');
        expect(errorMessage(undefined)).to.equal('undefined');
        expect(errorMessage(null)).to.equal('null');
    });
});

describe('mapping.isValidURL', () => {
    it('accepts a parseable URL', () => {
        expect(isValidURL('http://192.168.2.3')).to.be.true;
        expect(isValidURL('https://pool.local:8080/path')).to.be.true;
    });
    it('rejects an empty or malformed URL', () => {
        expect(isValidURL('')).to.be.false;
        expect(isValidURL('not a url')).to.be.false;
    });
});

describe('mapping relay category predicates', () => {
    it('isExternalRelay is true only for the external-relays category', () => {
        expect(isExternalRelay({ category: EXTERNAL })).to.be.true;
        expect(isExternalRelay({ category: RELAYS })).to.be.false;
        expect(isExternalRelay({ category: TEMPS })).to.be.false;
    });
    it('isRelayCategory is true for internal and external relays only', () => {
        expect(isRelayCategory(RELAYS)).to.be.true;
        expect(isRelayCategory(EXTERNAL)).to.be.true;
        expect(isRelayCategory(TEMPS)).to.be.false;
        expect(isRelayCategory('analog')).to.be.false;
    });
    it('isTemperatureCategory is true only for temperatures', () => {
        expect(isTemperatureCategory(TEMPS)).to.be.true;
        expect(isTemperatureCategory(RELAYS)).to.be.false;
    });
});

describe('mapping relay addressing', () => {
    it('relayControlId offsets external relays by 8, internal by 0', () => {
        expect(relayControlId({ category: RELAYS, categoryId: 3 })).to.equal(3);
        expect(relayControlId({ category: EXTERNAL, categoryId: 3 })).to.equal(11);
        expect(relayControlId({ category: RELAYS, categoryId: 0 })).to.equal(0);
    });
    it('relayTimerId offsets external relays by 9, internal by 1', () => {
        expect(relayTimerId({ category: RELAYS, categoryId: 3 })).to.equal(4);
        expect(relayTimerId({ category: EXTERNAL, categoryId: 3 })).to.equal(12);
        expect(relayTimerId({ category: RELAYS, categoryId: 0 })).to.equal(1);
    });
});

describe('mapping.classifyCommand', () => {
    it('maps each command suffix', () => {
        expect(classifyCommand('procon-ip.0.relays.2.auto')).to.equal('auto');
        expect(classifyCommand('procon-ip.0.relays.2.onOff')).to.equal('onOff');
        expect(classifyCommand('procon-ip.0.relays.2.dosageTimer')).to.equal('dosageTimer');
        expect(classifyCommand('procon-ip.0.relays.2.timer')).to.equal('timer');
    });
    it('returns null for non-command ids', () => {
        expect(classifyCommand('procon-ip.0.relays.2.value')).to.be.null;
        expect(classifyCommand('procon-ip.0.info.system.foo')).to.be.null;
    });
    it('does not confuse dosageTimer with timer (dosageTimer wins by suffix)', () => {
        // ".dosageTimer" ends with "Timer" but not ".timer", so it classifies as dosageTimer.
        expect(classifyCommand('x.dosageTimer')).to.equal('dosageTimer');
        expect(classifyCommand('x.timer')).to.equal('timer');
    });
});

describe('mapping.isLightLabel', () => {
    it('matches localized light/lamp words case-insensitively', () => {
        for (const l of ['Light', 'pool bulb', 'Gartenlicht', 'Leuchte', 'LICHT']) {
            expect(isLightLabel(l), l).to.be.true;
        }
    });
    it('does not match unrelated labels', () => {
        for (const l of ['Pump', 'Filter', 'Heizung', 'Chlorine']) {
            expect(isLightLabel(l), l).to.be.false;
        }
    });
});

describe('mapping.shouldUpdateState', () => {
    it('always updates before bootstrap', () => {
        expect(shouldUpdateState({ bootstrapped: false, forced: false, hasPrevious: false, currentValue: 1 })).to.be
            .true;
    });
    it('updates when forced regardless of value', () => {
        expect(
            shouldUpdateState({
                bootstrapped: true,
                forced: true,
                hasPrevious: true,
                previousValue: 5,
                currentValue: 5,
            }),
        ).to.be.true;
    });
    it('updates when a previous value exists and differs', () => {
        expect(
            shouldUpdateState({
                bootstrapped: true,
                forced: false,
                hasPrevious: true,
                previousValue: 4,
                currentValue: 5,
            }),
        ).to.be.true;
    });
    it('skips when bootstrapped, not forced, and value unchanged', () => {
        expect(
            shouldUpdateState({
                bootstrapped: true,
                forced: false,
                hasPrevious: true,
                previousValue: 5,
                currentValue: 5,
            }),
        ).to.be.false;
    });
    it('skips when there is no previous value yet (and not forced/bootstrap)', () => {
        expect(shouldUpdateState({ bootstrapped: true, forced: false, hasPrevious: false, currentValue: 5 })).to.be
            .false;
    });
    it('uses loose equality like the original (1 == "1")', () => {
        expect(
            shouldUpdateState({
                bootstrapped: true,
                forced: false,
                hasPrevious: true,
                previousValue: 1,
                currentValue: '1',
            }),
        ).to.be.false;
    });
});

describe('mapping.buildId', () => {
    it('joins the namespace with path parts', () => {
        expect(buildId('procon-ip.0', 'relays', 2, 'onOff')).to.equal('procon-ip.0.relays.2.onOff');
        expect(buildId('procon-ip.0', 'info.system', 'foo')).to.equal('procon-ip.0.info.system.foo');
    });
    it('returns just the namespace with no parts', () => {
        expect(buildId('procon-ip.0')).to.equal('procon-ip.0');
    });
});

describe('mapping.buildServiceConfig', () => {
    it('derives timeout from requestTimeout and exposes config via the prototype', () => {
        const config = { controllerUrl: 'http://x', requestTimeout: 4321, basicAuth: false };
        const svc = buildServiceConfig(config);
        expect(svc.timeout).to.equal(4321);
        // config props are reachable (through the prototype chain, like the original)
        expect(svc.controllerUrl).to.equal('http://x');
        expect(svc.basicAuth).to.equal(false);
    });
    it('keeps timeout as a non-enumerable own property (matching the original descriptor)', () => {
        const config = { controllerUrl: 'http://x', requestTimeout: 10 };
        const svc = buildServiceConfig(config);
        expect(Object.prototype.hasOwnProperty.call(svc, 'timeout')).to.be.true;
        expect(Object.keys(svc)).to.not.include('timeout');
    });
});
