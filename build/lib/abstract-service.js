"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AbstractService {
    constructor(config) {
        this.const = AbstractService;
        this._requestHeaders = new Headers();
        this._baseUrl = config.baseUrl;
        this._username = config.username;
        this._password = config.password;
        this._basicAuth = config.basicAuth;
    }
    // public get baseUrl(): string {
    //     return this._baseUrl;
    // }
    //
    // public get requestHeaders(): object {
    //     // if (this._basicAuth) {
    //     //     this.setHttpHeader("Authorization", `Basic ${this.base64Credentials}`)
    //     // }
    //
    //     return this._requestHeaders;
    // }
    //
    // public get url(): string {
    //     return new URL(this.baseUrl + this._endpoint).href;
    // }
    //
    // public setHttpHeader(name: string, value: string) {
    //     this._requestHeaders.set(name, value);
    // }
    //
    // private get base64Credentials(): string {
    //     return atob(`${this._username}:${this._password}`);
    // }
    get axiosRequestConfig() {
        const config = {
            baseURL: this._baseUrl,
            url: this._endpoint,
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
