"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const abstract_service_1 = require("./abstract-service");
const axios_1 = require("axios");
var SetStateValue;
(function (SetStateValue) {
    SetStateValue[SetStateValue["ON"] = 1] = "ON";
    SetStateValue[SetStateValue["OFF"] = 0] = "OFF";
    SetStateValue[SetStateValue["AUTO"] = 2] = "AUTO";
})(SetStateValue = exports.SetStateValue || (exports.SetStateValue = {}));
class UsrcfgCgiService extends abstract_service_1.AbstractService {
    constructor(config, getStateService, relayDataInterpreter) {
        super(config);
        this._endpoint = "/usrcfg.cgi";
        this._method = "post";
        this.relayDataInterpreter = relayDataInterpreter;
        this.getStateService = getStateService;
        this.stateData = this.getStateService.data;
        this._requestHeaders["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
    }
    setOn(relayData) {
        this.setState(relayData, SetStateValue.ON);
    }
    setOff(relayData) {
        this.setState(relayData, SetStateValue.OFF);
    }
    setAuto(relayData) {
        this.setState(relayData, SetStateValue.AUTO);
    }
    setState(relay, state) {
        let data = undefined;
        // let desiredValue: number;
        switch (state) {
            case SetStateValue.AUTO:
                data = this.relayDataInterpreter.evaluate(this.getStateService.data).setAuto(relay);
                // desiredValue = relay.raw & ~RelayStateBitMask.manual;
                break;
            case SetStateValue.ON:
                data = this.relayDataInterpreter.evaluate(this.getStateService.data).setOn(relay);
                // desiredValue = RelayStateBitMask.manual | RelayStateBitMask.on;
                break;
            case SetStateValue.OFF:
            default:
                data = this.relayDataInterpreter.evaluate(this.getStateService.data).setOff(relay);
                // desiredValue = RelayStateBitMask.manual | ~RelayStateBitMask.on;
                break;
        }
        if (data !== undefined) {
            this.send(data).catch((error) => {
                console.error(error);
            });
            // .then((response) => {
            //     console.log(response.data);
            //     if (["continue", "done"].indexOf(response.data.toLowerCase()) >= 0) {
            //     // if (response.status === 200) {
            //         this.getStateService.data.objects[relay.id].set(
            //             relay.id,
            //             relay.label,
            //             relay.unit,
            //             relay.offset.toString(),
            //             relay.gain.toString(),
            //             desiredValue.toString()
            //         );
            //         this.getStateService.update();
            //     } else {
            //         console.error(`(${response.status}: ${response.statusText}) Error sending relay control command:`, response.data);
            //     }
            // }).catch((error) => {
            //     console.error(error);
            // });
        }
    }
    send(bitTupel) {
        const requestConfig = this.axiosRequestConfig;
        requestConfig.data = {
            ENA: bitTupel.join(","),
            MANUAL: "1"
        };
        return axios_1.default.request(requestConfig);
    }
}
exports.UsrcfgCgiService = UsrcfgCgiService;
