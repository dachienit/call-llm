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
exports.mixed = exports.orUndefined = exports.toXmlAttributes = exports.formatQS = exports.boolFromAbap = exports.followUrl = exports.parts = exports.btoa = exports.parseJsonDate = exports.toSapDate = exports.parseSapDate = exports.toInt = exports.parse = exports.fullParse = exports.numberParseOptions = exports.bar = exports.typedNodeAttr = exports.xmlNodeAttr = exports.stripNs = exports.xmlRoot = exports.xmlArray = exports.xmlFlatArray = exports.xmlNode = exports.extractXmlArray = exports.xmlArrayType = exports.JSON2AbapXML = exports.isUndefined = exports.isNativeError = exports.isNumber = exports.isString = exports.isArray = exports.isObject = exports.encodeEntity = void 0;
const fast_xml_parser_1 = require("fast-xml-parser");
const t = __importStar(require("io-ts"));
var html_entities_1 = require("html-entities");
Object.defineProperty(exports, "encodeEntity", { enumerable: true, get: function () { return html_entities_1.encode; } });
const html_entities_2 = require("html-entities");
const isObject = (x) => !!x && typeof x === "object";
exports.isObject = isObject;
const isArray = (x) => Array.isArray(x);
exports.isArray = isArray;
const isString = (x) => typeof x === "string";
exports.isString = isString;
const isNumber = (x) => typeof x === "number";
exports.isNumber = isNumber;
const isNativeError = (e) => !!e && e instanceof Error;
exports.isNativeError = isNativeError;
const isUndefined = (x) => typeof x === "undefined";
exports.isUndefined = isUndefined;
function JSON2AbapXML(original, root = "DATA") {
    // only flat objects for now, might extend later...
    let inner = "";
    for (const key of Object.keys(original))
        if (original[key])
            inner = `${inner}\n<${key}>${(0, html_entities_2.encode)(original[key]) || ""}</${key}>`;
        else
            inner = `${inner}\n<${key}/>`;
    return `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
    <asx:values>
      <${root}>
        ${inner}
      </${root}>
    </asx:values>
  </asx:abap>`;
}
exports.JSON2AbapXML = JSON2AbapXML;
const xmlArrayType = (x) => t.union([t.array(x), x, t.undefined]);
exports.xmlArrayType = xmlArrayType;
const extractXmlArray = (x) => x ? ((0, exports.isArray)(x) ? x : [x]) : [];
exports.extractXmlArray = extractXmlArray;
function xmlNode(xml, ...path) {
    let current = xml;
    path.some(key => {
        // @ts-ignore
        if ((0, exports.isObject)(current))
            current = current[key];
        return !current;
    });
    return current;
}
exports.xmlNode = xmlNode;
function xmlFlatArray(xml, ...path) {
    if (!xml)
        return [];
    if (path.length === 0) {
        if ((0, exports.isArray)(xml))
            return xml;
        else
            return [xml];
    }
    if ((0, exports.isArray)(xml))
        return xml.reduce((arr, x) => [...arr, ...xmlFlatArray(x, ...path)], []);
    if ((0, exports.isObject)(xml)) {
        const [idx, ...rest] = path;
        // @ts-ignore
        return xmlFlatArray(xml[idx], ...rest);
    }
    return [];
}
exports.xmlFlatArray = xmlFlatArray;
function xmlArray(xml, ...path) {
    const node = xmlNode(xml, ...path);
    if (node) {
        if ((0, exports.isArray)(node))
            return node;
        else
            return [node];
    }
    return [];
}
exports.xmlArray = xmlArray;
const ok = Object.keys;
const xmlRoot = (o) => o[ok(o).filter(k => k !== "?xml")[0]];
exports.xmlRoot = xmlRoot;
const stripNs = (x) => x &&
    ok(x).reduce((obj, key) => {
        const nk = key.split(":").slice(1).join(":") || key;
        if (nk in obj)
            obj[key] = key;
        else
            obj[nk] = x[key];
        return obj;
    }, {});
exports.stripNs = stripNs;
const stripAttrPrefix = (x) => x.replace(/^@_/, "");
// extract XML attributes of a node from its JSON representation
const xmlNodeAttr = (n) => n &&
    ok(n)
        .filter(k => k.match(/^(?!@_xmlns)@_/))
        .reduce((part, cur) => {
        part[cur.replace(/^@_/, "")] = n[cur];
        return part;
    }, {});
exports.xmlNodeAttr = xmlNodeAttr;
const typedNodeAttr = (n) => n &&
    ok(n)
        .filter(k => k.match(/^(?!@_xmlns)@_/))
        .reduce((part, cur) => {
        // @ts-ignore
        part[cur.replace(/^@_/, "")] = n[cur];
        return part;
    }, {});
exports.typedNodeAttr = typedNodeAttr;
exports.bar = stripAttrPrefix("@_pip");
exports.numberParseOptions = {
    leadingZeros: false,
    hex: true,
    skipLike: new RegExp("")
};
const fullParse = (xml, options = {}) => new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    trimValues: false,
    parseAttributeValue: true,
    ...options
}).parse(xml);
exports.fullParse = fullParse;
const parse = (xml, options = {}) => new fast_xml_parser_1.XMLParser(options).parse(xml);
exports.parse = parse;
function toInt(x) {
    if (!x)
        return 0;
    if (x.match(/^\s*[+-]?\d*\s*$/))
        return Number.parseInt(x, 10);
    return 0;
}
exports.toInt = toInt;
const parseSapDate = (d) => {
    const match = d.match(/(\d\d\d\d)(\d\d)(\d\d)/);
    if (!match)
        return new Date(); // wrong but valid
    const [Y, M, D] = match.slice(1);
    return Date.UTC(toInt(Y), toInt(M) - 1, toInt(D));
};
exports.parseSapDate = parseSapDate;
const toSapDate = (d) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
exports.toSapDate = toSapDate;
const parseJsonDate = (d) => new Date(Date.parse(d));
exports.parseJsonDate = parseJsonDate;
function btoa(s) {
    return Buffer.from(s).toString("base64");
}
exports.btoa = btoa;
function parts(whole, pattern) {
    if (!(0, exports.isString)(whole))
        return [];
    const match = whole.match(pattern);
    return match ? match.slice(1) : [];
}
exports.parts = parts;
const followUrl = (base, extra) => {
    if (extra.match(/^\.\//)) {
        base = base.replace(/[^\/]*$/, "");
        extra = extra.replace(/^\.\//, "");
    }
    else
        extra = extra.replace(/^\//, "");
    base = base.replace(/\/$/, "");
    return base + "/" + extra;
};
exports.followUrl = followUrl;
const boolFromAbap = (x) => x === "X";
exports.boolFromAbap = boolFromAbap;
function formatQS(raw) {
    const val = (key, x) => (0, exports.isArray)(x)
        ? x.map(e => val(key, e)).join("&")
        : `${key}=${encodeURIComponent(x)}`;
    return Object.getOwnPropertyNames(raw)
        .map(k => val(k, raw[k]))
        .join("&");
}
exports.formatQS = formatQS;
const toXmlAttributes = (o, prefix) => {
    const sep = prefix ? ":" : "";
    return o
        ? Object.getOwnPropertyNames(o)
            .sort()
            .map(k => `${prefix}${sep}${k.replace(/^@_/, "")}="${o[k]}"`)
            .join(" ")
        : "";
};
exports.toXmlAttributes = toXmlAttributes;
const orUndefined = (x) => t.union([t.undefined, x]);
exports.orUndefined = orUndefined;
function mixed(required, optional) {
    return t.intersection([t.type(required), t.partial(optional)]);
}
exports.mixed = mixed;
