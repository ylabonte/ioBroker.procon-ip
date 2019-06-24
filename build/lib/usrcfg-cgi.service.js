"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const abstract_service_1 = require("./abstract-service");
const relay_data_interpreter_1 = require("./relay-data-interpreter");
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
        this._requestHeaders.set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
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
        let desiredValue;
        switch (state) {
            case SetStateValue.ON:
                data = this.relayDataInterpreter.evaluate(this.getStateService.data).setOn(relay);
                desiredValue = relay_data_interpreter_1.RelayStateBitMask.manual | relay_data_interpreter_1.RelayStateBitMask.on;
                break;
            case SetStateValue.OFF:
                data = this.relayDataInterpreter.evaluate(this.getStateService.data).setOff(relay);
                desiredValue = relay_data_interpreter_1.RelayStateBitMask.manual | ~relay_data_interpreter_1.RelayStateBitMask.on;
                break;
            case SetStateValue.AUTO:
                data = this.relayDataInterpreter.evaluate(this.getStateService.data).setAuto(relay);
                desiredValue = relay.raw & ~relay_data_interpreter_1.RelayStateBitMask.manual;
                break;
        }
        if (data !== undefined) {
            this.send(data).then((response) => {
                console.log(response);
                if (["continue", "done"].indexOf(response.data.toLowerCase()) >= 0) {
                    this.getStateService.data.objects[relay.id].set(relay.id, relay.label, relay.unit, relay.offset.toString(), relay.gain.toString(), desiredValue.toString());
                    // this.getStateService.update();
                }
                else {
                    console.error(`(${response.status}: ${response.statusText}) Error sending relay control command:`, response.data);
                }
            }).catch((error) => {
                console.error(error);
            });
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
