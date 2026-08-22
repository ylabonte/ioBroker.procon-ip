"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var dmx_controller_exports = {};
__export(dmx_controller_exports, {
  DmxController: () => DmxController
});
module.exports = __toCommonJS(dmx_controller_exports);
var import_mapping = require("./mapping");
const QUIET_WINDOW_MS = 1500;
class DmxController {
  deps;
  shadow = null;
  quietUntil = 0;
  /**
   * @param deps injected adapter collaborators.
   */
  constructor(deps) {
    this.deps = deps;
  }
  id(name) {
    return (0, import_mapping.buildId)(this.deps.namespace, "dmx", name);
  }
  /**
   * Whether the given state id is a writable DMX channel.
   *
   * @param id the state id to test.
   */
  isDmxChannel(id) {
    return (0, import_mapping.dmxChannelIndexFromId)(id) !== null;
  }
  /**
   * Poll the current DMX frame and publish each channel — unless we are inside
   * the post-write quiet window, where the optimistic shadow value stands. A
   * DMX read failure is logged and never breaks the main state poll.
   */
  async poll() {
    try {
      const data = await this.deps.getDmxService.update();
      this.shadow = data;
      if (this.deps.now() < this.quietUntil) {
        return;
      }
      for (const channel of data) {
        await this.deps.setStateChanged(this.id(channel.name), channel.value, true);
      }
    } catch (e) {
      this.deps.log.error(`Failed to poll DMX: ${(0, import_mapping.errorMessage)(e)}`);
    }
  }
  /**
   * Handle a write to a `dmx.CH<nn>` state: set the channel in the shadow,
   * push the full 16-channel frame to the controller, and ack the command.
   *
   * @param id the changed `dmx.CH<nn>` state id.
   * @param value the requested channel intensity (0–255; clamped by the library).
   */
  async handleWrite(id, value) {
    const index = (0, import_mapping.dmxChannelIndexFromId)(id);
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
    } catch (e) {
      this.deps.log.error(`Failed to set DMX channel ${index + 1}: ${(0, import_mapping.errorMessage)(e)}`);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DmxController
});
//# sourceMappingURL=dmx-controller.js.map
