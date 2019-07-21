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
        this.log.info("config updateInterval: " + this.config.updateInterval);

        this.relayDataInterpreter = new RelayDataInterpreter(this.log);
        this.getStateService = new GetStateService(this.config, this.log);
        this.usrcfgCgiService = new UsrcfgCgiService(this.config, this.log, this.getStateService, this.relayDataInterpreter);

        this.log.info(`GetStateService url: ${this.getStateService.url}`);
        this.log.info(`UsrcfgCgiService url: ${this.usrcfgCgiService.url}`);

        let firstRun = true;
        this.getStateService.start((data: GetStateData) => {
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

            this._stateData = new GetStateData(data.raw);
            firstRun = false;
        });

        this.subscribeStates(`${this.name}.${this.instance}.relays.*`);
        this.subscribeStates(`${this.name}.${this.instance}.externalRelays.*`);
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
            // this.log.info(`${id}: Toggle auto`);
            this.relayToggleAuto(id, state).then((response) => {
                this.log.info(JSON.stringify(response));
            }).catch((e) => {
                this.log.error(e);
            });
        } else if (id.endsWith(".onOff")) {
            // this.log.info(`${id}: Toggle on/off`);
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
    public setObjects(objects: GetStateDataObject[]) {
        objects.forEach((obj) => {
            this.setDataObject(obj).catch((e) => {
                this.log.error(`Failed setting objects for '${obj.label}': ${e}`);
            });
        });
    }

    public async setDataObject(obj: GetStateDataObject) {
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
            const common: any = {
                name: obj.label,
                type: typeof obj[field],
                role: "value",
                read: true,
                write: false
            };

            switch (field) {
                case "value":
                    if (obj.category == GetStateCategory.TEMPERATURES) {
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
                await this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.${field}`, {
                    type: "state",
                    common: common,
                    native: obj,
                });
            } catch (e) {
                this.log.error(`Failed setting object '${obj.label}': ${e}`);
            }
        }

        if ([GetStateCategory.RELAYS, GetStateCategory.EXTERNAL_RELAYS].indexOf(obj.category as GetStateCategory) >= 0) {
            this.setRelayDataObject(obj);
        }
    }

    public setRelayDataObject(obj: GetStateDataObject) {
        const isLight: boolean = new RegExp("light|bulb|licht|leucht", "i").test(obj.label);
        const smartOnOff: any = obj.active && !this.getStateService.data.isDosageControl(obj.id) ? {
            smartName: {
                de: obj.label,
                en: obj.label,
                smartType: isLight ? "LIGHT" : "SWITCH"
            }
        } : {};
        const smartAuto: any = obj.active ? {
            smartName: {
                de: `${obj.label} auto`,
                en: `${obj.label} auto`,
                smartType: isLight ? "LIGHT" : "SWITCH"
            }
        } : {};

        this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.auto`, {
            type: "state",
            common: {
                name: obj.label,
                type: "boolean",
                role: "switch",
                read: true,
                write: true
            } + smartAuto,
            native: obj,
        }).then(() => {
            this.log.info(`set auto/manual switch for '${obj.label}'`);
        }).catch((e) => {
            this.log.error(`Failed setting auto/manual switch for '${obj.label}': ${e}`);
        });
        this.setObjectAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.onOff`, {
            type: "state",
            common: {
                name: obj.label,
                type: "boolean",
                role: "switch",
                read: true,
                write: !this.getStateService.data.isDosageControl(obj.id)
            } + smartOnOff,
            native: obj,
        }).then(() => {
            this.log.info(`set onOff switch for '${obj.label}'`);
        }).catch((e) => {
            this.log.error(`Failed setting onOff switch for '${obj.label}': ${e}`);
        });
    }

    public setDataState(obj: GetStateDataObject) {
        for (const field of Object.keys(obj)) {
            this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.${field}`, obj[field], true).catch((e) => {
                this.log.error(`Failed setting state for '${obj.label}': ${e}`);
            });
        }

        if ([GetStateCategory.RELAYS, GetStateCategory.EXTERNAL_RELAYS].indexOf(obj.category as GetStateCategory) >= 0) {
            this.setRelayDataState(obj);
        }
    }

    public setRelayDataState(obj: GetStateDataObject) {
        this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.auto`, this.relayDataInterpreter.isAuto(obj), true).catch((e) => {
            this.log.error(`Failed setting auto/manual switch state for '${obj.label}': ${e}`);
        });
        this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.onOff`, this.relayDataInterpreter.isOn(obj), true).catch((e) => {
            this.log.error(`Failed setting onOff switch state for '${obj.label}': ${e}`);
        });
    }
}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<ioBroker.AdapterOptions> | undefined) => new ProconIp(options);
} else {
    // otherwise start the instance directly
    (() => new ProconIp())();
}
