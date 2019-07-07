"use strict";
/*
 * Created with @iobroker/create-adapter v1.15.1
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
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
class ProconIp extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign({}, options, { name: "procon-ip" }));
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
            // Initialize your adapter here
            // The adapters config (in the instance object everything under the attribute "native") is accessible via
            // this.config:
            this.log.info("config controllerUrl: " + this.config.controllerUrl);
            this.log.info("config basicAuth: " + this.config.basicAuth);
            this.log.info("config username: " + this.config.username);
            this.log.debug("config password: " + this.config.password);
            this.log.info("config updateInterval: " + this.config.updateInterval);
            this.relayDataInterpreter = new relay_data_interpreter_1.RelayDataInterpreter(this.log);
            this.getStateService = new get_state_service_1.GetStateService(this.config, this.log);
            this.usrcfgCgiService = new usrcfg_cgi_service_1.UsrcfgCgiService(this.config, this.log, this.getStateService, this.relayDataInterpreter);
            this.log.info(`GetStateService url: ${this.getStateService.url}`);
            this.log.info(`UsrcfgCgiService url: ${this.usrcfgCgiService.url}`);
            this.getStateService.start((data) => {
                // Set objects once
                if (!this._objectsCreated) {
                    this.setSysInfo(data.sysInfo);
                    this.setObjects(data.objects);
                    this._objectsCreated = true;
                }
                // Set sys info states
                data.sysInfo.toArrayOfObjects().forEach((info) => {
                    // this.log.info(`Checking sys info state ${info.key} for updates: ${this._stateData.sysInfo[info.key]} <=> ${info.value}`);
                    if (info.value !== this._stateData.sysInfo[info.key]) {
                        this.log.debug(`Updating sys info state ${info.key}: ${info.value}`);
                        this.setStateAsync(`${this.name}.${this.instance}.${info.key}`, info.value, true).catch((e) => {
                            this.log.error(`Failed setting state for '${info.key}': ${e}`);
                        });
                    }
                });
                data.objects.forEach((obj) => {
                    // this.log.info(`Checking object ${obj.label} for state update: ${this._stateData.getDataObject(obj.id).value} <=> ${obj.value}`);
                    const force = this.forceUpdate.indexOf(obj.id);
                    if (force >= 0 || (this._stateData.getDataObject(obj.id) && obj.value !== this._stateData.getDataObject(obj.id).value)) {
                        this.log.debug(`Updating state of '${obj.label}'`);
                        if ([get_state_data_1.GetStateCategory.RELAYS, get_state_data_1.GetStateCategory.EXTERNAL_RELAYS].indexOf(obj.category) >= 0) {
                            this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.auto`, this.relayDataInterpreter.isAuto(obj), true).catch((e) => {
                                this.log.error(`Failed setting auto for '${obj.label}': ${e}`);
                            });
                            this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.onOff`, this.relayDataInterpreter.isOn(obj), true).catch((e) => {
                                this.log.error(`Failed setting auto for '${obj.label}': ${e}`);
                            });
                            this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.state`, obj.value, true).catch((e) => {
                                this.log.error(`Failed setting state for '${obj.label}': ${e}`);
                            });
                        }
                        else {
                            this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.state`, obj.value, true).catch((e) => {
                                this.log.error(`Failed setting state for '${obj.label}': ${e}`);
                            });
                            this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.displayValue`, obj.displayValue, true).catch((e) => {
                                this.log.error(`Failed setting state for '${obj.label}': ${e}`);
                            });
                        }
                        if (this.forceUpdate[force]) {
                            delete this.forceUpdate[force];
                        }
                    }
                });
                this._stateData = new get_state_data_1.GetStateData(data.raw);
            });
            // this.getStateService.getData().then((response) => {
            //     this.log.info("Got data from GetStateService");
            //     this.log.info(response.data);
            //     this.getStateService.data.parseCsv(response.data);
            //     this.log.info(`Parsed data from GetStateService: Got ${this.getStateService.data.objects.length} objects`);
            //     this.log.info(JSON.stringify(this.getStateService.data));
            //     const test = this.getStateService.data.getDataObjectsByCategory("relays");
            //     this.log.info(`Got ${test.length} relays and their states`);
            // }).catch((error) => {
            //     this.log.error(error);
            // });
            /*
            For every state in the system there has to be also an object of type state
            Here a simple template for a boolean variable named "testVariable"
            Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
            */
            // await this.setObjectAsync("testVariable", {
            //     type: "state",
            //     common: {
            //         name: "testVariable",
            //         type: "boolean",
            //         role: "indicator",
            //         read: true,
            //         write: true,
            //     },
            //     native: {},
            // });
            // in this template all states changes inside the adapters namespace are subscribed
            this.subscribeStates(`${this.name}.${this.instance}.relays.*`);
            // this.subscribeStates(`${this.name}.${this.instance}.relays.*.auto`);
            // this.subscribeStates(`${this.name}.${this.instance}.relays.*.state`);
            this.subscribeStates(`${this.name}.${this.instance}.externalRelays.*`);
            // this.subscribeStates(`${this.name}.${this.instance}.externalRelays.*.auto`);
            // this.subscribeStates(`${this.name}.${this.instance}.externalRelays.*.state`);
            /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
            */
            // the variable testVariable is set to true as command (ack=false)
            // await this.setStateAsync("testVariable", true);
            // same thing, but the value is flagged "ack"
            // ack should be always set to true if the value is received from or acknowledged from the target system
            // await this.setStateAsync("testVariable", {val: true, ack: true});
            // same thing, but the state is deleted after 30s (getState will return null afterwards)
            // await this.setStateAsync("testVariable", {val: true, ack: true, expire: 30});
            // examples for the checkPassword/checkGroup functions
            // let result = await this.checkPasswordAsync("admin", "iobroker");
            // this.log.info("check user admin pw ioboker: " + result);
            //
            // result = await this.checkGroupAsync("admin", "admin");
            // this.log.info("check group user admin group admin: " + result);
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            this.log.info("cleaned everything up...");
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
            // this.log.info(`${id}: Toggle auto`);
            this.relayToggleAuto(id, state).then((response) => {
                this.log.info(JSON.stringify(response));
            }).catch((e) => {
                this.log.error(e);
            });
        }
        else if (id.endsWith(".onOff")) {
            // this.log.info(`${id}: Toggle on/off`);
            this.relayToggleOnOff(id, state).then((response) => {
                this.log.info(JSON.stringify(response));
            }).catch((e) => {
                this.log.error(e);
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
            if (!!state.val) {
                this.log.info(`Switching ${obj.native.label}: auto mode`);
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
            if (!!state.val) {
                this.log.info(`Switching ${obj.native.label}: on`);
                yield this.usrcfgCgiService.setOn(getStateDataObject);
            }
            else {
                this.log.info(`Switching ${obj.native.label}: off`);
                yield this.usrcfgCgiService.setOff(getStateDataObject);
            }
        });
    }
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  */
    // private onMessage(obj: ioBroker.Message): void {
    // 	if (typeof obj === "object" && obj.message) {
    // 		if (obj.command === "send") {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info("send command");
    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    // 		}
    // 	}
    // }
    /**
     * Set/update system information
     */
    setSysInfo(data) {
        this.log.info(JSON.stringify(data.toArrayOfObjects()));
        data.toArrayOfObjects().forEach((sysInfo) => {
            this.setObjectAsync(`${this.name}.${this.instance}.${sysInfo.key}`, {
                type: "info",
                common: {
                    name: sysInfo.key,
                    type: "string",
                    role: "state",
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
        // Object.keys(data.categories).forEach((category) => {
        //     this.setObjectAsync(`${this.name}.${this.instance}.${category}`, {
        //         type: "group",
        //         common: {
        //             name: category,
        //             type: "object",
        //             read: true,
        //             write: false,
        //         },
        //         native: {},
        //     }).catch((e) => {
        //         this.log.error(`Failed setting group object '${category}': ${e}`);
        //     });
        // });
        objects.forEach((obj) => {
            if ([get_state_data_1.GetStateCategory.RELAYS, get_state_data_1.GetStateCategory.EXTERNAL_RELAYS].indexOf(obj.category) >= 0) {
                console.log(`${obj.label} seems to by some kind of relay ('${obj.category}')`);
                this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.auto`, {
                    type: "state",
                    common: {
                        name: obj.label,
                        type: "boolean",
                        role: "switch.auto",
                        read: true,
                        write: true
                    },
                    native: obj,
                }).then(() => {
                    this.log.info(`Object onOff '${obj.label}' has been set`);
                }).catch((e) => {
                    this.log.error(`Failed setting object '${obj.label}': ${e}`);
                });
                this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.onOff`, {
                    type: "state",
                    common: {
                        name: obj.label,
                        type: "boolean",
                        role: "switch.power",
                        read: true,
                        // write: true
                        write: !this.getStateService.data.isDosageControl(obj.id)
                    },
                    native: obj,
                }).then(() => {
                    this.log.info(`Object state '${obj.label}' has been set`);
                }).catch((e) => {
                    this.log.error(`Failed setting object '${obj.label}': ${e}`);
                });
                this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.state`, {
                    type: "state",
                    common: {
                        name: obj.label,
                        type: "boolean",
                        role: "state",
                        read: true,
                        // write: true
                        write: !this.getStateService.data.isDosageControl(obj.id)
                    },
                    native: obj,
                }).then(() => {
                    this.log.info(`Object state '${obj.label}' has been set`);
                }).catch((e) => {
                    this.log.error(`Failed setting object '${obj.label}': ${e}`);
                });
            }
            else {
                this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.state`, {
                    type: "state",
                    common: {
                        name: obj.label,
                        type: "boolean",
                        role: "value",
                        read: true,
                        write: false
                    },
                    native: obj,
                }).then(() => {
                    this.log.info(`Object '${obj.label}' has been set`);
                }).catch((e) => {
                    this.log.error(`Failed setting object '${obj.label}': ${e}`);
                });
                this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.displayValue`, {
                    type: "state",
                    common: {
                        name: obj.label,
                        type: "boolean",
                        role: "value",
                        read: true,
                        write: false
                    },
                    native: obj,
                }).then(() => {
                    this.log.info(`Object '${obj.label}' has been set`);
                }).catch((e) => {
                    this.log.error(`Failed setting object '${obj.label}': ${e}`);
                });
            }
        });
    }
}
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new ProconIp(options);
}
else {
    // otherwise start the instance directly
    (() => new ProconIp())();
}
