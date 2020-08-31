import {AxiosRequestConfig, Method} from "axios";
import {Agent} from "http";

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
    protected _agent: Agent;
    protected _timeout: number;
    protected _requestHeaders: any;

    protected log: ioBroker.Logger;

    protected constructor(config: ioBroker.AdapterConfig, logger: ioBroker.Logger) {
        this._requestHeaders = {};
        this._baseUrl = config.controllerUrl;
        this._username = config.username;
        this._password = config.password;
        this._basicAuth = config.basicAuth;
        this._timeout = 4500;
        this._agent = new Agent({
            /**
             * Socket timeout in milliseconds. This will set the timeout after the socket is connected.
             */
            timeout: this._timeout,
            /**
             * Maximum number of sockets to allow per host. Default for Node 0.10 is 5, default for Node 0.12 is Infinity
             */
            maxSockets: 16,
            /**
             * Maximum number of sockets to leave open in a free state. Only relevant if keepAlive is set to true. Default = 256.
             */
            maxFreeSockets: 8,
            /**
             * Keep sockets around in a pool to be used by other requests in the future. Default = false
             */
            keepAlive: true,
            /**
             * When using HTTP KeepAlive, how often to send TCP KeepAlive packets over sockets being kept alive. Default = 1000.
             * Only relevant if keepAlive is set to true.
             */
            keepAliveMsecs: this._timeout
        });
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
            httpAgent: this._agent,
            // baseURL: this._baseUrl,
            timeout: this._timeout,
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
