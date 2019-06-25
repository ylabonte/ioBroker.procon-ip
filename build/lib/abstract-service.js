"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AbstractService {
    constructor(config) {
        this.const = AbstractService;
        this._requestHeaders = {};
        this._baseUrl = config.baseUrl;
        this._username = config.username;
        this._password = config.password;
        this._basicAuth = config.basicAuth;
    }
    get baseUrl() {
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
    get url() {
        console.log("baseUrl", this.baseUrl);
        console.log("_endpoint", this._endpoint);
        try {
            return new URL(`${this.baseUrl}/${this._endpoint}`).href;
        }
        catch (e) {
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
    get axiosRequestConfig() {
        const config = {
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
exports.AbstractService = AbstractService;
