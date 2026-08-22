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
var import_object_provisioner = require("./object-provisioner");
var import_state_publisher = require("./state-publisher");
class ProconIp extends import_adapter_core.Adapter {
  _relayDataInterpreter;
  _getStateService;
  _setStateService;
  _usrcfgCgiService;
  _commandService;
  _commandHandler;
  _objectProvisioner;
  _statePublisher;
  _forceUpdate;
  _stateData;
  _bootstrapped = false;
  _objectsCreated = false;
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
    await this.setStateChangedAsync("info.connection", false, true);
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
      setStateService: this._setStateService,
      ackCommand: (id, value) => {
        void this.setState(id, value, true).catch(() => {
        });
      }
    });
    this._objectProvisioner = new import_object_provisioner.ObjectProvisioner({
      log: this.log,
      namespace: this.namespace,
      getObject: (id) => this.getObjectAsync(id),
      extendObject: (id, obj) => this.extendObjectAsync(id, obj),
      isDosageControl: (relayId) => this._getStateService.data.isDosageControl(relayId),
      isExtRelaysEnabled: () => this._stateData.sysInfo.isExtRelaysEnabled()
    });
    this._statePublisher = new import_state_publisher.StatePublisher({
      log: this.log,
      namespace: this.namespace,
      setStateChanged: (id, value, ack) => this.setStateChangedAsync(id, value, ack),
      getObject: (id) => this.getObjectAsync(id),
      setObject: async (id, obj) => this.setObject(id, obj),
      getStatesOf: (id) => this.getStatesOfAsync(id),
      relayDataInterpreter: this._relayDataInterpreter,
      isExtRelaysEnabled: () => this._stateData.sysInfo.isExtRelaysEnabled()
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
    this._getStateService.start(
      async (data) => {
        this.log.silly(`Start processing new GetState.csv`);
        connectionApproved = true;
        connectErrorLogged = false;
        await this.bootstrapObjects(data);
        data.sysInfo.toArrayOfObjects().forEach((info) => {
          if (!this._bootstrapped || info.value !== this._stateData.sysInfo[info.key]) {
            this._statePublisher.publishSysInfoState(info.key, info.value);
          }
        });
        this._statePublisher.publishAdvancedSysInfo(data.sysInfo, {
          bootstrapped: this._bootstrapped,
          previousDosageControl: this._stateData.sysInfo.dosageControl
        });
        data.objects.forEach((obj) => {
          const previous = this._stateData.getDataObject(obj.id);
          this.log.silly(`Processing '${obj.label}' (${obj.category}) \u2014 current value: ${obj.displayValue}`);
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
              this._statePublisher.updateObjectCommonName(obj).catch((e) => {
                this.log.error(`Failed fixing label for '${obj.label}': ${(0, import_mapping.errorMessage)(e)}`);
              });
            }
            this.log.debug(`Updating value for '${obj.label}' (${obj.category})`);
            this._statePublisher.publishDataState(obj);
            if (forceObjStateUpdate > -1) {
              this._forceUpdate.splice(forceObjStateUpdate, 1);
            }
          }
        });
        this.log.silly(`Updating data object for next comparison`);
        this._stateData = data;
        this._bootstrapped = true;
        this.setStateChangedAsync("info.connection", true, true).catch(() => {
        });
      },
      (e) => {
        this.setStateChangedAsync("info.connection", false, true).catch(() => {
        });
        if (!connectionApproved && !connectErrorLogged) {
          connectErrorLogged = true;
          this.log.warn(
            `Could not connect to the controller (${e instanceof Error ? e.message : String(e)}). Retrying until it becomes available.`
          );
        }
      }
    );
    for (const category of ["relays", "externalRelays"]) {
      for (const suffix of ["onOff", "auto", "timer", "dosageTimer"]) {
        this.subscribeStates(`${category}.*.${suffix}`);
      }
    }
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
    await this._objectProvisioner.provisionSysInfo(data.sysInfo);
    await this._objectProvisioner.provisionStateData(data.objects);
    this._objectsCreated = true;
  }
  // Is called when adapter shuts down - callback has to be called under any circumstances!
  onUnload(callback) {
    var _a;
    try {
      (_a = this._getStateService) == null ? void 0 : _a.stop();
      this.setStateChangedAsync("info.connection", false, true).catch(() => {
      });
    } catch (e) {
      this.log.error(`Failed to stop GetState service: ${String(e)}`);
    } finally {
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
