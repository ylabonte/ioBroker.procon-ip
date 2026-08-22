/**
 * Mock-free unit tests for the pure decision logic in `mapping.ts`.
 * No ioBroker Adapter, no network — just functions of their inputs.
 */

import { expect } from 'chai';
import { GetStateCategory, type GetStateDataObject } from 'procon-ip';
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
    sysInfoStateCommon,
    booleanFlagStateCommon,
    dataFieldStateCommon,
    relayAutoStateCommon,
    relayOnOffStateCommon,
    relayTimerStateCommon,
    dmxChannelStateCommon,
    dmxChannelIndexFromId,
} from './mapping';

// Build a GetStateDataObject-shaped fixture for the `common` builders.
function dataObj(overrides: Partial<GetStateDataObject> = {}): GetStateDataObject {
    return {
        id: 0,
        category: 'relays',
        categoryId: 0,
        label: 'Relay 1',
        value: 1,
        unit: 'C',
        displayValue: '1',
        active: true,
        ...overrides,
    } as unknown as GetStateDataObject;
}

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

describe('mapping.sysInfoStateCommon', () => {
    it('is a read-only string state named after the key', () => {
        expect(sysInfoStateCommon('phValue')).to.deep.equal({
            name: 'phValue',
            type: 'string',
            role: 'state',
            read: true,
            write: false,
        });
    });
});

describe('mapping.booleanFlagStateCommon', () => {
    it('is a read-only boolean indicator with the given name', () => {
        expect(booleanFlagStateCommon('CL enabled')).to.deep.equal({
            name: 'CL enabled',
            type: 'boolean',
            role: 'indicator',
            read: true,
            write: false,
        });
    });
});

describe('mapping.dataFieldStateCommon', () => {
    it('returns null for non-published fields', () => {
        expect(dataFieldStateCommon(dataObj(), 'somethingElse')).to.be.null;
    });
    it('shapes the text fields with role text', () => {
        for (const field of ['category', 'label', 'unit', 'displayValue']) {
            expect(dataFieldStateCommon(dataObj(), field)?.role, field).to.equal('text');
        }
    });
    it('shapes the active field as an indicator', () => {
        expect(dataFieldStateCommon(dataObj(), 'active')?.role).to.equal('indicator');
    });
    it('shapes a plain value field as role value with the value type and no unit', () => {
        const c = dataFieldStateCommon(dataObj({ value: 42 }), 'value');
        expect(c?.role).to.equal('value');
        expect(c?.type).to.equal('number');
        expect(c?.unit).to.be.undefined;
    });
    it('special-cases an active temperature value (role/unit/thermostat smartName)', () => {
        const c = dataFieldStateCommon(
            dataObj({ category: String(GetStateCategory.TEMPERATURES), unit: 'C', active: true, label: 'Pool' }),
            'value',
        );
        expect(c?.role).to.equal('value.temperature');
        expect(c?.unit).to.equal('°C');
        expect(c?.smartName).to.deep.equal({ de: 'Pool', en: 'Pool', smartType: 'THERMOSTAT' });
    });
    it('omits the thermostat smartName for an inactive temperature', () => {
        const c = dataFieldStateCommon(
            dataObj({ category: String(GetStateCategory.TEMPERATURES), active: false }),
            'value',
        );
        expect(c?.role).to.equal('value.temperature');
        expect(c?.smartName).to.be.undefined;
    });
});

describe('mapping.relayAutoStateCommon', () => {
    it('is a writable auto switch; an active light relay gets a LIGHT smartName', () => {
        const c = relayAutoStateCommon(dataObj({ label: 'Pool Light', active: true }), true);
        expect(c.role).to.equal('switch.mode.auto');
        expect(c.write).to.be.true;
        expect(c.smartName).to.deep.equal({ de: 'Pool Light auto', en: 'Pool Light auto', smartType: 'LIGHT' });
    });
    it('uses SWITCH smartType for an active non-light relay', () => {
        const c = relayAutoStateCommon(dataObj({ label: 'Pump', active: true }), false);
        expect(c.smartName).to.deep.equal({ de: 'Pump auto', en: 'Pump auto', smartType: 'SWITCH' });
    });
    it('gives inactive relays an empty smartName', () => {
        expect(relayAutoStateCommon(dataObj({ active: false }), false).smartName).to.deep.equal({});
    });
});

describe('mapping.relayOnOffStateCommon', () => {
    it('uses switch.light for lights and switch otherwise', () => {
        expect(relayOnOffStateCommon(dataObj(), true, false).role).to.equal('switch.light');
        expect(relayOnOffStateCommon(dataObj(), false, false).role).to.equal('switch');
    });
    it('is read-only with an empty smartName for dosage relays', () => {
        const c = relayOnOffStateCommon(dataObj({ active: true }), false, true);
        expect(c.write).to.be.false;
        expect(c.smartName).to.deep.equal({});
    });
    it('is writable with a smartName for an active non-dosage relay', () => {
        const c = relayOnOffStateCommon(dataObj({ label: 'Pump', active: true }), false, false);
        expect(c.write).to.be.true;
        expect(c.smartName).to.deep.equal({ de: 'Pump', en: 'Pump', smartType: 'SWITCH' });
    });
});

describe('mapping.relayTimerStateCommon', () => {
    it('is a writable, non-readable numeric interval', () => {
        expect(relayTimerStateCommon(dataObj({ label: 'Pump' }))).to.deep.equal({
            name: 'Pump',
            type: 'number',
            role: 'value.interval',
            read: false,
            write: true,
        });
    });
});

describe('mapping.dmxChannelStateCommon', () => {
    it('is a writable 0-255 dimmer named after the channel', () => {
        expect(dmxChannelStateCommon('CH03')).to.deep.equal({
            name: 'CH03',
            type: 'number',
            role: 'level.dimmer',
            read: true,
            write: true,
            min: 0,
            max: 255,
        });
    });
});

describe('mapping.dmxChannelIndexFromId', () => {
    it('maps CH01..CH16 to 0-based indices', () => {
        expect(dmxChannelIndexFromId('procon-ip.0.dmx.CH01')).to.equal(0);
        expect(dmxChannelIndexFromId('procon-ip.0.dmx.CH16')).to.equal(15);
    });
    it('returns null for non-DMX ids and out-of-range channels', () => {
        expect(dmxChannelIndexFromId('procon-ip.0.relays.2.onOff')).to.be.null;
        expect(dmxChannelIndexFromId('procon-ip.0.dmx.CH00')).to.be.null;
        expect(dmxChannelIndexFromId('procon-ip.0.dmx.CH17')).to.be.null;
        expect(dmxChannelIndexFromId('procon-ip.0.dmx.CH1')).to.be.null;
    });
});
