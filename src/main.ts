/*
 * Created with @iobroker/create-adapter v1.15.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";
import {GetStateService} from "./lib/get-state.service";
import {UsrcfgCgiService} from "./lib/usrcfg-cgi.service";
import {RelayDataInterpreter} from "./lib/relay-data-interpreter";
import {GetStateCategory} from "./lib/get-state-data";
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

    public constructor(options: Partial<ioBroker.AdapterOptions> = {}) {
        super({
            ...options,
            name: "procon-ip",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("objectChange", this.onObjectChange.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
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
        this.log.info("config password: " + this.config.password);
        this.log.info("config updateInterval: " + this.config.updateInterval);

        this.getStateService = new GetStateService(this.config);
        this.usrcfgCgiService = new UsrcfgCgiService(this.config, this.getStateService, this.relayDataInterpreter);

        this.getStateService.getData().then((response) => {
            this.getStateService.data.parseCsv(response.data);
            this.getStateService.data.getDataObjectsByCategory(GetStateCategory.RELAYS).forEach((obj: GetStateDataObject) => {
                this.addRelay(obj).then(() => {
                    this.log.info(`Addded relay: ${obj.label}`);
                }).catch((error) => {
                    this.log.error(error)
                });
            });
            this.getStateService.start(this.updateStates);
        }).catch((error) => {
            this.log.error(error);
        });
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
    private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     */
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
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

    public updateStates() {
        this.getStateService.data.getDataObjectsByCategory(GetStateCategory.RELAYS).forEach((obj: GetStateDataObject) => {
            this.addRelay(obj).then(() => {
                this.log.info(`Addded relay: ${obj.label}`);
            }).catch((error) => {
                this.log.error(error)
            });
        });
    }

    public async addRelay(obj: GetStateDataObject) {
        await this.setObjectAsync(`relay${obj.categoryId}.name`, {
            type: "state",
            common: {
                name: `relay${obj.categoryId}.name`,
                type: "string",
                role: "indicator",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync(`relay${obj.categoryId}.name`, {val: obj.label, ack: true});

        await this.setObjectAsync(`relay${obj.categoryId}.auto`, {
            type: "state",
            common: {
                name: `relay${obj.categoryId}.auto`,
                type: "boolean",
                role: "indicator",
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync(`relay${obj.categoryId}.auto`, {val: this.relayDataInterpreter.isAuto(obj), ack: true});

        await this.setObjectAsync(`relay${obj.categoryId}.state`, {
            type: "state",
            common: {
                name: `relay${obj.categoryId}.state`,
                type: "boolean",
                role: "indicator",
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync(`relay${obj.categoryId}.state`, {val: this.relayDataInterpreter.isOn(obj), ack: true});
    }
}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<ioBroker.AdapterOptions> | undefined) => new ProconIp(options);
} else {
    // otherwise start the instance directly
    (() => new ProconIp())();
}
