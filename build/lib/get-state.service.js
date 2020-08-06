"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetStateService = void 0;
const axios_1 = require("axios");
const abstract_service_1 = require("./abstract-service");
const get_state_data_1 = require("./get-state-data");
class GetStateService extends abstract_service_1.AbstractService {
    constructor(adapter) {
        super(adapter.config, adapter.log);
        this._endpoint = "/GetState.csv";
        this._method = "get";
        this._hasData = false;
        this.data = new get_state_data_1.GetStateData();
        this._adapter = adapter;
        this._updateInterval = adapter.config.updateInterval;
        this._requestHeaders.Accept = "text/csv,text/plain";
        this._updateCallback = () => { return; };
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
        delete this.next;
        delete this._updateCallback;
    }
    autoUpdate() {
        this.update();
        if (this.next === undefined) {
            this.next = Number(setTimeout(() => {
                delete this.next;
                this.autoUpdate();
            }, this.getUpdateInterval()));
        }
    }
    update() {
        this.getData().then((response) => {
            this._adapter.setState("info.connection", true, true);
            this.data.parseCsv(response.data);
            this._hasData = true;
            if (this._updateCallback !== undefined) {
                this._updateCallback(this.data);
            }
        }, (e) => {
            this._adapter.setState("info.connection", false, true);
            this._hasData = false;
            this.log.warn(e.response ? e.response : e);
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
