import {AbstractService, IServiceConfig} from "./abstract-service";
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

    public constructor(config: ioBroker.AdapterConfig, getStateService: GetStateService, relayDataInterpreter: RelayDataInterpreter) {
        super(config);
        this.relayDataInterpreter = relayDataInterpreter;
        this.getStateService = getStateService;
        this.stateData = this.getStateService.data;
        this._requestHeaders["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
    }

    public setOn(relayData: GetStateDataObject) {
        this.setState(relayData, SetStateValue.ON);
    }

    public setOff(relayData: GetStateDataObject) {
        this.setState(relayData, SetStateValue.OFF);
    }

    public setAuto(relayData: GetStateDataObject) {
        this.setState(relayData, SetStateValue.AUTO);
    }

    private setState(relay: GetStateDataObject, state: SetStateValue|number) {
        let data: [number, number]|undefined = undefined;
        let desiredValue: number;
        switch (state) {
            case SetStateValue.ON:
                data = this.relayDataInterpreter.evaluate(this.getStateService.data).setOn(relay);
                desiredValue = RelayStateBitMask.manual | RelayStateBitMask.on;
                break;
            case SetStateValue.OFF:
                data = this.relayDataInterpreter.evaluate(this.getStateService.data).setOff(relay);
                desiredValue = RelayStateBitMask.manual | ~RelayStateBitMask.on;
                break;
            case SetStateValue.AUTO:
                data = this.relayDataInterpreter.evaluate(this.getStateService.data).setAuto(relay);
                desiredValue = relay.raw & ~RelayStateBitMask.manual;
                break;
        }

        if (data !== undefined) {
            this.send(data).then((response) => {
                console.log(response);
                if (["continue", "done"].indexOf(response.data.toLowerCase()) >= 0) {
                    this.getStateService.data.objects[relay.id].set(
                        relay.id,
                        relay.label,
                        relay.unit,
                        relay.offset.toString(),
                        relay.gain.toString(),
                        desiredValue.toString()
                    );
                    // this.getStateService.update();
                } else {
                    console.error(`(${response.status}: ${response.statusText}) Error sending relay control command:`, response.data);
                }
            }).catch((error) => {
                console.error(error);
            });
        }
    }

    private send(bitTupel: [number, number]): AxiosPromise {
        const requestConfig = this.axiosRequestConfig;
        requestConfig.data = {
            ENA: bitTupel.join(","),
            MANUAL: "1"
        };

        return axios.request(requestConfig);
    }
}
