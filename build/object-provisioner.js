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
var object_provisioner_exports = {};
__export(object_provisioner_exports, {
  ObjectProvisioner: () => ObjectProvisioner
});
module.exports = __toCommonJS(object_provisioner_exports);
var import_procon_ip = require("procon-ip");
var import_mapping = require("./mapping");
class ObjectProvisioner {
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
  /**
   * Create the `info.system` channel, one state per raw sysinfo key, and the
   * derived boolean flag states (dosage-enabled flags + electrolysis).
   *
   * @param data the current sysinfo snapshot.
   */
  async provisionSysInfo(data) {
    await this.deps.setObjectNotExists(this.id("info", "system"), {
      type: "channel",
      common: { name: "SysInfo" },
      native: {}
    });
    for (const sysInfo of data.toArrayOfObjects()) {
      await this.deps.setObjectNotExists(this.id("info", "system", sysInfo.key), {
        type: "state",
        common: (0, import_mapping.sysInfoStateCommon)(sysInfo.key),
        native: {}
      });
    }
    await this.deps.setObjectNotExists(this.id("info", "system", "phPlusDosageEnabled"), {
      type: "state",
      common: (0, import_mapping.booleanFlagStateCommon)("pH+ enabled"),
      native: {}
    });
    await this.deps.setObjectNotExists(this.id("info", "system", "phMinusDosageEnabled"), {
      type: "state",
      common: (0, import_mapping.booleanFlagStateCommon)("pH- enabled"),
      native: {}
    });
    await this.deps.setObjectNotExists(this.id("info", "system", "chlorineDosageEnabled"), {
      type: "state",
      common: (0, import_mapping.booleanFlagStateCommon)("CL enabled"),
      native: {}
    });
    await this.deps.setObjectNotExists(this.id("info", "system", "electrolysis"), {
      type: "state",
      common: (0, import_mapping.booleanFlagStateCommon)("Electrolysis"),
      native: {}
    });
  }
  /**
   * Create a channel per category and the states for each data object.
   *
   * @param objects the controller data objects.
   */
  async provisionStateData(objects) {
    let lastObjCategory = "";
    for (const obj of objects) {
      if (lastObjCategory !== obj.category) {
        await this.deps.setObjectNotExists(this.id(obj.category), {
          type: "channel",
          common: { name: obj.category },
          native: {}
        });
        lastObjCategory = obj.category;
      }
      this.provisionDataObject(obj).catch(
        (e) => this.deps.log.error(`Failed setting objects for '${obj.label}': ${e}`)
      );
    }
  }
  async provisionDataObject(obj) {
    await this.deps.setObjectNotExists(this.id(obj.category, obj.categoryId), {
      type: "channel",
      common: { name: obj.label },
      native: {}
    });
    for (const field of Object.keys(obj)) {
      const common = (0, import_mapping.dataFieldStateCommon)(obj, field);
      if (!common) {
        continue;
      }
      try {
        await this.deps.setObjectNotExists(this.id(obj.category, obj.categoryId, field), {
          type: "state",
          common,
          native: obj
        });
      } catch (e) {
        this.deps.log.error(`Failed setting object '${obj.label}': ${(0, import_mapping.errorMessage)(e)}`);
      }
    }
    if (obj.category === import_procon_ip.GetStateCategory.RELAYS || obj.category === import_procon_ip.GetStateCategory.EXTERNAL_RELAYS && this.deps.isExtRelaysEnabled()) {
      await this.provisionRelayObject(obj);
    }
  }
  async provisionRelayObject(obj) {
    const isLight = (0, import_mapping.isLightLabel)(obj.label);
    const relayId = (0, import_mapping.relayControlId)(obj);
    const isDosageRelay = this.deps.isDosageControl(relayId);
    await this.deps.setObjectNotExists(this.id(obj.category, obj.categoryId, "auto"), {
      type: "state",
      common: (0, import_mapping.relayAutoStateCommon)(obj, isLight),
      native: obj
    });
    await this.deps.setObjectNotExists(this.id(obj.category, obj.categoryId, "onOff"), {
      type: "state",
      common: (0, import_mapping.relayOnOffStateCommon)(obj, isLight, isDosageRelay),
      native: obj
    });
    const timerChannel = isDosageRelay ? "dosageTimer" : "timer";
    await this.deps.setObjectNotExists(this.id(obj.category, obj.categoryId, timerChannel), {
      type: "state",
      common: (0, import_mapping.relayTimerStateCommon)(obj),
      native: obj
    });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ObjectProvisioner
});
//# sourceMappingURL=object-provisioner.js.map
