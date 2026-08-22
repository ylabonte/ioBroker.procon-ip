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
var command_handler_exports = {};
__export(command_handler_exports, {
  CommandHandler: () => CommandHandler
});
module.exports = __toCommonJS(command_handler_exports);
var import_mapping = require("./mapping");
class CommandHandler {
  deps;
  /**
   * @param deps injected adapter/runtime collaborators.
   */
  constructor(deps) {
    this.deps = deps;
  }
  /**
   * Route a changed state to the matching command handler by its id suffix.
   * Non-command ids are ignored. Handler rejections are logged, never thrown.
   *
   * @param id the full id of the changed state.
   * @param state the new (unacknowledged) state.
   */
  dispatch(id, state) {
    switch ((0, import_mapping.classifyCommand)(id)) {
      case "auto":
        this.relayToggleAuto(id, state).catch((e) => this.deps.log.error(`Error on relay toggle (${id}): ${e}`));
        break;
      case "onOff":
        this.relayToggleOnOff(id, state).catch((e) => this.deps.log.error(`Error on relay toggle (${id}): ${e}`));
        break;
      case "dosageTimer":
        this.setDosageTimer(id, state).catch((e) => this.deps.log.error(`Error on manual dosage (${id}): ${e}`));
        break;
      case "timer":
        this.setRelayTimer(id, state).catch((e) => this.deps.log.error(`Error on relay timer (${id}): ${e}`));
        break;
    }
  }
  async resolveObject(objectId) {
    const obj = await this.deps.getObject(objectId);
    if (!obj) {
      throw new Error(`Cannot handle state change for non-existent object '${objectId}'`);
    }
    return obj;
  }
  /**
   * Toggle a relay to auto (when the incoming value is truthy) or to its
   * current on/off state otherwise.
   *
   * @param objectId the `.auto` state id.
   * @param state the new state.
   */
  async relayToggleAuto(objectId, state) {
    const onOffState = await this.deps.getState(objectId.replace(/\.auto$/, ".onOff"));
    if (!onOffState) {
      throw new Error(`Cannot get onOff state to toggle '${objectId}'`);
    }
    const obj = await this.resolveObject(objectId);
    const dataObject = this.deps.getStateData().getDataObject(Number(obj.native.id));
    this.deps.markForceUpdate(dataObject.id);
    try {
      if (state.val) {
        this.deps.log.info(`Switching ${obj.native.label}: auto`);
        await this.deps.usrcfgCgiService.setAuto(dataObject);
      } else if (onOffState.val) {
        this.deps.log.info(`Switching ${obj.native.label}: on`);
        await this.deps.usrcfgCgiService.setOn(dataObject);
      } else {
        this.deps.log.info(`Switching ${obj.native.label}: off`);
        await this.deps.usrcfgCgiService.setOff(dataObject);
      }
      this.deps.ackCommand(objectId, state.val);
    } catch (e) {
      this.deps.log.error(`Error on switching operation: ${(0, import_mapping.errorMessage)(e)}`);
    }
  }
  /**
   * Switch a relay on or off according to the incoming boolean value.
   *
   * @param objectId the `.onOff` state id.
   * @param state the new state.
   */
  async relayToggleOnOff(objectId, state) {
    const obj = await this.resolveObject(objectId);
    const dataObject = this.deps.getStateData().getDataObject(Number(obj.native.id));
    this.deps.markForceUpdate(dataObject.id);
    try {
      if (state.val) {
        this.deps.log.info(`Switching ${obj.native.label}: on`);
        await this.deps.usrcfgCgiService.setOn(dataObject);
      } else {
        this.deps.log.info(`Switching ${obj.native.label}: off`);
        await this.deps.usrcfgCgiService.setOff(dataObject);
      }
      this.deps.ackCommand(objectId, state.val);
    } catch (e) {
      this.deps.log.error(`Error on switching operation: ${(0, import_mapping.errorMessage)(e)}`);
    }
  }
  /**
   * Start a manual dosage for the relay's dosage-control channel (chlorine,
   * pH-minus or pH-plus, selected by the relay's control id).
   *
   * @param objectId the `.dosageTimer` state id.
   * @param state the new state (dosage duration in seconds).
   */
  async setDosageTimer(objectId, state) {
    const obj = await this.resolveObject(objectId);
    const dataObject = this.deps.getStateData().getDataObject(Number(obj.native.id));
    const relayId = (0, import_mapping.relayControlId)(dataObject);
    this.deps.markForceUpdate(dataObject.id);
    try {
      const stateValNumber = state.val;
      const data = this.deps.getStateData();
      if (relayId === data.getChlorineDosageControlId()) {
        await this.deps.commandService.setChlorineDosage(stateValNumber);
      } else if (relayId === data.getPhMinusDosageControlId()) {
        await this.deps.commandService.setPhMinusDosage(stateValNumber);
      } else if (relayId === data.getPhPlusDosageControlId()) {
        await this.deps.commandService.setPhPlusDosage(stateValNumber);
      }
      this.deps.log.info(`Setting dosage timer ${obj.native.label} for ${state.val} seconds`);
      this.deps.ackCommand(objectId, state.val);
    } catch (e) {
      this.deps.log.error(`Error setting dosage timer: ${(0, import_mapping.errorMessage)(e)}`);
    }
  }
  /**
   * Set the run timer for a (non-dosage) relay.
   *
   * @param objectId the `.timer` state id.
   * @param state the new state (timer duration in seconds).
   */
  async setRelayTimer(objectId, state) {
    const obj = await this.resolveObject(objectId);
    const dataObject = this.deps.getStateData().getDataObject(Number(obj.native.id));
    const relayId = (0, import_mapping.relayTimerId)(dataObject);
    this.deps.markForceUpdate(dataObject.id);
    try {
      const stateValNumber = state.val;
      await this.deps.setStateService.setTimer(relayId, stateValNumber);
      this.deps.log.info(`Setting timer for ${obj.native.label} to ${state.val} seconds`);
      this.deps.ackCommand(objectId, state.val);
    } catch (e) {
      this.deps.log.error(`Error setting relay timer: ${(0, import_mapping.errorMessage)(e)}`);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CommandHandler
});
//# sourceMappingURL=command-handler.js.map
