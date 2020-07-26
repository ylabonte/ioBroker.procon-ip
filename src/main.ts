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
import {CryptoHelper} from "./lib/crypto-helper";

// Augment the adapter.config object with the actual types
// TODO: delete this in the next version
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ioBroker {
        interface AdapterConfig {
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

export class ProconIp extends utils.Adapter {

    private relayDataInterpreter!: RelayDataInterpreter;
    private getStateService!: GetStateService;
    private usrcfgCgiService!: UsrcfgCgiService;
    private forceUpdate: number[];
    private _stateData: GetStateData;
    private _objectsCreated = false;
    private _bootstrapped = false;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
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
        this.getForeignObject("system.config", (err: any, obj: any) => {
            for (const setting in this.config) {
                if (typeof this.config[setting] !== "boolean" && isNaN(this.config[setting]) &&
                    (!this.supportsFeature || !this.supportsFeature("ADAPTER_AUTO_DECRYPT_NATIVE"))) {
                    //noinspection JSUnresolvedVariable
                    if (typeof obj !== "undefined" && obj.native && obj.native.secret) {
                        //noinspection JSUnresolvedVariable
                        this.config[setting] = CryptoHelper.decrypt(this.config[setting], obj.native.secret);
                    } else {
                        //noinspection JSUnresolvedVariable
                        this.log.warn("Cannot get native secret for encryption. Falling back to hard coded default key!");
                        this.config[setting] = CryptoHelper.decrypt(this.config[setting], "Jp#q|]-g/^.m7+xHeu");
                    }
                }
            }
    
            // The adapters config (in the instance object everything under the attribute "native") is accessible via
            // this.config:
            this.log.debug("config controllerUrl: " + this.config.controllerUrl);
            this.log.debug("config basicAuth: " + this.config.basicAuth);
            this.log.debug("config updateInterval: " + this.config.updateInterval);
    
            this.relayDataInterpreter = new RelayDataInterpreter(this.log);
            this.getStateService = new GetStateService(this);
            this.usrcfgCgiService = new UsrcfgCgiService(this.config, this.log, this.getStateService, this.relayDataInterpreter);
    
            this.log.debug(`GetStateService url: ${this.getStateService.url}`);
            this.log.debug(`UsrcfgCgiService url: ${this.usrcfgCgiService.url}`);

            // Start the actual service
            this.getStateService.start((data: GetStateData) => {
                // Set objects once
                if (!this._bootstrapped) {
                    this.setSysInfo(data.sysInfo);
                    this.setObjects(data.objects);
                }
        
                // Set sys info states
                data.sysInfo.toArrayOfObjects().forEach((info) => {
                    // Only update when value has changed
                    if (!this._bootstrapped || info.value !== this._stateData.sysInfo[info.key]) {
                        this.log.debug(`Updating sys info state ${info.key}: ${info.value}`);
                        this.setStateAsync(`${this.name}.${this.instance}.info.system.${info.key}`, info.value, true).catch((e) => {
                            this.log.error(`Failed setting state for '${info.key}': ${e}`);
                        });
                    }
                });

                // Set actual sensor and actor/relay object states
                data.objects.forEach((obj) => {
                    // Only update when value has changed or update is forced (on state change)
                    const forceObjStateUpdate = this.forceUpdate.indexOf(obj.id);
                    if (!this._bootstrapped || forceObjStateUpdate >= 0 || (
                        this._stateData.getDataObject(obj.id) && 
                        obj.value !== this._stateData.getDataObject(obj.id).value)
                    ) {
                        this.setDataState(obj);
                        if (this.forceUpdate[forceObjStateUpdate]) {
                            delete this.forceUpdate[forceObjStateUpdate];
                        }
                    }
                });
        
                this._stateData = data;
                this._bootstrapped = true;
            });
    
            this.subscribeStates(`${this.name}.${this.instance}.relays.*`);
            this.subscribeStates(`${this.name}.${this.instance}.externalRelays.*`);
        });
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
        try {
            // Stop the service loop (this also handles the info.connection state)
            this.getStateService.stop();
        } catch (e) {
            this.log.error(`Failed to stop GetState service: ${e}`);
        } finally {
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
            this.relayToggleAuto(id, state).catch((e) => {
                this.log.error(`Error on relay toggle (${id}): ${e}`);
            });
        } else if (id.endsWith(".onOff")) {
            this.relayToggleOnOff(id, state).catch((e) => {
                this.log.error(`Error on relay toggle (${id}): ${e}`);
            });
        }
    }

    public async relayToggleAuto(objectId: string, state: ioBroker.State): Promise<void> {
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
        try {
            if (!!state.val) {
                this.log.info(`Switching ${obj.native.label}: auto`);
                await this.usrcfgCgiService.setAuto(getStateDataObject);
            } else if (!!onOffState.val) {
                this.log.info(`Switching ${obj.native.label}: on`);
                await this.usrcfgCgiService.setOn(getStateDataObject);
            } else {
                this.log.info(`Switching ${obj.native.label}: off`);
                await this.usrcfgCgiService.setOff(getStateDataObject);
            }
        } catch (e) {
            this.log.error(`Error on switching operation: ${e}`);
        }
    }

    public async relayToggleOnOff(objectId: string, state: ioBroker.State): Promise<void> {
        const obj = await this.getObjectAsync(objectId);
        if (!obj) {
            throw new Error(`Cannot handle state change for non-existent object '${objectId}'`);
        }

        const getStateDataObject: GetStateDataObject = this._stateData.getDataObject(obj.native.id);
        this.forceUpdate.push(getStateDataObject.id);
        try {
            if (!!state.val) {
                this.log.info(`Switching ${obj.native.label}: on`);
                await this.usrcfgCgiService.setOn(getStateDataObject);
            } else {
                this.log.info(`Switching ${obj.native.label}: off`);
                await this.usrcfgCgiService.setOff(getStateDataObject);
            }
        } catch (e) {
            this.log.error(e);
        }
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
    public setSysInfo(data: GetStateDataSysInfo): void {
        this.log.info(JSON.stringify(data.toArrayOfObjects()));
        this.setObjectNotExists(`${this.name}.${this.instance}.info.system`, {
            type: "channel",
            common: {
                name: "SysInfo"
            },
            native: {}
        });
        data.toArrayOfObjects().forEach((sysInfo) => {
            this.setObjectNotExistsAsync(`${this.name}.${this.instance}.info.system.${sysInfo.key}`, {
                type: "state",
                common: {
                    name: sysInfo.key,
                    type: "string",
                    role: "state",
                    read: true,
                    write: false
                },
                native: {},
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
    public setObjects(objects: GetStateDataObject[]): void {
        let lastObjCategory = "";
        objects.forEach((obj) => {
            if (lastObjCategory !== obj.category) {
                // Define each api object category as device
                this.setObjectNotExists(`${this.name}.${this.instance}.${obj.category}`, {
                    type: "channel",
                    common: {
                        name: obj.category,
                    },
                    native: {}
                });
                lastObjCategory = obj.category;
            }
            this.setDataObject(obj).catch((e) => {
                this.log.error(`Failed setting objects for '${obj.label}': ${e}`);
            });
        });
    }

    public async setDataObject(obj: GetStateDataObject): Promise<void> {
        this.setObjectNotExists(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}`, {
            type: "channel",
            common: {
                name: obj.label,
            },
            native: {},
        });
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
                        common.role = "value.temperature";
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
                await this.setObjectNotExistsAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.${field}`, {
                    type: "state",
                    common: common,
                    native: obj,
                });
            } catch (e) {
                this.log.error(`Failed setting object '${obj.label}': ${e}`);
            }
        }

        if (obj.category as GetStateCategory === GetStateCategory.RELAYS || (
            obj.category as GetStateCategory === GetStateCategory.EXTERNAL_RELAYS &&
            this._stateData.sysInfo.isExtRelaysEnabled()
        )) {
            this.setRelayDataObject(obj);
        }
    }

    public setRelayDataObject(obj: GetStateDataObject): void {
        const isLight: boolean = new RegExp("light|bulb|licht|leucht", "i").test(obj.label);
        const commonAuto: any = {
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
        const commonOnOff: any = {
            name: obj.label,
            type: "boolean",
            role: isLight ? "switch.light" : "switch",
            read: true,
            write: !this.getStateService.data.isDosageControl(obj.id),
            smartName: obj.active && !this.getStateService.data.isDosageControl(obj.id) ? {
                de: obj.label,
                en: obj.label,
                smartType: isLight ? "LIGHT" : "SWITCH"
            } : {}
        };

        this.setObjectNotExistsAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.auto`, {
            type: "state",
            common: commonAuto,
            native: obj,
        }).then(() => {
            this.log.info(`set auto/manual switch for '${obj.label}'`);
        }).catch((e) => {
            this.log.error(`Failed setting auto/manual switch for '${obj.label}': ${e}`);
        });
        this.setObjectNotExistsAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.onOff`, {
            type: "state",
            common: commonOnOff,
            native: obj,
        }).then(() => {
            this.log.info(`set onOff switch for '${obj.label}'`);
        }).catch((e) => {
            this.log.error(`Failed setting onOff switch for '${obj.label}': ${e}`);
        });
    }

    public setDataState(obj: GetStateDataObject): void {
        for (const field of Object.keys(obj)) {
            this.setStateAsync(`${this.name}.${this.instance}.${obj.category}.${obj.categoryId}.${field}`, obj[field], true).catch((e) => {
                this.log.error(`Failed setting state for '${obj.label}': ${e}`);
            });
        }

        if (obj.category as GetStateCategory === GetStateCategory.RELAYS || (
            obj.category as GetStateCategory === GetStateCategory.EXTERNAL_RELAYS &&
            this._stateData.sysInfo.isExtRelaysEnabled()
        )) {
            this.setRelayDataState(obj);
        }
    }

    public setRelayDataState(obj: GetStateDataObject): void {
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
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new ProconIp(options);
} else {
    // otherwise start the instance directly
    (() => new ProconIp())();
}
