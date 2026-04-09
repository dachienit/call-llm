"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unLock = exports.lock = exports.setObjectSource = exports.getObjectSource = void 0;
const AdtException_1 = require("../AdtException");
const utilities_1 = require("../utilities");
async function getObjectSource(h, objectSourceUrl, options) {
    (0, AdtException_1.ValidateObjectUrl)(objectSourceUrl);
    const config = {};
    const { gitPassword, gitUser, version } = options || {};
    if (gitUser || gitPassword) {
        config.headers = {};
        if (gitUser)
            config.headers.Username = gitUser;
        if (gitPassword)
            config.headers.Password = (0, utilities_1.btoa)(gitPassword);
    }
    if (version)
        config.qs = { version };
    const response = await h.request(objectSourceUrl, config);
    return response.body;
}
exports.getObjectSource = getObjectSource;
async function setObjectSource(h, objectSourceUrl, source, lockHandle, transport) {
    (0, AdtException_1.ValidateObjectUrl)(objectSourceUrl);
    (0, AdtException_1.ValidateStateful)(h);
    const qs = { lockHandle };
    const ctype = source.match(/^<\?xml\s/i)
        ? "application/*"
        : "text/plain; charset=utf-8";
    if (transport)
        qs.corrNr = transport;
    await h.request(objectSourceUrl, {
        body: source,
        headers: { "content-type": ctype },
        method: "PUT",
        qs
    });
}
exports.setObjectSource = setObjectSource;
async function lock(h, objectUrl, accessMode = "MODIFY") {
    (0, AdtException_1.ValidateObjectUrl)(objectUrl);
    (0, AdtException_1.ValidateStateful)(h);
    const qs = { _action: "LOCK", accessMode };
    const response = await h.request(objectUrl, {
        headers: {
            Accept: "application/*,application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result"
        },
        method: "POST",
        qs
    });
    const raw = (0, utilities_1.parse)(response.body);
    const locks = (0, utilities_1.xmlArray)(raw, "asx:abap", "asx:values", "DATA");
    return locks[0];
}
exports.lock = lock;
async function unLock(h, objectUrl, lockHandle) {
    (0, AdtException_1.ValidateObjectUrl)(objectUrl);
    const qs = {
        _action: "UNLOCK",
        lockHandle: encodeURIComponent(lockHandle)
    };
    const response = await h.request(objectUrl, {
        method: "POST",
        qs
    });
    return response.body;
}
exports.unLock = unLock;
