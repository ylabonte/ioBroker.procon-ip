/**
 * Pure, dependency-free decision logic for the ProCon.IP adapter.
 *
 * Everything in this module is a plain function of its inputs — no ioBroker
 * Adapter, no network, no `this`. That makes the adapter's actual decisions
 * (URL validation, relay addressing, command routing, change detection, object
 * shaping) unit-testable without mocking a live adapter. `src/main.ts` wires
 * these into the runtime; the behaviour here must stay byte-for-byte equivalent
 * to what `main.ts` did inline before the extraction.
 */

import { GetStateCategory, type GetStateDataObject, type IServiceConfig } from 'procon-ip';

/**
 * Narrow an unknown thrown value to a log-friendly message.
 *
 * @param e the caught value (an `Error` or anything else that was thrown).
 * @returns the error's message, or the stringified value for non-errors.
 */
export function errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

/** Error codes for transient connection failures a poll can safely shrug off and retry next cycle. */
const TRANSIENT_NETWORK_CODES = new Set([
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ECONNABORTED',
    'EPIPE',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ENETDOWN',
    'EAI_AGAIN',
]);

/**
 * Whether the given error is a transient network/connection failure rather than
 * a genuine fault. The ProCon.IP's legacy HTTP/1.0 firmware occasionally hangs
 * and resets a connection (verified: the network path stays clean while a single
 * request stalls ~5s then `ECONNRESET`s). Such a failure is expected, self-heals
 * on the next poll, and should not be logged as an error.
 *
 * @param e the caught error.
 * @returns true if the error is a transient connection failure (incl. request timeouts).
 */
export function isTransientNetworkError(e: unknown): boolean {
    if (!e || typeof e !== 'object') {
        return false;
    }
    const err = e as { code?: unknown; name?: unknown; message?: unknown };
    if (typeof err.code === 'string' && TRANSIENT_NETWORK_CODES.has(err.code)) {
        return true;
    }
    if (err.name === 'RequestTimeoutError') {
        return true;
    }
    const message = typeof err.message === 'string' ? err.message : '';
    return /ECONNRESET|ETIMEDOUT|socket hang up|timed out/i.test(message);
}

/**
 * Whether the DMX channels should be exposed and polled — the config mode gated
 * by the controller's live DMX flag. `never` is a hard opt-out regardless of the
 * controller.
 *
 * @param mode the configured DMX polling mode (`auto` or `never`).
 * @param isDmxEnabled whether the controller reports DMX512 as enabled.
 * @returns true when DMX should be active.
 */
export function dmxShouldBeActive(mode: string, isDmxEnabled: boolean): boolean {
    return mode !== 'never' && isDmxEnabled;
}

/**
 * Status text and colour for the admin DMX status indicator (`textSendTo`): a
 * green/red/grey traffic light reflecting the effective DMX state.
 *
 * @param mode the configured DMX polling mode.
 * @param isDmxEnabled whether the controller reports DMX512 as enabled.
 * @returns the display text and a CSS colour for the indicator.
 */
export function dmxStatusText(mode: string, isDmxEnabled: boolean): { text: string; color: string } {
    if (mode === 'never') {
        return { text: 'DMX512 polling disabled in configuration', color: '#9e9e9e' };
    }
    return isDmxEnabled
        ? { text: 'DMX512 enabled on the controller', color: '#4caf50' }
        : { text: 'DMX512 not enabled on the controller', color: '#f44336' };
}

/**
 * True when the given string parses as a URL.
 *
 * @param url the candidate URL (e.g. the configured controller URL).
 * @returns whether `new URL(url)` succeeds.
 */
export function isValidURL(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

type CategorizedRelay = Pick<GetStateDataObject, 'category' | 'categoryId'>;

/**
 * True for objects belonging to the external-relays category.
 *
 * @param obj a data object carrying a `category`.
 * @returns whether the object is an external relay.
 */
export function isExternalRelay(obj: Pick<GetStateDataObject, 'category'>): boolean {
    return obj.category === String(GetStateCategory.EXTERNAL_RELAYS);
}

/**
 * True for the relay categories (internal or external relays).
 *
 * @param category the object category string.
 * @returns whether the category is `relays` or `externalRelays`.
 */
export function isRelayCategory(category: string): boolean {
    return (
        (category as GetStateCategory) === GetStateCategory.RELAYS ||
        (category as GetStateCategory) === GetStateCategory.EXTERNAL_RELAYS
    );
}

/**
 * True for the temperatures category.
 *
 * @param category the object category string.
 * @returns whether the category is `temperatures`.
 */
export function isTemperatureCategory(category: string): boolean {
    return (category as GetStateCategory) === GetStateCategory.TEMPERATURES;
}

/**
 * Controller relay address for on/off/auto switching and dosage control.
 * External relays are offset by 8; internal relays use their category id as-is.
 * (Matches the inline `categoryId + (external ? 8 : 0)` used for switching,
 * dosage control and the `isDosageControl` lookup.)
 *
 * @param obj a relay data object (`category` + `categoryId`).
 * @returns the controller-side relay address for switching/dosage.
 */
export function relayControlId(obj: CategorizedRelay): number {
    return obj.categoryId + (isExternalRelay(obj) ? 8 : 0);
}

/**
 * Controller relay address for the relay/dosage *timer* channel.
 * External relays are offset by 9, internal relays by 1.
 *
 * @param obj a relay data object (`category` + `categoryId`).
 * @returns the controller-side relay address for the timer channel.
 */
export function relayTimerId(obj: CategorizedRelay): number {
    return obj.categoryId + (isExternalRelay(obj) ? 9 : 1);
}

/** The four writable relay command channels, keyed by state-id suffix. */
export type CommandKind = 'auto' | 'onOff' | 'dosageTimer' | 'timer';

/**
 * Classify a changed state's id by its suffix into the command it triggers,
 * or `null` when the id is not a command channel. Order matches `onStateChange`.
 *
 * @param id the full state id whose change was observed.
 * @returns the command kind, or `null` if the id is not a command channel.
 */
export function classifyCommand(id: string): CommandKind | null {
    if (id.endsWith('.auto')) {
        return 'auto';
    }
    if (id.endsWith('.onOff')) {
        return 'onOff';
    }
    if (id.endsWith('.dosageTimer')) {
        return 'dosageTimer';
    }
    if (id.endsWith('.timer')) {
        return 'timer';
    }
    return null;
}

/**
 * A label that looks like a light/lamp (localized), used for smart roles.
 *
 * @param label the relay's human-readable label.
 * @returns whether the label matches a light/lamp word (any language/case).
 */
export function isLightLabel(label: string): boolean {
    return /light|bulb|licht|leucht/i.test(label);
}

/**
 * Whether a polled data object's state should be (re)published. Reproduces the
 * inline predicate: publish on the first (bootstrap) pass, when a UI-driven
 * change forced it, or when a previous value existed and differs from now.
 *
 * @param args the decision inputs.
 * @param args.bootstrapped whether the first full publish pass has completed.
 * @param args.forced whether a UI command forced this object to be re-published.
 * @param args.hasPrevious whether a previous snapshot value exists to compare.
 * @param args.previousValue the previous value (only meaningful with `hasPrevious`).
 * @param args.currentValue the freshly polled value.
 * @returns whether the state should be written.
 */
export function shouldUpdateState(args: {
    bootstrapped: boolean;
    forced: boolean;
    hasPrevious: boolean;
    previousValue?: unknown;
    currentValue: unknown;
}): boolean {
    return !args.bootstrapped || args.forced || (args.hasPrevious && args.previousValue != args.currentValue);
}

/**
 * Join adapter-namespace parts into a full object/state id.
 * `namespace` is the adapter's `${name}.${instance}` (i.e. `this.namespace`),
 * replacing the ~30 hand-built `${this.name}.${this.instance}.…` prefixes.
 *
 * @param namespace the adapter namespace, e.g. `procon-ip.0`.
 * @param parts the path segments below the namespace.
 * @returns the dot-joined full id.
 */
export function buildId(namespace: string, ...parts: (string | number)[]): string {
    return [namespace, ...parts].join('.');
}

/**
 * Build the procon-ip service config from the adapter config: the config object
 * itself, plus a `timeout` derived from `requestTimeout`. Kept faithful to the
 * original `Object.defineProperties(Object.create(config), …)`: `config` is the
 * prototype (live link) and `timeout` is a non-enumerable own property — the
 * services read `config.timeout`/`config.controllerUrl` by direct access.
 *
 * @param config the adapter config, which must expose `requestTimeout`.
 * @param config.requestTimeout the per-request timeout in milliseconds.
 * @returns a service config whose `timeout` is set and whose other fields come
 *   from `config` via the prototype chain.
 */
export function buildServiceConfig(config: { requestTimeout: number }): IServiceConfig {
    return Object.defineProperties(Object.create(config), {
        timeout: {
            value: config.requestTimeout,
            writable: true,
        },
    }) as IServiceConfig;
}

// ---------------------------------------------------------------------------
// Object `common` builders — pure shaping of ioBroker state definitions. These
// mirror the inline `common` blocks the provisioner used to build; extracting
// them keeps the object definitions in one tested place (and makes the upcoming
// `extendObject` migration a change of the writer, not the shapes).
// ---------------------------------------------------------------------------

/**
 * `common` for a raw string sysinfo state (e.g. `info.system.<key>`).
 *
 * @param key the sysinfo key, used as the state name.
 * @returns the read-only string state `common`.
 */
export function sysInfoStateCommon(key: string): ioBroker.StateCommon {
    return { name: key, type: 'string', role: 'state', read: true, write: false };
}

/**
 * `common` for a boolean sysinfo flag (dosage-enabled flags, electrolysis).
 *
 * @param name the human-readable flag name.
 * @returns the read-only boolean state `common`.
 */
export function booleanFlagStateCommon(name: string): ioBroker.StateCommon {
    return { name, type: 'boolean', role: 'indicator', read: true, write: false };
}

/**
 * `common` for one field of a data object, or `null` when the field is not a
 * published field. Mirrors the inline field switch: `value` (with temperature
 * special-casing), the text fields, and the `active` indicator.
 *
 * @param obj the controller data object.
 * @param field the field key being published.
 * @returns the state `common`, or `null` to skip the field.
 */
export function dataFieldStateCommon(obj: GetStateDataObject, field: string): ioBroker.StateCommon | null {
    const common = {
        name: obj.label,
        type: typeof obj[field],
        role: 'value',
        read: true,
        write: false,
    } as ioBroker.StateCommon;

    switch (field) {
        case 'value':
            if (isTemperatureCategory(obj.category)) {
                common.role = 'value.temperature';
                common.unit = `°${obj.unit}`;
                if (obj.active) {
                    common.smartName = { de: obj.label, en: obj.label, smartType: 'THERMOSTAT' };
                }
            }
            break;
        case 'category':
        case 'label':
        case 'unit':
        case 'displayValue':
            common.role = 'text';
            break;
        case 'active':
            common.role = 'indicator';
            break;
        default:
            return null;
    }
    return common;
}

/**
 * `common` for a relay's `.auto` switch state.
 *
 * @param obj the relay data object.
 * @param isLight whether the relay label looks like a light (affects smartType).
 * @returns the writable auto-switch `common`.
 */
export function relayAutoStateCommon(obj: GetStateDataObject, isLight: boolean): ioBroker.StateCommon {
    return {
        name: obj.label,
        type: 'boolean',
        role: 'switch.mode.auto',
        read: true,
        write: true,
        smartName: obj.active
            ? { de: `${obj.label} auto`, en: `${obj.label} auto`, smartType: isLight ? 'LIGHT' : 'SWITCH' }
            : {},
    };
}

/**
 * `common` for a relay's `.onOff` switch state. Dosage relays are read-only
 * (they are driven by the dosage timer) and carry no smartName.
 *
 * @param obj the relay data object.
 * @param isLight whether the relay label looks like a light.
 * @param isDosageRelay whether the relay is a dosage-control relay.
 * @returns the on/off-switch `common`.
 */
export function relayOnOffStateCommon(
    obj: GetStateDataObject,
    isLight: boolean,
    isDosageRelay: boolean,
): ioBroker.StateCommon {
    return {
        name: obj.label,
        type: 'boolean',
        role: isLight ? 'switch.light' : 'switch',
        read: true,
        write: !isDosageRelay,
        smartName:
            obj.active && !isDosageRelay
                ? { de: obj.label, en: obj.label, smartType: isLight ? 'LIGHT' : 'SWITCH' }
                : {},
    };
}

/**
 * `common` for a relay's timer / dosage-timer state (both share this shape).
 *
 * @param obj the relay data object.
 * @returns the writable numeric interval `common`.
 */
export function relayTimerStateCommon(obj: GetStateDataObject): ioBroker.StateCommon {
    return { name: obj.label, type: 'number', role: 'value.interval', read: false, write: true };
}

/**
 * `common` for a single DMX channel: a writable 8-bit dimmer (0 = off).
 *
 * @param name the channel name, e.g. `CH01`.
 * @returns the writable numeric dimmer `common` (0–255).
 */
export function dmxChannelStateCommon(name: string): ioBroker.StateCommon {
    return { name, type: 'number', role: 'level.dimmer', read: true, write: true, min: 0, max: 255 };
}

/**
 * The 0-based DMX channel index encoded in a `…dmx.CH<nn>` state id, or `null`
 * when the id is not a DMX channel. `CH01` → 0 … `CH16` → 15.
 *
 * @param id the full state id whose change was observed.
 * @returns the 0-based channel index, or `null`.
 */
export function dmxChannelIndexFromId(id: string): number | null {
    const match = /\.dmx\.CH(\d{2})$/.exec(id);
    if (!match) {
        return null;
    }
    const oneBased = Number(match[1]);
    if (!Number.isInteger(oneBased) || oneBased < 1 || oneBased > 16) {
        return null;
    }
    return oneBased - 1;
}
