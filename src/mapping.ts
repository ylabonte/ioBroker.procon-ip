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
