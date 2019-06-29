import {AxiosRequestConfig, Method} from "axios";

export interface IServiceConfig {
    baseUrl: string;
    endpoint: string;
    username: string;
    password: string;
    basicAuth: boolean;
}

export abstract class AbstractService {
    abstract _endpoint: string;
    abstract _method: Method;
    protected _baseUrl: string;
    protected _username: string;
    protected _password: string;
    protected _basicAuth: boolean;

    protected _requestHeaders: any;

    protected log: ioBroker.Logger;

    protected constructor(config: ioBroker.AdapterConfig, logger: ioBroker.Logger) {
        this._requestHeaders = {};
        this._baseUrl = config.controllerUrl;
        this._username = config.username;
        this._password = config.password;
        this._basicAuth = config.basicAuth;
        this.log = logger;
    }

    public get baseUrl(): string {
        return this._baseUrl;
    }

    // public get requestHeaders(): object {
    //     // if (this._basicAuth) {
    //     //     this.setHttpHeader("Authorization", `Basic ${this.base64Credentials}`)
    //     // }
    //
    //     return this._requestHeaders;
    // }

    /**
     * @throws TypeError [ERR_INVALID_URL]: Invalid URL
     */
    public get url(): string {
        try {
            return new URL(
                (this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`) +
                    (this._endpoint.startsWith("/") ? this._endpoint.substr(1) : this._endpoint)
            ).href;
        } catch (e) {
            console.error(e);
            return this._endpoint;
        }
    }

    // public setHttpHeader(name: string, value: string) {
    //     this._requestHeaders.set(name, value);
    // }
    //
    // private get base64Credentials(): string {
    //     return atob(`${this._username}:${this._password}`);
    // }

    protected get axiosRequestConfig(): AxiosRequestConfig {
        const config: AxiosRequestConfig = {
            // baseURL: this._baseUrl,
            url: this.url,
            method: this._method,
            headers: this._requestHeaders
        };

        if (this._basicAuth) {
            config.auth = {
                username: this._username,
                password: this._password
            };
        }

        return config;
    }
}
