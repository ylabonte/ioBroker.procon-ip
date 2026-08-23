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
  booleanFlagStateCommon: () => booleanFlagStateCommon,
  buildId: () => buildId,
  buildServiceConfig: () => buildServiceConfig,
  classifyCommand: () => classifyCommand,
  dataFieldStateCommon: () => dataFieldStateCommon,
  dmxChannelIndexFromId: () => dmxChannelIndexFromId,
  dmxChannelStateCommon: () => dmxChannelStateCommon,
  errorMessage: () => errorMessage,
  isExternalRelay: () => isExternalRelay,
  isLightLabel: () => isLightLabel,
  isRelayCategory: () => isRelayCategory,
  isTemperatureCategory: () => isTemperatureCategory,
  isTransientNetworkError: () => isTransientNetworkError,
  isValidURL: () => isValidURL,
  relayAutoStateCommon: () => relayAutoStateCommon,
  relayControlId: () => relayControlId,
  relayOnOffStateCommon: () => relayOnOffStateCommon,
  relayTimerId: () => relayTimerId,
  relayTimerStateCommon: () => relayTimerStateCommon,
  shouldUpdateState: () => shouldUpdateState,
  sysInfoStateCommon: () => sysInfoStateCommon
});
module.exports = __toCommonJS(mapping_exports);
var import_procon_ip = require("procon-ip");
function errorMessage(e) {
  return e instanceof Error ? e.message : String(e);
}
const TRANSIENT_NETWORK_CODES = /* @__PURE__ */ new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ECONNABORTED",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENETDOWN",
  "EAI_AGAIN"
]);
function isTransientNetworkError(e) {
  if (!e || typeof e !== "object") {
    return false;
  }
  const err = e;
  if (typeof err.code === "string" && TRANSIENT_NETWORK_CODES.has(err.code)) {
    return true;
  }
  if (err.name === "RequestTimeoutError") {
    return true;
  }
  const message = typeof err.message === "string" ? err.message : "";
  return /ECONNRESET|ETIMEDOUT|socket hang up|timed out/i.test(message);
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
function sysInfoStateCommon(key) {
  return { name: key, type: "string", role: "state", read: true, write: false };
}
function booleanFlagStateCommon(name) {
  return { name, type: "boolean", role: "indicator", read: true, write: false };
}
function dataFieldStateCommon(obj, field) {
  const common = {
    name: obj.label,
    type: typeof obj[field],
    role: "value",
    read: true,
    write: false
  };
  switch (field) {
    case "value":
      if (isTemperatureCategory(obj.category)) {
        common.role = "value.temperature";
        common.unit = `\xB0${obj.unit}`;
        if (obj.active) {
          common.smartName = { de: obj.label, en: obj.label, smartType: "THERMOSTAT" };
        }
      }
      break;
    case "category":
    case "label":
    case "unit":
    case "displayValue":
      common.role = "text";
      break;
    case "active":
      common.role = "indicator";
      break;
    default:
      return null;
  }
  return common;
}
function relayAutoStateCommon(obj, isLight) {
  return {
    name: obj.label,
    type: "boolean",
    role: "switch.mode.auto",
    read: true,
    write: true,
    smartName: obj.active ? { de: `${obj.label} auto`, en: `${obj.label} auto`, smartType: isLight ? "LIGHT" : "SWITCH" } : {}
  };
}
function relayOnOffStateCommon(obj, isLight, isDosageRelay) {
  return {
    name: obj.label,
    type: "boolean",
    role: isLight ? "switch.light" : "switch",
    read: true,
    write: !isDosageRelay,
    smartName: obj.active && !isDosageRelay ? { de: obj.label, en: obj.label, smartType: isLight ? "LIGHT" : "SWITCH" } : {}
  };
}
function relayTimerStateCommon(obj) {
  return { name: obj.label, type: "number", role: "value.interval", read: false, write: true };
}
function dmxChannelStateCommon(name) {
  return { name, type: "number", role: "level.dimmer", read: true, write: true, min: 0, max: 255 };
}
function dmxChannelIndexFromId(id) {
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  booleanFlagStateCommon,
  buildId,
  buildServiceConfig,
  classifyCommand,
  dataFieldStateCommon,
  dmxChannelIndexFromId,
  dmxChannelStateCommon,
  errorMessage,
  isExternalRelay,
  isLightLabel,
  isRelayCategory,
  isTemperatureCategory,
  isTransientNetworkError,
  isValidURL,
  relayAutoStateCommon,
  relayControlId,
  relayOnOffStateCommon,
  relayTimerId,
  relayTimerStateCommon,
  shouldUpdateState,
  sysInfoStateCommon
});
//# sourceMappingURL=mapping.js.map
