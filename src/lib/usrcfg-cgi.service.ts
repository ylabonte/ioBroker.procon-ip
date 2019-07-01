import {AbstractService} from "./abstract-service";
import {GetStateService} from "./get-state.service";
import {GetStateData} from "./get-state-data";
import {GetStateDataObject} from "./get-state-data-object";
import {RelayDataInterpreter, RelayStateBitMask} from "./relay-data-interpreter";
import axios, {AxiosPromise, Method} from "axios";

export enum SetStateValue {
    ON = 1,
    OFF = 0,
    AUTO = 2
}

export class UsrcfgCgiService extends AbstractService {
    public _endpoint = "/usrcfg.cgi";
    public _method: Method = "post";

    private stateData: GetStateData;

    private getStateService: GetStateService;

    private relayDataInterpreter: RelayDataInterpreter;

    public constructor(config: ioBroker.AdapterConfig, logger: ioBroker.Logger, getStateService: GetStateService, relayDataInterpreter: RelayDataInterpreter) {
        super(config, logger);
        this.relayDataInterpreter = relayDataInterpreter;
        this.getStateService = getStateService;
        this.stateData = this.getStateService.data;
        this._requestHeaders["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
    }

    public async setOn(relayData: GetStateDataObject): Promise<number> {
        return this.setState(relayData, SetStateValue.ON);
    }

    public async setOff(relayData: GetStateDataObject): Promise<number> {
        return this.setState(relayData, SetStateValue.OFF);
    }

    public async setAuto(relayData: GetStateDataObject): Promise<number> {
        return this.setState(relayData, SetStateValue.AUTO);
    }

    private async setState(relay: GetStateDataObject, state: SetStateValue|number): Promise<number> {
        let data: [number, number]|undefined = undefined;
        let desiredValue: number;
        switch (state) {
            case SetStateValue.AUTO:
                data = this.relayDataInterpreter.evaluate(this.getStateService.data).setAuto(relay);
                desiredValue = relay.raw & ~RelayStateBitMask.manual;
                break;
            case SetStateValue.ON:
                data = this.relayDataInterpreter.evaluate(this.getStateService.data).setOn(relay);
                desiredValue = RelayStateBitMask.manual | RelayStateBitMask.on;
                break;
            case SetStateValue.OFF:
            default:
                data = this.relayDataInterpreter.evaluate(this.getStateService.data).setOff(relay);
                desiredValue = RelayStateBitMask.manual | ~RelayStateBitMask.on;
                break;
        }

        this.log.info(`usrcfg.cgi data: ${JSON.stringify(data)}`);
        return new Promise<number>((resolve, reject) => {
            if (data === undefined) {
                return reject("Cannot determine request data for relay switching");
            }

            this.send(data).then((response) => {
                this.log.info(`usrcfg.cgi response: ${JSON.stringify(response.data)}`);
                this.log.info(`usrcfg.cgi status: (${response.status}) ${response.statusText}`);
                // if (["continue", "done"].indexOf(response.data.toLowerCase()) >= 0) {
                if (response.status === 200) {
                    this.getStateService.update();
                    resolve(desiredValue);
                } else {
                    reject(`(${response.status}: ${response.statusText}) Error sending relay control command: ${response.data}`);
                }
            }).catch((e) => {
                reject(e)
            });
        });
    }

    // private send(bitTupel: [number, number]): AxiosPromise/*<{data: string; status: number; statusText: string}>*/ {
    private send(bitTupel: [number, number]): /*Axios*/Promise<{data: string; status: number; statusText: string}> {
        const requestConfig = this.axiosRequestConfig;
        requestConfig.data = {
            ENA: bitTupel.join(","),
            MANUAL: "1"
        };
        this.log.info(JSON.stringify(requestConfig));

        return new Promise((resolve, reject) => {
            if (requestConfig.data.ENA.search("-") >= 0) {
                reject("fuck it! why negative numbers?!");
            }
            resolve({data: "", status: 200, statusText: "OK"});
        });
        // return axios.request(requestConfig);
    }
}
