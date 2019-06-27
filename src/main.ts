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
    private _objectsCreated: boolean = false;
    private _stateData: GetStateData|undefined;

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
        this.relayDataInterpreter = new RelayDataInterpreter();
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

        this.getStateService = new GetStateService(this.config);
        this.usrcfgCgiService = new UsrcfgCgiService(this.config, this.getStateService, this.relayDataInterpreter);

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
                if (!this._stateData || info.value !== this._stateData.sysInfo[info.key]) {
                    this.setStateAsync(`${this.name}.${this.instance}.${info.key}`, info.value, true).catch((e) => {
                        this.log.error(`Failed setting state for '${info.key}': ${e}`);
                    });
                }
            });
            data.objects.forEach((obj) => {
                if (!this._stateData || obj.value !== this._stateData.getDataObject(obj.id).value) {
                    this.log.info(`Updating state of '${obj.label}'`);
                    if (obj.category in [GetStateCategory.RELAYS, GetStateCategory.EXTERNAL_RELAYS]) {
                        this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.auto`, this.relayDataInterpreter.isAuto(obj), true).catch((e) => {
                            this.log.error(`Failed setting auto for '${obj.label}': ${e}`);
                        });
                        this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.state`, this.relayDataInterpreter.isOn(obj), true).catch((e) => {
                            this.log.error(`Failed setting state for '${obj.label}': ${e}`);
                        });
                    } else {
                        this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}`, obj.displayValue, true).catch((e) => {
                            this.log.error(`Failed setting state for '${obj.label}': ${e}`);
                        });
                    }
                }
            });

            this._stateData = data;
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
        this.subscribeStates("*");

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
        if (state && !state.ack) {
            this.getObjectAsync(id).then((obj) => {
                if (obj) {
                    if (this.relayDataInterpreter.isAuto(obj.native.id)) {
                        this.log.info(`Switching ${obj.native.label}: auto`);
                        this.usrcfgCgiService.setAuto(obj.native as GetStateDataObject);
                    } else if (this.relayDataInterpreter.isOn(obj.native.id)) {
                        this.log.info(`Switching ${obj.native.label}: on`);
                        this.usrcfgCgiService.setOn(obj.native as GetStateDataObject);
                    } else {
                        this.log.info(`Switching ${obj.native.label}: off`);
                        this.usrcfgCgiService.setOff(obj.native as GetStateDataObject);
                    }
                }
            });
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else if (!state) {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
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
     * Set/update sysinfo
     */
    public setSysInfo(data: GetStateDataSysInfo) {
        this.log.info(JSON.stringify(data.toArrayOfObjects()));
        data.toArrayOfObjects().forEach((sysInfo) => {
            this.setObjectAsync(`${this.name}.${this.instance}.${sysInfo.key}`, {
                type: "info",
                common: {
                    name: sysInfo.key,
                    type: "string",
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
            if (obj.category in [GetStateCategory.RELAYS, GetStateCategory.EXTERNAL_RELAYS]) {
                console.log(`${obj.label} seems to by some kind of relay ('${obj.category}')`);
                this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.auto`, {
                    type: "state",
                    common: {
                        name: obj.label,
                        type: "boolean",
                        role: "switch.auto",
                        read: true,
                        write: obj.active
                    },
                    native: obj,
                }).then(() => {
                    this.log.info(`Object auto '${obj.label}' has been set`);
                }).catch((e) => {
                    this.log.error(`Failed setting object '${obj.label}': ${e}`);
                });
                this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.state`, {
                    type: "state",
                    common: {
                        name: obj.label,
                        type: "boolean",
                        role: "switch.power",
                        read: true,
                        write: obj.active
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
