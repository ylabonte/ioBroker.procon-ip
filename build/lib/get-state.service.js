"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const abstract_service_1 = require("./abstract-service");
const get_state_data_1 = require("./get-state-data");
class GetStateService extends abstract_service_1.AbstractService {
    constructor(config) {
        super(config);
        this._endpoint = "/GetState.csv";
        this._method = "get";
        this._hasData = false;
        this.data = new get_state_data_1.GetStateData();
        this._updateInterval = config.updateInterval;
        this._requestHeaders.Accept = "text/csv,text/plain";
        this._updateCallback = () => { };
    }
    getUpdateInterval() {
        return this._updateInterval;
    }
    setUpdateInterval(milliseconds) {
        this._updateInterval = milliseconds;
    }
    isRunning() {
        return typeof this.next === "number";
    }
    start(callable) {
        this._updateCallback = callable;
        this.autoUpdate();
    }
    stop() {
        clearTimeout(this.next);
        this.next = undefined;
    }
    autoUpdate() {
        this.update();
        if (this.next === null) {
            this.next = Number(setTimeout(() => {
                this.next = undefined;
                this.autoUpdate();
            }, this.getUpdateInterval()));
        }
    }
    update() {
        this.getData().then((data) => {
            this.data.parseCsv(data.data);
            this._hasData = true;
            //@todo Hide error view
            this._updateCallback();
        }, (_) => {
            this._hasData = false;
            //@todo Show the error view
        });
    }
    getData() {
        return axios_1.default.request(this.axiosRequestConfig);
    }
    hasData() {
        return this._hasData;
    }
}
exports.GetStateService = GetStateService;
