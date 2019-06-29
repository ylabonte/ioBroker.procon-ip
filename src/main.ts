/*
 * Created with @iobroker/create-adapter v1.15.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";
import {GetStateService} from "./lib/get-state.service";
import {UsrcfgCgiService} from "./lib/usrcfg-cgi.service";
import {RelayDataInterpreter} from "./lib/relay-data-interpreter";
import {GetStateCategory, GetStateData} from "./lib/get-state-data";
import {GetStateDataSysInfo} from "./lib/get-state-data-sys-info";
import {GetStateDataObject} from "./lib/get-state-data-object";

// Load your modules here, e.g.:
// import * as fs from "fs";

// Augment the adapter.config object with the actual types
// TODO: delete this in the next version
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ioBroker {
        interface AdapterConfig {
            // Define the shape of your options here (recommended)
            controllerUrl: string;
            basicAuth: boolean;
            username: string;
            password: string;
            updateInterval: number;

            // Or use a catch-all approach
            [key: string]: any;
        }
    }
}

class ProconIp extends utils.Adapter {

    private relayDataInterpreter!: RelayDataInterpreter;
    private getStateService!: GetStateService;
    private usrcfgCgiService!: UsrcfgCgiService;
    private forceUpdate: number[];
    private _objectsCreated: boolean = false;
    private _stateData: GetStateData;

    public constructor(options: Partial<ioBroker.AdapterOptions> = {}) {
        super({
            ...options,
            name: "procon-ip",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.forceUpdate = new Array<number>();
        this._stateData = new GetStateData();
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info("config controllerUrl: " + this.config.controllerUrl);
        this.log.info("config basicAuth: " + this.config.basicAuth);
        this.log.info("config username: " + this.config.username);
        this.log.debug("config password: " + this.config.password);
        this.log.info("config updateInterval: " + this.config.updateInterval);

        this.relayDataInterpreter = new RelayDataInterpreter(this.log);
        this.getStateService = new GetStateService(this.config, this.log);
        this.usrcfgCgiService = new UsrcfgCgiService(this.config, this.log, this.getStateService, this.relayDataInterpreter);

        this.log.info(`GetStateService url: ${this.getStateService.url}`);
        this.log.info(`UsrcfgCgiService url: ${this.usrcfgCgiService.url}`);

        this.getStateService.start((data: GetStateData) => {
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
                    if ([GetStateCategory.RELAYS, GetStateCategory.EXTERNAL_RELAYS].indexOf(obj.category as GetStateCategory) >= 0) {
                        this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.auto`, this.relayDataInterpreter.isAuto(obj), true).catch((e) => {
                            this.log.error(`Failed setting auto for '${obj.label}': ${e}`);
                        });
                        this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.onOff`, this.relayDataInterpreter.isOn(obj), true).catch((e) => {
                            this.log.error(`Failed setting auto for '${obj.label}': ${e}`);
                        });
                        this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.state`, obj.value, true).catch((e) => {
                            this.log.error(`Failed setting state for '${obj.label}': ${e}`);
                        });
                    } else {
                        this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}`, obj.displayValue, true).catch((e) => {
                            this.log.error(`Failed setting state for '${obj.label}': ${e}`);
                        });
                    }
                    if (this.forceUpdate[force]) {
                        delete this.forceUpdate[force];
                    }
                }
            });

            this._stateData = new GetStateData(data.raw);
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
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
        try {
            this.log.info("cleaned everything up...");
            callback();
        } catch (e) {
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
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
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
            this.log.info(`${id}: Toggle auto`);
            this.relayToggleAuto(id, state).then((response) => {
                this.log.info(JSON.stringify(response));
            }).catch((e) => {
                this.log.error(e);
            });
        } else if (id.endsWith(".onOff")) {
            this.log.info(`${id}: Toggle on/off`);
            this.relayToggleOnOff(id, state).then((response) => {
                this.log.info(JSON.stringify(response));
            }).catch((e) => {
                this.log.error(e);
            });
        }
    }

    public async relayToggleAuto(objectId: string, state: ioBroker.State) {
        const onOffState = await this.getStateAsync(objectId.replace(/\.auto$/, ".onOff"));
        if (!onOffState) {
            throw new Error(`Cannot get onOff state to toggle '${objectId}'`);
        }

        const obj = await this.getObjectAsync(objectId);
        if (!obj) {
            throw new Error(`Cannot handle state change for non-existent object '${objectId}'`);
        }

        const getStateDataObject: GetStateDataObject = this._stateData.getDataObject(obj.native.id);
        this.forceUpdate.push(getStateDataObject.id);
        if (!!state.val) {
            this.log.info(`Switching ${obj.native.label}: auto mode`);
            await this.usrcfgCgiService.setAuto(getStateDataObject);
        } else if (!!onOffState.val) {
            this.log.info(`Switching ${obj.native.label}: on`);
            await this.usrcfgCgiService.setOn(getStateDataObject);
        } else {
            this.log.info(`Switching ${obj.native.label}: off`);
            await this.usrcfgCgiService.setOff(getStateDataObject);
        }
    }

    public async relayToggleOnOff(objectId: string, state: ioBroker.State) {
        const obj = await this.getObjectAsync(objectId);
        this.log.info("got object");
        if (!obj) {
            throw new Error(`Cannot handle state change for non-existent object '${objectId}'`);
        }

        const getStateDataObject: GetStateDataObject = this._stateData.getDataObject(obj.native.id);
        this.forceUpdate.push(getStateDataObject.id);
        if (!!state.val) {
            this.log.info(`Switching ${obj.native.label}: on`);
            await this.usrcfgCgiService.setOn(getStateDataObject);
        } else {
            this.log.info(`Switching ${obj.native.label}: off`);
            await this.usrcfgCgiService.setOff(getStateDataObject);
        }
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
    public setSysInfo(data: GetStateDataSysInfo) {
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
    public setObjects(objects: GetStateDataObject[]) {
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
            if ([GetStateCategory.RELAYS, GetStateCategory.EXTERNAL_RELAYS].indexOf(obj.category as GetStateCategory) >= 0) {
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
            } else {
                this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}`, {
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

    /**
     * Add objects and/or update object states according to the current service data.
     */
    // public updateStates(data: GetStateData) {
    //     this.log.info("updateStates");
    //     this.setObjects(data);
    //     data.objects.forEach((obj) => {
    //         this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}`, obj.value).catch((e) => {
    //             this.log.error(`Failed setting state for '${obj.label}': ${e}`);
    //         });
    //     });
    // }
}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<ioBroker.AdapterOptions> | undefined) => new ProconIp(options);
} else {
    // otherwise start the instance directly
    (() => new ProconIp())();
}
