/**
 * Optional DMX512 support: polls the controller's 16 DMX channels and relays
 * writes back. DMX lives on its own endpoints (`/GetDmx.csv` read, `/usrcfg.cgi`
 * write via `DmxService`) — separate from the relay/state poll — so it is kept
 * in its own collaborator, injected via {@link DmxControllerDeps} for testability.
 *
 * Each channel is an 8-bit intensity (0–255, 0 = off); there is no on/off flag.
 * A write mutates a local 16-channel *shadow* and pushes the full frame (the
 * library requires all 16 channels per POST, and already handles the literal-
 * comma / undici quirks). A short quiet window after a write keeps the next poll
 * from clobbering the optimistic value before the controller reflects it.
 */

import type { DmxService, GetDmxData, GetDmxService } from 'procon-ip';
import { buildId, dmxChannelIndexFromId, errorMessage, isTransientNetworkError } from './mapping';

/** How long after a write polls skip republishing, so our optimistic value stands. */
const QUIET_WINDOW_MS = 1500;

/** Collaborators the DMX controller needs from its host adapter, injected for testability. */
export interface DmxControllerDeps {
    /** Logger for debug/error output. */
    log: { debug(message: string): void; error(message: string): void };
    /** The adapter namespace, e.g. `procon-ip.0`. */
    namespace: string;
    /** Reads the current DMX frame (`GetDmxService`). */
    getDmxService: Pick<GetDmxService, 'update'>;
    /** Writes the full DMX frame (`DmxService`). */
    dmxService: Pick<DmxService, 'set'>;
    /** Publish a channel value only if it changed (adapter `setStateChanged`). */
    setStateChanged(id: string, value: ioBroker.StateValue, ack: boolean): Promise<unknown>;
    /** Acknowledge the command state after a successful write. */
    ackCommand(id: string, value: ioBroker.StateValue): void;
    /** Monotonic clock in ms (injected so the quiet window is testable). */
    now(): number;
}

/**
 * Polls and controls the controller's DMX channels. Only active when the user
 * enabled DMX in the adapter config.
 */
export class DmxController {
    private readonly deps: DmxControllerDeps;
    private shadow: GetDmxData | null = null;
    private quietUntil = 0;

    /**
     * @param deps injected adapter collaborators.
     */
    public constructor(deps: DmxControllerDeps) {
        this.deps = deps;
    }

    private id(name: string): string {
        return buildId(this.deps.namespace, 'dmx', name);
    }

    /**
     * Whether the given state id is a writable DMX channel.
     *
     * @param id the state id to test.
     */
    public isDmxChannel(id: string): boolean {
        return dmxChannelIndexFromId(id) !== null;
    }

    /**
     * Poll the current DMX frame and publish each channel — unless we are inside
     * the post-write quiet window, where the optimistic shadow value stands. A
     * DMX read failure is logged and never breaks the main state poll.
     */
    public async poll(): Promise<void> {
        try {
            const data = await this.deps.getDmxService.update();
            this.shadow = data;
            if (this.deps.now() < this.quietUntil) {
                return;
            }
            for (const channel of data) {
                await this.deps.setStateChanged(this.id(channel.name), channel.value, true);
            }
        } catch (e: unknown) {
            if (isTransientNetworkError(e)) {
                // The controller's legacy firmware occasionally hangs and resets a
                // connection; the poll self-heals next cycle, so keep it out of the
                // error log (verified: the network path stays clean meanwhile).
                this.deps.log.debug(`DMX poll skipped — transient connection error: ${errorMessage(e)}`);
            } else {
                this.deps.log.error(`Failed to poll DMX: ${errorMessage(e)}`);
            }
        }
    }

    /**
     * Handle a write to a `dmx.CH<nn>` state: set the channel in the shadow,
     * push the full 16-channel frame to the controller, and ack the command.
     *
     * @param id the changed `dmx.CH<nn>` state id.
     * @param value the requested channel intensity (0–255; clamped by the library).
     */
    public async handleWrite(id: string, value: number): Promise<void> {
        const index = dmxChannelIndexFromId(id);
        if (index === null) {
            return;
        }
        try {
            if (!this.shadow) {
                this.shadow = await this.deps.getDmxService.update();
            }
            this.shadow.set(index, value);
            this.quietUntil = this.deps.now() + QUIET_WINDOW_MS;
            this.deps.log.debug(`Setting DMX channel ${index + 1} to ${value}`);
            await this.deps.dmxService.set(this.shadow);
            this.deps.ackCommand(id, value);
        } catch (e: unknown) {
            this.deps.log.error(`Failed to set DMX channel ${index + 1}: ${errorMessage(e)}`);
        }
    }
}
