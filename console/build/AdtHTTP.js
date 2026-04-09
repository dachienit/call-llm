"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtHTTP = exports.AxiosHttpClient = exports.FetchHttpClient = exports.session_types = void 0;
const axios_1 = __importStar(require("axios"));
const AdtException_1 = require("./AdtException");
const _1 = require(".");
const requestLogger_1 = require("./requestLogger");
const utilities_1 = require("./utilities");
const FETCH_CSRF_TOKEN = "fetch";
const CSRF_TOKEN_HEADER = "x-csrf-token";
const SESSION_HEADER = "X-sap-adt-sessiontype";
const runningInNode = typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null;
let lastClientId = 0;
var session_types;
(function (session_types) {
    session_types["stateful"] = "stateful";
    session_types["stateless"] = "stateless";
    session_types["keep"] = "";
})(session_types = exports.session_types || (exports.session_types = {}));
const toAxiosConfig = (options) => {
    const config = {
        method: options.method || "GET",
        url: options.url,
        headers: options.headers || {},
        params: options.qs,
        httpsAgent: options.httpsAgent,
        timeout: options.timeout,
        auth: options.auth,
        data: options.body,
        adtRequestNumber: options.adtRequestNumber,
        adtStartTime: options.adtStartTime
    };
    return config;
};
let adtRequestNumber = 0;
const convertheaders = (raw) => {
    if (raw instanceof axios_1.AxiosHeaders)
        return raw;
    const headers = new axios_1.AxiosHeaders();
    for (const k in Object.keys(raw))
        headers.set(k, raw[k]);
    return headers;
};
class FetchHttpClient {
    constructor(baseURL, config) {
        this.baseURL = baseURL;
        this.httpsAgent = config === null || config === void 0 ? void 0 : config.httpsAgent;
    }
    async request(options) {
        const { url = "", method = "GET", headers = {}, qs, timeout, body, auth } = options;
        // Build full URL with base and query params
        const fullUrl = new URL(url, this.baseURL);
        if (qs) {
            Object.entries(qs).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    fullUrl.searchParams.append(key, String(value));
                }
            });
        }
        // Prepare headers, clone to avoid mutating input
        const requestHeaders = new Headers({ ...headers });
        // Add basic auth header if auth is present
        if ((auth === null || auth === void 0 ? void 0 : auth.username) && (auth === null || auth === void 0 ? void 0 : auth.password)) {
            const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
            requestHeaders.set("Authorization", `Basic ${encoded}`);
        }
        // Handle HTTPS agent for Node.js
        let agent = undefined;
        if (this.httpsAgent) {
            agent = this.httpsAgent;
        }
        // Timeout with AbortController
        const controller = new AbortController();
        const timeoutId = timeout
            ? setTimeout(() => controller.abort(), timeout)
            : undefined;
        try {
            const response = await fetch(fullUrl.toString(), {
                method,
                headers: requestHeaders,
                body,
                // @ts-ignore Node.js fetch accepts agent this way
                agent,
                signal: controller.signal,
            });
            if (timeoutId)
                clearTimeout(timeoutId);
            // Get response text (proxy issue workaround is here)
            let responseText = await response.text();
            // If responseText looks like raw HTTP response (proxy issue), extract body
            if (responseText.startsWith("HTTP/")) {
                const splitIndex = responseText.indexOf("\r\n\r\n");
                if (splitIndex !== -1) {
                    responseText = responseText.substring(splitIndex + 4);
                }
            }
            // Try JSON parse, fallback to text
            let parsedBody = responseText;
            try {
                parsedBody = JSON.parse(responseText);
            }
            catch (_a) {
                // not JSON, keep text
            }
            // Convert headers to plain object for compatibility
            const responseHeaders = new axios_1.AxiosHeaders();
            response.headers.forEach((value, key) => {
                responseHeaders.set(key, value);
            });
            if (!response.ok) {
                // Throw error with status and body
                throw new Error(`HTTP error ${response.status}: ${response.statusText}\n${responseText}`);
            }
            return {
                body: typeof parsedBody === "string" ? parsedBody : JSON.stringify(parsedBody),
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
            };
        }
        catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(`Request timed out after ${timeout} ms`);
            }
            throw error;
        }
    }
}
exports.FetchHttpClient = FetchHttpClient;
class AxiosHttpClient {
    constructor(baseURL, config) {
        this.baseURL = baseURL;
        const conf = toAxiosConfig({ ...config });
        this.axios = axios_1.default.create({ ...conf, baseURL });
    }
    async request(options) {
        try {
            const config = toAxiosConfig(options);
            const { data, headers, ...rest } = await this.axios.request(config);
            let parsedData;
            // Overcome proxy issue
            if (typeof data === 'string' && data.startsWith('HTTP/')) {
                const splitIndex = data.indexOf('\r\n\r\n');
                if (splitIndex !== -1) {
                    const body = data.substring(splitIndex + 4);
                    try {
                        parsedData = JSON.parse(body); // or return body if it's plain text
                    }
                    catch (e) {
                        parsedData = body;
                    }
                }
            }
            const body = parsedData ? ((0, utilities_1.isString)(parsedData) ? parsedData : `${parsedData}`) : "";
            return { body, headers: convertheaders(headers), ...rest };
        }
        catch (error) {
            throw (0, _1.fromError)(error);
        }
    }
}
exports.AxiosHttpClient = AxiosHttpClient;
class AdtHTTP {
    get isStateful() {
        return (this.stateful === session_types.stateful ||
            (this.stateful === session_types.keep &&
                this.currentSession === session_types.stateful));
    }
    get stateful() {
        return this._stateful;
    }
    set stateful(value) {
        this._stateful = value;
        if (value !== session_types.keep)
            this.currentSession = value;
    }
    get csrfToken() {
        return this.commonHeaders[CSRF_TOKEN_HEADER] || FETCH_CSRF_TOKEN;
    }
    set csrfToken(token) {
        this.commonHeaders[CSRF_TOKEN_HEADER] = token;
    }
    get loggedin() {
        return this.csrfToken !== FETCH_CSRF_TOKEN;
    }
    constructor(baseURLOrClient, username, password, client, language, config) {
        this.username = username;
        this.client = client;
        this.language = language;
        this.isClone = false;
        this.currentSession = session_types.stateless;
        this._stateful = session_types.stateless;
        this.needKeepalive = false;
        this.cookie = new Map();
        this.keep_session = async () => {
            if (this.needKeepalive && this.loggedin)
                await this._request("/sap/bc/adt/compatibility/graph", {}).catch(() => { });
            this.needKeepalive = true;
        };
        if (!(baseURLOrClient && username && (password || !(0, utilities_1.isString)(baseURLOrClient))))
            throw (0, _1.adtException)("Invalid ADTClient configuration: url, login and password are required");
        this.baseURL = (0, utilities_1.isString)(baseURLOrClient) ? baseURLOrClient : "";
        this.id = lastClientId++;
        if ((0, utilities_1.isString)(password))
            this.password = password;
        else
            this.getToken = password;
        this.commonHeaders = {
            ...config === null || config === void 0 ? void 0 : config.headers,
            Accept: "*/*",
            "Cache-Control": "no-cache",
            [CSRF_TOKEN_HEADER]: FETCH_CSRF_TOKEN
        };
        this.httpclient = (0, utilities_1.isString)(baseURLOrClient)
            //? new AxiosHttpClient(baseURLOrClient, config)
            ? new FetchHttpClient(baseURLOrClient, config)
            : baseURLOrClient;
        this.debugCallback = config === null || config === void 0 ? void 0 : config.debugCallback;
        if (config === null || config === void 0 ? void 0 : config.keepAlive)
            this.keepAlive = setInterval(() => this.keep_session(), 120000);
    }
    async login() {
        if (this.loginPromise)
            return this.loginPromise;
        this.cookie.clear();
        // oauth
        if (this.getToken && !this.bearer) {
            await this.getToken().then(bearer => (this.bearer = bearer));
        }
        else
            this.auth = {
                username: this.username || "",
                password: this.password || ""
            };
        const qs = {};
        if (this.client)
            qs["sap-client"] = this.client;
        if (this.language)
            qs["sap-language"] = this.language;
        this.csrfToken = FETCH_CSRF_TOKEN;
        try {
            this.loginPromise = this._request("/sap/bc/adt/compatibility/graph", {
                qs
            });
            await this.loginPromise;
        }
        finally {
            this.loginPromise = undefined;
        }
    }
    ascookies() {
        return [...this.cookie.values()].join("; ");
    }
    async logout() {
        this.stateful = session_types.stateless;
        await this._request("/sap/public/bc/icf/logoff", {});
        // prevent autologin
        this.auth = undefined;
        this.bearer = undefined;
        // new cookie jar
        this.cookie.clear();
        // clear token
        this.csrfToken = FETCH_CSRF_TOKEN;
    }
    async dropSession() {
        this.stateful = session_types.stateless;
        await this._request("/sap/bc/adt/compatibility/graph", {});
    }
    async request(url, config) {
        let autologin = false;
        try {
            if (!this.loggedin) {
                autologin = true;
                await this.login();
            }
            return await this._request(url, config || {});
        }
        catch (e) {
            const adtErr = (0, AdtException_1.fromException)(e, config);
            // if the logon ticket expired try to logon again, unless in stateful mode
            // or already tried a login
            if ((0, _1.isLoginError)(adtErr) && !autologin && !this.isStateful) {
                try {
                    this.csrfToken = FETCH_CSRF_TOKEN;
                    await this.login();
                    return await this._request(url, config || {});
                }
                catch (e2) {
                    throw (0, AdtException_1.fromException)(e2, config);
                }
            }
            else
                throw adtErr;
        }
    }
    updateCookies(response) {
        if (runningInNode) {
            const rawCookies = response.headers["set-cookie"];
            if (rawCookies) {
                const cookieList = Array.isArray(rawCookies)
                    ? rawCookies
                    : typeof rawCookies === "string"
                        ? [rawCookies]
                        : [];
                for (const cookie of cookieList) {
                    const cleaned = cookie
                        .replace(/path=\/,/gi, "")
                        .replace(/path=\//gi, "")
                        .split(";")[0]
                        .trim();
                    const [key] = cleaned.split("=", 1);
                    if (key) {
                        this.cookie.set(key, cleaned);
                    }
                }
            }
        }
    }
    logResponse(exceptionOrResponse, options) {
        if (!this.debugCallback)
            return;
        if ((0, _1.isAdtException)(exceptionOrResponse))
            (0, requestLogger_1.logError)(this.id, exceptionOrResponse, this.debugCallback, options);
        else
            (0, requestLogger_1.logResponse)(this.id, exceptionOrResponse, options, this.debugCallback);
    }
    /**
     * HTTP request without automated login / retry
     *
     * @param url URL suffix
     * @param options request options
     */
    async _request(url, options) {
        this.needKeepalive = false;
        const headers = { ...this.commonHeaders, ...options.headers };
        headers[SESSION_HEADER] = this.stateful;
        if (!headers["Cookie"] && runningInNode)
            headers["Cookie"] = this.ascookies();
        adtRequestNumber++;
        const adtStartTime = new Date();
        const config = {
            ...options,
            auth: this.auth,
            headers,
            adtStartTime,
            adtRequestNumber,
            url
        };
        try {
            if (this.getToken && !this.bearer)
                this.bearer = await this.getToken();
            if (this.bearer)
                headers.Authorization = `bearer ${this.bearer}`;
            const response = await this.httpclient.request(config);
            this.updateCookies(response);
            if (response.status >= 400)
                throw (0, AdtException_1.fromException)(response, config);
            if (this.csrfToken === FETCH_CSRF_TOKEN &&
                (0, utilities_1.isString)(response.headers[CSRF_TOKEN_HEADER]))
                this.csrfToken = response.headers[CSRF_TOKEN_HEADER];
            this.logResponse(response, config);
            return response;
        }
        catch (error) {
            const exc = (0, AdtException_1.fromException)(error, config);
            this.logResponse(exc, config);
            throw exc;
        }
    }
}
exports.AdtHTTP = AdtHTTP;
