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
var mapping_exports = {};
__export(mapping_exports, {
  buildId: () => buildId,
  buildServiceConfig: () => buildServiceConfig,
  classifyCommand: () => classifyCommand,
  errorMessage: () => errorMessage,
  isExternalRelay: () => isExternalRelay,
  isLightLabel: () => isLightLabel,
  isRelayCategory: () => isRelayCategory,
  isTemperatureCategory: () => isTemperatureCategory,
  isValidURL: () => isValidURL,
  relayControlId: () => relayControlId,
  relayTimerId: () => relayTimerId,
  shouldUpdateState: () => shouldUpdateState
});
module.exports = __toCommonJS(mapping_exports);
var import_procon_ip = require("procon-ip");
function errorMessage(e) {
  return e instanceof Error ? e.message : String(e);
}
function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
function isExternalRelay(obj) {
  return obj.category === String(import_procon_ip.GetStateCategory.EXTERNAL_RELAYS);
}
function isRelayCategory(category) {
  return category === import_procon_ip.GetStateCategory.RELAYS || category === import_procon_ip.GetStateCategory.EXTERNAL_RELAYS;
}
function isTemperatureCategory(category) {
  return category === import_procon_ip.GetStateCategory.TEMPERATURES;
}
function relayControlId(obj) {
  return obj.categoryId + (isExternalRelay(obj) ? 8 : 0);
}
function relayTimerId(obj) {
  return obj.categoryId + (isExternalRelay(obj) ? 9 : 1);
}
function classifyCommand(id) {
  if (id.endsWith(".auto")) {
    return "auto";
  }
  if (id.endsWith(".onOff")) {
    return "onOff";
  }
  if (id.endsWith(".dosageTimer")) {
    return "dosageTimer";
  }
  if (id.endsWith(".timer")) {
    return "timer";
  }
  return null;
}
function isLightLabel(label) {
  return /light|bulb|licht|leucht/i.test(label);
}
function shouldUpdateState(args) {
  return !args.bootstrapped || args.forced || args.hasPrevious && args.previousValue != args.currentValue;
}
function buildId(namespace, ...parts) {
  return [namespace, ...parts].join(".");
}
function buildServiceConfig(config) {
  return Object.defineProperties(Object.create(config), {
    timeout: {
      value: config.requestTimeout,
      writable: true
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildId,
  buildServiceConfig,
  classifyCommand,
  errorMessage,
  isExternalRelay,
  isLightLabel,
  isRelayCategory,
  isTemperatureCategory,
  isValidURL,
  relayControlId,
  relayTimerId,
  shouldUpdateState
});
//# sourceMappingURL=mapping.js.map
