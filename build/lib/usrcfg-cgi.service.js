"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    constructor(config, logger, getStateService, relayDataInterpreter) {
        super(config, logger);
        this._endpoint = "/usrcfg.cgi";
        this._method = "post";
        this.relayDataInterpreter = relayDataInterpreter;
        this.getStateService = getStateService;
        this.stateData = this.getStateService.data;
        this._requestHeaders["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
    }
    setOn(relayData) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.setState(relayData, SetStateValue.ON);
        });
    }
    setOff(relayData) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.setState(relayData, SetStateValue.OFF);
        });
    }
    setAuto(relayData) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.setState(relayData, SetStateValue.AUTO);
        });
    }
    setState(relay, state) {
        return __awaiter(this, void 0, void 0, function* () {
            let data = undefined;
            let desiredValue;
            switch (state) {
                case SetStateValue.AUTO:
                    data = this.relayDataInterpreter.evaluate(this.getStateService.data).setAuto(relay);
                    desiredValue = relay.raw & ~relay_data_interpreter_1.RelayStateBitMask.manual;
                    break;
                case SetStateValue.ON:
                    data = this.relayDataInterpreter.evaluate(this.getStateService.data).setOn(relay);
                    desiredValue = relay_data_interpreter_1.RelayStateBitMask.manual | relay_data_interpreter_1.RelayStateBitMask.on;
                    break;
                case SetStateValue.OFF:
                default:
                    data = this.relayDataInterpreter.evaluate(this.getStateService.data).setOff(relay);
                    desiredValue = relay_data_interpreter_1.RelayStateBitMask.manual | ~relay_data_interpreter_1.RelayStateBitMask.on;
                    break;
            }
            this.log.info(`usrcfg.cgi data: ${JSON.stringify(data)}`);
            return new Promise((resolve, reject) => {
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
                    }
                    else {
                        reject(`(${response.status}: ${response.statusText}) Error sending relay control command: ${response.data}`);
                    }
                }).catch((e) => {
                    reject("response" in e ? e.response : e);
                });
            });
        });
    }
    send(bitTupel) {
        // private send(bitTupel: [number, number]): /*Axios*/Promise<{data: string; status: number; statusText: string}> {
        const requestConfig = this.axiosRequestConfig;
        requestConfig.data = `ENA=${encodeURIComponent(bitTupel.join(","))}&MANUAL=1`;
        this.log.debug(JSON.stringify(requestConfig));
        // return new Promise((resolve, reject) => {
        //     if (requestConfig.data.ENA.search("-") >= 0) {
        //         reject("fuck it! why negative numbers?!");
        //     }
        //     resolve({data: "", status: 200, statusText: "OK"});
        // });
        return axios_1.default.request(requestConfig);
    }
}
exports.UsrcfgCgiService = UsrcfgCgiService;
