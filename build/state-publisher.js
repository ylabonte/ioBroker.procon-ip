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
var state_publisher_exports = {};
__export(state_publisher_exports, {
  StatePublisher: () => StatePublisher
});
module.exports = __toCommonJS(state_publisher_exports);
var import_procon_ip = require("procon-ip");
var import_mapping = require("./mapping");
const PUBLISHED_FIELDS = ["value", "category", "label", "unit", "displayValue", "active"];
class StatePublisher {
  deps;
  /**
   * @param deps injected adapter collaborators.
   */
  constructor(deps) {
    this.deps = deps;
  }
  id(...parts) {
    return (0, import_mapping.buildId)(this.deps.namespace, ...parts);
  }
  isRelayToPublish(obj) {
    return obj.category === import_procon_ip.GetStateCategory.RELAYS || obj.category === import_procon_ip.GetStateCategory.EXTERNAL_RELAYS && this.deps.isExtRelaysEnabled();
  }
  /**
   * Publish a single raw sysinfo state (`info.system.<key>`).
   *
   * @param key the sysinfo key.
   * @param value the sysinfo value (stringified for the state).
   */
  publishSysInfoState(key, value) {
    this.deps.log.debug(`Updating sys info state ${key}: ${value}`);
    this.deps.setStateChanged(this.id("info", "system", key), String(value), true).catch((e) => {
      this.deps.log.error(`Failed setting state for '${key}': ${e}`);
    });
  }
  /**
   * Publish the derived dosage-enabled / electrolysis flags — but only when
   * bootstrapping or when the controller's dosage-control byte changed.
   *
   * @param sysInfo the current sysinfo snapshot.
   * @param opts change-detection context.
   * @param opts.bootstrapped whether the first publish pass has completed.
   * @param opts.previousDosageControl the dosage-control byte from the last snapshot.
   */
  publishAdvancedSysInfo(sysInfo, opts) {
    this.deps.setStateChanged(this.id("info", "system", "dmxEnabled"), sysInfo.isDmxEnabled(), true).catch((e) => {
      this.deps.log.error(`Failed setting state for '${this.id("info", "system", "dmxEnabled")}': ${e}`);
    });
    if (opts.bootstrapped && sysInfo.dosageControl === opts.previousDosageControl) {
      return;
    }
    this.deps.log.debug("Updating advanced sys info states");
    const flags = [
      ["phPlusDosageEnabled", sysInfo.isPhPlusDosageEnabled()],
      ["phMinusDosageEnabled", sysInfo.isPhMinusDosageEnabled()],
      ["chlorineDosageEnabled", sysInfo.isChlorineDosageEnabled()],
      ["electrolysis", sysInfo.isElectrolysis()]
    ];
    for (const [key, value] of flags) {
      this.deps.setStateChanged(this.id("info", "system", key), value, true).catch((e) => {
        this.deps.log.error(`Failed setting state for '${this.id("info", "system", key)}': ${e}`);
      });
    }
  }
  /**
   * Publish a data object's field states (and, for relays, its switch states).
   *
   * @param obj the controller data object.
   */
  publishDataState(obj) {
    for (const field of Object.keys(obj).filter((f) => PUBLISHED_FIELDS.indexOf(f) > -1)) {
      this.deps.setStateChanged(this.id(obj.category, obj.categoryId, field), obj[field], true).catch((e) => {
        this.deps.log.error(`Failed setting state for '${obj.label}': ${e}`);
      });
    }
    if (this.isRelayToPublish(obj)) {
      this.publishRelayState(obj);
    }
  }
  /**
   * Publish a relay's `.auto` and `.onOff` switch states.
   *
   * @param obj the relay data object.
   */
  publishRelayState(obj) {
    this.deps.setStateChanged(
      this.id(obj.category, obj.categoryId, "auto"),
      this.deps.relayDataInterpreter.isAuto(obj),
      true
    ).catch((e) => {
      this.deps.log.error(`Failed setting auto/manual switch state for '${obj.label}': ${e}`);
    });
    this.deps.setStateChanged(
      this.id(obj.category, obj.categoryId, "onOff"),
      this.deps.relayDataInterpreter.isOn(obj),
      true
    ).catch((e) => {
      this.deps.log.error(`Failed setting onOff switch state for '${obj.label}': ${e}`);
    });
  }
  /**
   * Sync an object's (and its states') `common.name` to the controller label.
   *
   * @param obj the controller data object whose label changed.
   */
  async updateObjectCommonName(obj) {
    const objId = this.id(obj.category, obj.categoryId);
    const ioObj = await this.deps.getObject(objId);
    if (ioObj) {
      ioObj.common.name = obj.label;
      await this.deps.setObject(objId, ioObj);
    }
    const objStates = await this.deps.getStatesOf(objId);
    if (objStates) {
      for (const state of objStates) {
        state.common.name = obj.label;
        await this.deps.setObject(state._id, state);
      }
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  StatePublisher
});
//# sourceMappingURL=state-publisher.js.map
