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
var main_exports = {};
__export(main_exports, {
  ProconIp: () => ProconIp
});
module.exports = __toCommonJS(main_exports);
var import_adapter_core = require("@iobroker/adapter-core");
var import_procon_ip = require("procon-ip");
var import_mapping = require("./mapping");
var import_command_handler = require("./command-handler");
class ProconIp extends import_adapter_core.Adapter {
  _relayDataInterpreter;
  _getStateService;
  _setStateService;
  _usrcfgCgiService;
  _commandService;
  _commandHandler;
  _forceUpdate;
  _stateData;
  _bootstrapped = false;
  _objectsCreated = false;
  _objectStateFields = ["value", "category", "label", "unit", "displayValue", "active"];
  _timeout = null;
  /**
   * @param options adapter options forwarded to the ioBroker `Adapter` base;
   *   the adapter name is always `procon-ip`.
   */
  constructor(options = {}) {
    super({
      ...options,
      name: "procon-ip"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this._forceUpdate = new Array();
    this._stateData = new import_procon_ip.GetStateData();
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    let connectionApproved = false;
    let connectErrorLogged = false;
    await this.setState("info.connection", false, true);
    if (this.config.controllerUrl.length < 1 || !(0, import_mapping.isValidURL)(this.config.controllerUrl)) {
      this.log.warn(`Invalid controller URL ('${this.config.controllerUrl}') supplied.`);
      return;
    }
    const serviceConfig = (0, import_mapping.buildServiceConfig)(this.config);
    this._relayDataInterpreter = new import_procon_ip.RelayDataInterpreter(this.log);
    this._getStateService = new import_procon_ip.GetStateService(serviceConfig, this.log);
    this._setStateService = new import_procon_ip.SetStateService(serviceConfig, this.log);
    this._usrcfgCgiService = new import_procon_ip.UsrcfgCgiService(
      serviceConfig,
      this.log,
      this._getStateService,
      this._relayDataInterpreter
    );
    this._commandService = new import_procon_ip.CommandService(serviceConfig, this.log);
    this._commandHandler = new import_command_handler.CommandHandler({
      log: this.log,
      getObject: (id) => this.getObjectAsync(id),
      getState: (id) => this.getStateAsync(id),
      getStateData: () => this._stateData,
      markForceUpdate: (id) => this._forceUpdate.push(id),
      usrcfgCgiService: this._usrcfgCgiService,
      commandService: this._commandService,
      setStateService: this._setStateService
    });
    this.log.debug(`GetStateService url: ${this._getStateService.url}`);
    this.log.debug(`UsrcfgCgiService url: ${this._usrcfgCgiService.url}`);
    try {
      const initialData = await this._getStateService.update();
      this._stateData = initialData;
      await this.bootstrapObjects(initialData);
    } catch (e) {
      this.log.warn(
        `Could not reach the controller at startup (${e instanceof Error ? e.message : String(e)}). Will keep polling until it becomes available.`
      );
    }
    this._timeout = setTimeout(() => {
      this._getStateService.start(
        async (data) => {
          this.log.silly(`Start processing new GetState.csv`);
          connectionApproved = true;
          connectErrorLogged = false;
          await this.bootstrapObjects(data);
          data.sysInfo.toArrayOfObjects().forEach((info) => {
            if (!this._bootstrapped || info.value !== this._stateData.sysInfo[info.key]) {
              this.log.debug(`Updating sys info state ${info.key}: ${info.value}`);
              this.setState(
                `${this.name}.${this.instance}.info.system.${info.key}`,
                info.value.toString(),
                true
              ).catch((e) => {
                this.log.error(`Failed setting state for '${info.key}': ${e}`);
              });
            }
          });
          this.updateAdvancedSysInfoStates(data.sysInfo);
          data.objects.forEach((obj) => {
            const previous = this._stateData.getDataObject(obj.id);
            this.log.silly(
              `Processing '${obj.label}' (${obj.category}) \u2014 current value: ${obj.displayValue}`
            );
            const forceObjStateUpdate = this._forceUpdate.indexOf(obj.id);
            if ((0, import_mapping.shouldUpdateState)({
              bootstrapped: this._bootstrapped,
              forced: forceObjStateUpdate >= 0,
              hasPrevious: !!previous,
              previousValue: previous == null ? void 0 : previous.value,
              currentValue: obj.value
            })) {
              if (previous && previous.label != obj.label) {
                this.log.debug(`Updating label for '${obj.label}' (${obj.category})`);
                this.updateObjectCommonName(obj).catch((e) => {
                  this.log.error(`Failed fixing label for '${obj.label}': ${(0, import_mapping.errorMessage)(e)}`);
                });
              }
              this.log.debug(`Updating value for '${obj.label}' (${obj.category})`);
              this.setDataState(obj);
              if (forceObjStateUpdate > -1) {
                this._forceUpdate.splice(forceObjStateUpdate, 1);
              }
            }
          });
          this.log.silly(`Updating data object for next comparison`);
          this._stateData = data;
          this._bootstrapped = true;
          this.setState("info.connection", true, true).catch(() => {
          });
        },
        (e) => {
          this.setState("info.connection", false, true).catch(() => {
          });
          if (!connectionApproved && !connectErrorLogged) {
            connectErrorLogged = true;
            this.log.warn(
              `Could not connect to the controller (${e instanceof Error ? e.message : String(e)}). Retrying until it becomes available.`
            );
          }
        }
      );
    }, 300);
    this.subscribeStates(`${this.name}.${this.instance}.relays.*`);
    this.subscribeStates(`${this.name}.${this.instance}.externalRelays.*`);
  }
  /**
   * Create the adapter's objects. Runs once — either on startup or, if the
   * controller was unreachable then, on the first successful poll.
   *
   * @param data the current controller state used to derive the objects
   */
  async bootstrapObjects(data) {
    if (this._objectsCreated) {
      return;
    }
    this.log.debug(`Initially setting adapter objects`);
    await this.setSysInfoObjectsNotExists(data.sysInfo);
    await this.setStateDataObjectsNotExists(data.objects);
    this._objectsCreated = true;
  }
  // Is called when adapter shuts down - callback has to be called under any circumstances!
  onUnload(callback) {
    var _a;
    try {
      (_a = this._getStateService) == null ? void 0 : _a.stop();
      this.setState("info.connection", false, true).catch(() => {
      });
    } catch (e) {
      this.log.error(`Failed to stop GetState service: ${String(e)}`);
    } finally {
      if (this._timeout) {
        clearTimeout(this._timeout);
      }
      callback();
    }
  }
  // Is called if a subscribed state changes
  onStateChange(id, state) {
    if (!state) {
      this.log.info(`state ${id} deleted`);
      return;
    }
    if (state.ack) {
      return;
    }
    this._commandHandler.dispatch(id, state);
  }
  updateAdvancedSysInfoStates(sysInfo) {
    if (!this._bootstrapped || sysInfo.dosageControl !== this._stateData.sysInfo.dosageControl) {
      this.log.debug("Updating advanced sys info states");
      this.setState(
        `${this.name}.${this.instance}.info.system.phPlusDosageEnabled`,
        sysInfo.isPhPlusDosageEnabled(),
        true
      ).catch((e) => {
        this.log.error(
          `Failed setting state for '${this.name}.${this.instance}.info.system.phPlusDosageEnabled': ${e}`
        );
      });
      this.setState(
        `${this.name}.${this.instance}.info.system.phMinusDosageEnabled`,
        sysInfo.isPhMinusDosageEnabled(),
        true
      ).catch((e) => {
        this.log.error(
          `Failed setting state for '${this.name}.${this.instance}.info.system.phMinusDosageEnabled': ${e}`
        );
      });
      this.setState(
        `${this.name}.${this.instance}.info.system.chlorineDosageEnabled`,
        sysInfo.isChlorineDosageEnabled(),
        true
      ).catch((e) => {
        this.log.error(
          `Failed setting state for '${this.name}.${this.instance}.info.system.chlorineDosageEnabled': ${e}`
        );
      });
      this.setState(
        `${this.name}.${this.instance}.info.system.electrolysis`,
        sysInfo.isElectrolysis(),
        true
      ).catch((e) => {
        this.log.error(`Failed setting state for '${this.name}.${this.instance}.info.electrolysis': ${e}`);
      });
    }
  }
  async setSysInfoObjectsNotExists(data) {
    await this.setObjectNotExists(`${this.name}.${this.instance}.info.system`, {
      type: "channel",
      common: {
        name: "SysInfo"
      },
      native: {}
    });
    for (const sysInfo of data.toArrayOfObjects()) {
      await this.setObjectNotExists(`${this.name}.${this.instance}.info.system.${sysInfo.key}`, {
        type: "state",
        common: {
          name: sysInfo.key,
          type: "string",
          role: "state",
          read: true,
          write: false
        },
        native: {}
      });
    }
    await this.setObjectNotExists(`${this.name}.${this.instance}.info.system.phPlusDosageEnabled`, {
      type: "state",
      common: {
        name: "pH+ enabled",
        type: "boolean",
        role: "state",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setObjectNotExists(`${this.name}.${this.instance}.info.system.phMinusDosageEnabled`, {
      type: "state",
      common: {
        name: "pH- enabled",
        type: "boolean",
        role: "state",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setObjectNotExists(`${this.name}.${this.instance}.info.system.chlorineDosageEnabled`, {
      type: "state",
      common: {
        name: "CL enabled",
        type: "boolean",
        role: "state",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setObjectNotExists(`${this.name}.${this.instance}.info.system.electrolysis`, {
      type: "state",
      common: {
        name: "Electrolysis",
        type: "boolean",
        role: "state",
        read: true,
        write: false
      },
      native: {}
    });
  }
  async setStateDataObjectsNotExists(objects) {
    let lastObjCategory = "";
    for (const obj of objects) {
      if (lastObjCategory !== obj.category) {
        await this.setObjectNotExists(`${this.name}.${this.instance}.${obj.category}`, {
          type: "channel",
          common: {
            name: obj.category
          },
          native: {}
        });
        lastObjCategory = obj.category;
      }
      this.setDataObjectNotExists(obj).catch((e) => {
        this.log.error(`Failed setting objects for '${obj.label}': ${e}`);
      });
    }
  }
  async setDataObjectNotExists(obj) {
    await this.setObjectNotExists(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}`, {
      type: "channel",
      common: {
        name: obj.label
      },
      native: {}
    });
    for (const field of Object.keys(obj)) {
      const common = {
        name: obj.label,
        type: typeof obj[field],
        role: "value",
        read: true,
        write: false
      };
      switch (field) {
        case "value":
          if ((0, import_mapping.isTemperatureCategory)(obj.category)) {
            common.role = "value.temperature";
            common.unit = `\xB0${obj.unit}`;
            if (obj.active) {
              common.smartName = {
                de: obj.label,
                en: obj.label,
                smartType: "THERMOSTAT"
              };
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
          continue;
      }
      try {
        await this.setObjectNotExists(
          `${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.${field}`,
          {
            type: "state",
            common,
            native: obj
          }
        );
      } catch (e) {
        this.log.error(`Failed setting object '${obj.label}': ${(0, import_mapping.errorMessage)(e)}`);
      }
    }
    if (obj.category === import_procon_ip.GetStateCategory.RELAYS || obj.category === import_procon_ip.GetStateCategory.EXTERNAL_RELAYS && this._stateData.sysInfo.isExtRelaysEnabled()) {
      await this.setRelayDataObject(obj);
    }
  }
  async setRelayDataObject(obj) {
    const isLight = (0, import_mapping.isLightLabel)(obj.label);
    const relayId = (0, import_mapping.relayControlId)(obj);
    const isDosageRelay = this._getStateService.data.isDosageControl(relayId);
    const commonAuto = {
      name: obj.label,
      type: "boolean",
      role: "switch.mode.auto",
      read: true,
      write: true,
      smartName: obj.active ? {
        de: `${obj.label} auto`,
        en: `${obj.label} auto`,
        smartType: isLight ? "LIGHT" : "SWITCH"
      } : {}
    };
    const commonOnOff = {
      name: obj.label,
      type: "boolean",
      role: isLight ? "switch.light" : "switch",
      read: true,
      write: !isDosageRelay,
      smartName: obj.active && !isDosageRelay ? {
        de: obj.label,
        en: obj.label,
        smartType: isLight ? "LIGHT" : "SWITCH"
      } : {}
    };
    await this.setObjectNotExists(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.auto`, {
      type: "state",
      common: commonAuto,
      native: obj
    });
    await this.setObjectNotExists(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.onOff`, {
      type: "state",
      common: commonOnOff,
      native: obj
    });
    if (isDosageRelay) {
      const commonDosageTimerState = {
        name: obj.label,
        type: "number",
        role: "value.interval",
        read: false,
        write: true
      };
      await this.setObjectNotExists(
        `${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.dosageTimer`,
        {
          type: "state",
          common: commonDosageTimerState,
          native: obj
        }
      );
    } else {
      const commonGenericRelayTimerState = {
        name: obj.label,
        type: "number",
        role: "value.interval",
        read: false,
        write: true
      };
      await this.setObjectNotExists(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.timer`, {
        type: "state",
        common: commonGenericRelayTimerState,
        native: obj
      });
    }
  }
  setDataState(obj) {
    for (const field of Object.keys(obj).filter((field2) => this._objectStateFields.indexOf(field2) > -1)) {
      this.setState(
        `${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.${field}`,
        obj[field],
        true
      ).catch((e) => {
        this.log.error(`Failed setting state for '${obj.label}': ${e}`);
      });
    }
    if (obj.category === import_procon_ip.GetStateCategory.RELAYS || obj.category === import_procon_ip.GetStateCategory.EXTERNAL_RELAYS && this._stateData.sysInfo.isExtRelaysEnabled()) {
      this.setRelayDataState(obj);
    }
  }
  setRelayDataState(obj) {
    this.setState(
      `${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.auto`,
      this._relayDataInterpreter.isAuto(obj),
      true
    ).catch((e) => {
      this.log.error(`Failed setting auto/manual switch state for '${obj.label}': ${e}`);
    });
    this.setState(
      `${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.onOff`,
      this._relayDataInterpreter.isOn(obj),
      true
    ).catch((e) => {
      this.log.error(`Failed setting onOff switch state for '${obj.label}': ${e}`);
    });
  }
  async updateObjectCommonName(obj) {
    const objId = `${this.name}.${this.instance}.${obj.category}.${obj.categoryId}`;
    const ioObj = await this.getObjectAsync(objId);
    if (ioObj) {
      ioObj.common.name = obj.label;
      await this.setObject(objId, ioObj);
    }
    const objStates = await this.getStatesOfAsync(objId);
    if (objStates) {
      for (const state of objStates) {
        state.common.name = obj.label;
        await this.setObject(state._id, state);
      }
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new ProconIp(options);
} else {
  (() => new ProconIp())();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ProconIp
});
//# sourceMappingURL=main.js.map
