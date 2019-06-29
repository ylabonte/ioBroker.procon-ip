import axios, {AxiosPromise, Method} from "axios";
import {AbstractService, IServiceConfig} from "./abstract-service";
import {GetStateData} from "./get-state-data";

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

    private _hasData = false;

    private next: number|undefined;

    private _updateInterval: number;

    private _updateCallback: (data: GetStateData) => any;

    public constructor(config: ioBroker.AdapterConfig, logger: ioBroker.Logger) {
        super(config, logger);
        this.data = new GetStateData();
        this._updateInterval = config.updateInterval;
        this._requestHeaders.Accept = "text/csv,text/plain";
        this._updateCallback = () => {};
    }

    public getUpdateInterval(): number {
        return this._updateInterval;
    }

    public setUpdateInterval(milliseconds: number) {
        this._updateInterval = milliseconds;
    }

    public isRunning(): boolean {
        return typeof this.next === "number";
    }

    public start(callable: (data: GetStateData) => any) {
        this._updateCallback = callable;
        this.autoUpdate();
    }

    public stop() {
        clearTimeout(this.next);
        this.next = undefined;
    }

    public autoUpdate() {
        this.update();
        if (this.next === undefined) {
            this.next = Number(setTimeout(() => {
                this.next = undefined;
                this.autoUpdate();
            }, this.getUpdateInterval()));
        }
    }

    public update() {
        this.getData().then((response) => {
            this.data.parseCsv(response.data);
            this._hasData = true;
            this._updateCallback(this.data);
        },
        (e) => {
            this._hasData = false;
            this.log.error(e);
        });
    }

    public getData(): AxiosPromise<string> {
        return axios.request(this.axiosRequestConfig);
    }

    public hasData(): boolean {
        return this._hasData;
    }
}
