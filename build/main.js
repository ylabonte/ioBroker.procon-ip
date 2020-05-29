"use strict";
/*
 * Created with @iobroker/create-adapter v1.15.1
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const get_state_service_1 = require("./lib/get-state.service");
const usrcfg_cgi_service_1 = require("./lib/usrcfg-cgi.service");
const relay_data_interpreter_1 = require("./lib/relay-data-interpreter");
const get_state_data_1 = require("./lib/get-state-data");
const crypto = require("crypto-js");
class ProconIp extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: "procon-ip" }));
        this._objectsCreated = false;
        this.on("ready", this.onReady.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.forceUpdate = new Array();
        this._stateData = new get_state_data_1.GetStateData();
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        return __awaiter(this, void 0, void 0, function* () {
            this.getForeignObject("system.config", (err, obj) => {
                for (const setting in this.config) {
                    if (typeof this.config[setting] !== "boolean" && isNaN(this.config[setting]) &&
                        (!this.supportsFeature || !this.supportsFeature("ADAPTER_AUTO_DECRYPT_NATIVE"))) {
                        //noinspection JSUnresolvedVariable
                        if (typeof obj !== "undefined" && obj.native && obj.native.secret) {
                            //noinspection JSUnresolvedVariable
                            this.config[setting] = crypto.AES.decrypt(this.config[setting], obj.native.secret).toString(crypto.enc.Utf8);
                        }
                        else {
                            //noinspection JSUnresolvedVariable
                            this.log.warn("Cannot get native secret for encryption. Falling back to hard coded default key!");
                            this.config[setting] = crypto.AES.decrypt(this.config[setting], "Jp#q|]-g/^.m7+xHeu").toString(crypto.enc.Utf8);
                        }
                    }
                }
                // The adapters config (in the instance object everything under the attribute "native") is accessible via
                // this.config:
                this.log.debug("config controllerUrl: " + this.config.controllerUrl);
                this.log.debug("config basicAuth: " + this.config.basicAuth);
                this.log.debug("config updateInterval: " + this.config.updateInterval);
                this.relayDataInterpreter = new relay_data_interpreter_1.RelayDataInterpreter(this.log);
                this.getStateService = new get_state_service_1.GetStateService(this);
                this.usrcfgCgiService = new usrcfg_cgi_service_1.UsrcfgCgiService(this.config, this.log, this.getStateService, this.relayDataInterpreter);
                this.log.debug(`GetStateService url: ${this.getStateService.url}`);
                this.log.debug(`UsrcfgCgiService url: ${this.usrcfgCgiService.url}`);
                let firstRun = true;
                this.getStateService.start((data) => {
                    // Set objects once
                    if (firstRun) {
                        this.setSysInfo(data.sysInfo);
                        this.setObjects(data.objects);
                    }
                    // Set sys info states
                    data.sysInfo.toArrayOfObjects().forEach((info) => {
                        // Only update when value has changed
                        if (firstRun || info.value !== this._stateData.sysInfo[info.key]) {
                            this.log.debug(`Updating sys info state ${info.key}: ${info.value}`);
                            this.setStateAsync(`${this.name}.${this.instance}.${info.key}`, info.value, true).catch((e) => {
                                this.log.error(`Failed setting state for '${info.key}': ${e}`);
                            });
                        }
                    });
                    // Set object states
                    data.objects.forEach((obj) => {
                        // Only update when value has changed or update is forced (on state change)
                        const force = this.forceUpdate.indexOf(obj.id);
                        if (firstRun || force >= 0 || (this._stateData.getDataObject(obj.id) && obj.value !== this._stateData.getDataObject(obj.id).value)) {
                            this.setDataState(obj);
                            if (this.forceUpdate[force]) {
                                delete this.forceUpdate[force];
                            }
                        }
                    });
                    this._stateData = new get_state_data_1.GetStateData(data.raw);
                    firstRun = false;
                });
                this.subscribeStates(`${this.name}.${this.instance}.relays.*`);
                this.subscribeStates(`${this.name}.${this.instance}.externalRelays.*`);
                this.setState("info.connection", true, true);
                this.setState("info.Info.alive", true, true);
            });
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            this.log.info("cleaned everything up...");
            this.setState("info.connection", false, true);
            this.setState("info.Info.alive", false, true);
            callback();
        }
        catch (e) {
            callback();
        }
    }
    /**
     * Is called if a subscribed object changes
     */
    // private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }
    /**
     * Is called if a subscribed state changes
     */
    onStateChange(id, state) {
        if (!state) {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
            return;
        }
        if (state.ack) {
            // The state is already acknowledged -> no need to change anything
            return;
        }
        if (id.endsWith(".auto")) {
            this.relayToggleAuto(id, state).catch((e) => {
                this.log.error(`Error on relay toggle (${id}): ${e}`);
            });
        }
        else if (id.endsWith(".onOff")) {
            this.relayToggleOnOff(id, state).catch((e) => {
                this.log.error(`Error on relay toggle (${id}): ${e}`);
            });
        }
    }
    relayToggleAuto(objectId, state) {
        return __awaiter(this, void 0, void 0, function* () {
            const onOffState = yield this.getStateAsync(objectId.replace(/\.auto$/, ".onOff"));
            if (!onOffState) {
                throw new Error(`Cannot get onOff state to toggle '${objectId}'`);
            }
            const obj = yield this.getObjectAsync(objectId);
            if (!obj) {
                throw new Error(`Cannot handle state change for non-existent object '${objectId}'`);
            }
            const getStateDataObject = this._stateData.getDataObject(obj.native.id);
            this.forceUpdate.push(getStateDataObject.id);
            try {
                if (!!state.val) {
                    this.log.info(`Switching ${obj.native.label}: auto`);
                    yield this.usrcfgCgiService.setAuto(getStateDataObject);
                }
                else if (!!onOffState.val) {
                    this.log.info(`Switching ${obj.native.label}: on`);
                    yield this.usrcfgCgiService.setOn(getStateDataObject);
                }
                else {
                    this.log.info(`Switching ${obj.native.label}: off`);
                    yield this.usrcfgCgiService.setOff(getStateDataObject);
                }
            }
            catch (e) {
                this.log.error(`Error on switching operation: ${e}`);
            }
        });
    }
    relayToggleOnOff(objectId, state) {
        return __awaiter(this, void 0, void 0, function* () {
            const obj = yield this.getObjectAsync(objectId);
            this.log.info("got object");
            if (!obj) {
                throw new Error(`Cannot handle state change for non-existent object '${objectId}'`);
            }
            const getStateDataObject = this._stateData.getDataObject(obj.native.id);
            this.forceUpdate.push(getStateDataObject.id);
            try {
                if (!!state.val) {
                    this.log.info(`Switching ${obj.native.label}: on`);
                    yield this.usrcfgCgiService.setOn(getStateDataObject);
                }
                else {
                    this.log.info(`Switching ${obj.native.label}: off`);
                    yield this.usrcfgCgiService.setOff(getStateDataObject);
                }
            }
            catch (e) {
                this.log.error(e);
            }
        });
    }
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  */
    // private onMessage(obj: ioBroker.Message): void {
    //     if (typeof obj === "object" && obj.message) {
    //         if (obj.command === "send") {
    //             // e.g. send email or pushover or whatever
    //             this.log.info("send command");
    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    //         }
    //     }
    // }
    /**
     * Set/update system information
     */
    setSysInfo(data) {
        this.log.info(JSON.stringify(data.toArrayOfObjects()));
        data.toArrayOfObjects().forEach((sysInfo) => {
            this.setObjectAsync(`${this.name}.${this.instance}.${sysInfo.key}`, {
                type: "state",
                common: {
                    name: sysInfo.key,
                    type: "string",
                    role: "info",
                    read: true,
                    write: false
                },
                native: sysInfo,
            }).then(() => {
                this.log.info(`Sys info object '${sysInfo.key}' has been set`);
            }).catch((e) => {
                this.log.error(`Failed setting sysInfo object '${sysInfo.key}': ${e}`);
            });
        });
    }
    /**
     * Set/update objects (not their states!)
     * @param data
     */
    setObjects(objects) {
        objects.forEach((obj) => {
            this.setDataObject(obj).catch((e) => {
                this.log.error(`Failed setting objects for '${obj.label}': ${e}`);
            });
        });
    }
    setDataObject(obj) {
        return __awaiter(this, void 0, void 0, function* () {
            // await this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}`, {
            //     type: "group",
            //     common: {
            //         name: obj.label,
            //         type: "boolean",
            //         role: "state",
            //         read: true,
            //         write: false
            //     },
            //     native: obj,
            // });
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
                        if (obj.category == get_state_data_1.GetStateCategory.TEMPERATURES) {
                            common.role = "level.temperature";
                            common.unit = `°${obj.unit}`;
                            if (obj.active) {
                                common.smartName = {
                                    de: obj.label,
                                    en: obj.label,
                                    smartType: "THERMOSTAT"
                                };
                            }
                        }
                        break;
                    case "id":
                    case "active":
                    case "categoryId":
                        common.role = "indicator";
                        break;
                    case "category":
                    case "label":
                        common.role = "text";
                        break;
                    case "offset":
                        common.role = "value.offset";
                        break;
                    case "gain":
                        common.role = "value.gain";
                        break;
                    case "raw":
                        common.role = "value.raw";
                        break;
                    case "unit":
                        common.role = "value.unit";
                        break;
                    case "displayValue":
                        common.role = "value.display";
                        break;
                    default:
                        continue;
                }
                try {
                    yield this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.${field}`, {
                        type: "state",
                        common: common,
                        native: obj,
                    });
                }
                catch (e) {
                    this.log.error(`Failed setting object '${obj.label}': ${e}`);
                }
            }
            if (obj.category === get_state_data_1.GetStateCategory.RELAYS || (obj.category === get_state_data_1.GetStateCategory.EXTERNAL_RELAYS &&
                this._stateData.sysInfo.isExtRelaysEnabled())) {
                this.setRelayDataObject(obj);
            }
        });
    }
    setRelayDataObject(obj) {
        const isLight = new RegExp("light|bulb|licht|leucht", "i").test(obj.label);
        const commonAuto = {
            name: obj.label,
            type: "boolean",
            role: "switch",
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
            role: "switch",
            read: true,
            write: !this.getStateService.data.isDosageControl(obj.id),
            smartName: obj.active && !this.getStateService.data.isDosageControl(obj.id) ? {
                de: obj.label,
                en: obj.label,
                smartType: isLight ? "LIGHT" : "SWITCH"
            } : {}
        };
        this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.auto`, {
            type: "state",
            common: commonAuto,
            native: obj,
        }).then(() => {
            this.log.info(`set auto/manual switch for '${obj.label}'`);
        }).catch((e) => {
            this.log.error(`Failed setting auto/manual switch for '${obj.label}': ${e}`);
        });
        this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.onOff`, {
            type: "state",
            common: commonOnOff,
            native: obj,
        }).then(() => {
            this.log.info(`set onOff switch for '${obj.label}'`);
        }).catch((e) => {
            this.log.error(`Failed setting onOff switch for '${obj.label}': ${e}`);
        });
    }
    setDataState(obj) {
        for (const field of Object.keys(obj)) {
            this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.${field}`, obj[field], true).catch((e) => {
                this.log.error(`Failed setting state for '${obj.label}': ${e}`);
            });
        }
        if (obj.category === get_state_data_1.GetStateCategory.RELAYS || (obj.category === get_state_data_1.GetStateCategory.EXTERNAL_RELAYS &&
            this._stateData.sysInfo.isExtRelaysEnabled())) {
            this.setRelayDataState(obj);
        }
    }
    setRelayDataState(obj) {
        this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.auto`, this.relayDataInterpreter.isAuto(obj), true).catch((e) => {
            this.log.error(`Failed setting auto/manual switch state for '${obj.label}': ${e}`);
        });
        this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.onOff`, this.relayDataInterpreter.isOn(obj), true).catch((e) => {
            this.log.error(`Failed setting onOff switch state for '${obj.label}': ${e}`);
        });
    }
}
exports.ProconIp = ProconIp;
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new ProconIp(options);
}
else {
    // otherwise start the instance directly
    (() => new ProconIp())();
}
