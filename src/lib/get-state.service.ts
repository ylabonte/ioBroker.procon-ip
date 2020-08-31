import * as utils from "@iobroker/adapter-core";
import axios, {AxiosPromise, Method} from "axios";
import {AbstractService, IServiceConfig} from "./abstract-service";
import {GetStateData} from "./get-state-data";
import { ProconIp } from "../main";

export interface IGetStateServiceConfig extends IServiceConfig {
    baseUrl: string;
    endpoint: string;
    username: string;
    password: string;
    basicAuth: boolean;
    updateInterval: number;
}

export class GetStateService extends AbstractService {
    public _endpoint = "/GetState.csv";
    public _method: Method = "get";

    public data: GetStateData;

    private _adapter: utils.AdapterInstance;

    private _hasData = false;

    private next: number|undefined;

    private _updateInterval: number;

    private _updateCallback: (data: GetStateData) => any;

    private _maxConsecutiveFails = 2;

    private _consecutiveFails: number;

    private _recentError: any;

    public constructor(adapter: ProconIp) {
        super(adapter.config, adapter.log);
        this.data = new GetStateData();
        this._adapter = adapter;
        this._updateInterval = adapter.config.updateInterval;
        this._requestHeaders.Accept = "text/csv,text/plain";
        this._updateCallback = () => { return; };
        this._consecutiveFails = 0;
    }

    public getUpdateInterval(): number {
        return this._updateInterval;
    }

    public setUpdateInterval(milliseconds: number): void {
        this._updateInterval = milliseconds;
    }

    public isRunning(): boolean {
        return typeof this.next === "number";
    }

    public start(callable: (data: GetStateData) => any): void {
        this._updateCallback = callable;
        this.autoUpdate();
    }

    public stop(): void {
        clearTimeout(this.next);
        delete this.next;
        delete this._updateCallback;
    }

    public autoUpdate(): void {
        this.update();
        if (this.next === undefined) {
            this.next = Number(setTimeout(() => {
                delete this.next;
                this.autoUpdate();
            }, this.getUpdateInterval()));
        }
    }

    public update(): void {
        this.getData().then((response) => {
            this._adapter.setState("info.connection", true, true);
            delete this.data;
            this.data = new GetStateData(response.data);
            this._hasData = true;
            if (this._updateCallback !== undefined) {
                this._updateCallback(this.data);
            }
        },
        (e) => {
            this._consecutiveFails += 1;
            if (this._consecutiveFails > this._maxConsecutiveFails && this._recentError == e) {
                this._consecutiveFails = 0;
                this._recentError = null;
                this._adapter.setState("info.connection", false, true);
                this._hasData = false;
                this.log.warn(`${this._consecutiveFails} consecutive requests failed: ${e.response ? e.response : e}`);
            } else {
                if (this._recentError != e) {
                    this.log.info(`${this._consecutiveFails} request(s) failed: ${e.response ? e.response : e}`);
                    this._recentError = e;
                } else {
                    this.log.debug(`${this._consecutiveFails} request(s) failed: ${e.response ? e.response : e}`);
                }
            }
        });
    }

    public getData(): AxiosPromise<string> {
        return axios.request(this.axiosRequestConfig);
    }

    public hasData(): boolean {
        return this._hasData;
    }
}
