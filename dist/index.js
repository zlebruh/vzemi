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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fetchStore = __importStar(require("./store"));
const utils_1 = require("./utils");
const META = { origins: new Map(), collections: {}, dispatchAlways: '' };
const VIRTUAL_METHODS = new Set(['get', 'put', 'post', 'patch', 'delete']);
const VERIFY = {
    name: { test: (v) => v in META.collections, text: "Collection '{{value}}' was not recognized" },
    url: { text: "Collection '{{value}}' has no URL" },
    method: { text: "Collection '{{value}}' has no method" },
};
const buildURL = (req, method) => {
    const { origin = '', url } = req.collection;
    const result = origin + url + (req.special.$path || '');
    const postfix = method.toUpperCase() === 'GET' ? (0, utils_1.propsToCGI)(req.body) : '';
    return result + postfix;
};
function buildInfo(fetchProps) {
    const { name, props } = fetchProps;
    const collection = META.collections[name];
    const method = (fetchProps.method || (collection === null || collection === void 0 ? void 0 : collection.method) || '').toUpperCase();
    const problems = verifyInfo({ name, method, url: collection === null || collection === void 0 ? void 0 : collection.url });
    if (problems.length)
        return { problems };
    const req = buildReq(name, props, method);
    const url = buildURL(req, method);
    return { req, url };
}
function verifyInfo(info) {
    return Object.keys(VERIFY)
        .map((key) => {
        const { test, text } = VERIFY[key];
        return !(0, utils_1.isString)(info[key], true) || !(test ? test(info.name) : true)
            ? text.replace('{{value}}', info.name)
            : null;
    }).filter(Boolean);
}
function buildReq(name, props, method) {
    var _a;
    const collection = META.collections[name];
    const { params, special } = (0, utils_1.splitProps)(props);
    const hash = `${name}+++${JSON.stringify(params)}`;
    const body = special.$body || Object.assign(Object.assign({}, collection.props), params);
    const multi = Array.isArray(collection.collections) && Boolean(collection.collections.length);
    const spawned = Date.now();
    const originOptions = META.origins.get(collection.origin);
    const options = Object.assign(Object.assign(Object.assign(Object.assign({}, originOptions), collection.options), special.$options), { method: method || collection.method, headers: Object.assign(Object.assign(Object.assign(Object.assign({}, originOptions.headers), collection.headers), (_a = special.$options) === null || _a === void 0 ? void 0 : _a.headers), special.$headers) });
    return { collection, body, options, props, special, name, hash, multi, spawned };
}
// TODO: Started throwing compile errors after updating TS // const buildFetchArgs = (req: ReqProps, url: string) => {
const buildFetchArgs = (req, url) => {
    const { collection, options, props, body } = req;
    if (options.method !== 'GET') {
        if (collection.isFile) {
            Object.assign(options.headers, { enctype: 'multipart/form-data' });
            options.body = props.formData;
        }
        else {
            options.body = JSON.stringify(body);
        }
    }
    return { url, options };
};
const doMock = async (req, fetchArgs) => {
    const { mock } = req.collection;
    const data = typeof mock === 'function'
        ? await mock(fetchArgs)
        : mock;
    return Promise.resolve({ data, MOCK: true });
};
const requestData = (req, url) => {
    if (!req || !url)
        return Promise.reject(new Error('BAD THING HAPPENED'));
    const CACHE = fetchStore.cacheHas(req.hash);
    const useCache = !!(CACHE && req.special.$refresh !== true);
    if (useCache)
        return Promise.resolve(CACHE);
    const fetchArgs = buildFetchArgs(req, url);
    const promise = 'mock' in req.collection
        ? doMock(req, fetchArgs)
        : (0, utils_1.fetchData)(fetchArgs.url, fetchArgs.options);
    fetchStore.reqAdd(req.hash, promise);
    return promise;
};
const fetchOne = (fetchProps) => {
    try {
        const { req, url, problems } = buildInfo(fetchProps);
        const existing = fetchStore.reqHas(req === null || req === void 0 ? void 0 : req.hash);
        const { collections = [] } = META.collections[fetchProps.name] || {};
        if (collections.length)
            return fetchMultiple(collections, fetchProps.props);
        if (existing)
            return existing; // Intercept a matching unresolved request and use its Promise
        const promise = (problems === null || problems === void 0 ? void 0 : problems.length) ? Promise.reject({ problems, $req: req }) : requestData(req, url);
        return promise
            .then((v) => (Object.assign(Object.assign({}, v), { $req: req })))
            .then((v) => processResponse(req || {}, v))
            .then((v) => (0, utils_1.extractResponse)(v, ((req === null || req === void 0 ? void 0 : req.special.$extract) || (req === null || req === void 0 ? void 0 : req.collection.extract))));
    }
    catch (err) {
        return Promise.reject(err);
    }
};
const fetchMultiple = async (collections, props) => {
    const list = collections.map((name) => fetchAttempt({ name, props: props[name] }));
    const data = await Promise.all(list);
    return collections.reduce((result, name, idx) => (Object.assign(Object.assign({}, result), { [name]: data[idx] })), {});
};
const processResponse = (req, response) => {
    var _a;
    fetchStore.reqRemove(req.hash);
    const data = JSON.parse(JSON.stringify(response));
    if (((_a = req.collection) === null || _a === void 0 ? void 0 : _a.cache) === 'ram')
        fetchStore.cacheAdd(req.hash, data);
    return data;
};
const delayResponse = async (req) => {
    const { spawned, collection } = req;
    const delay = collection.delayAtLeast;
    if (typeof delay === 'number') {
        const now = Date.now();
        const ms = delay - (now - spawned);
        ms > 0 && await new Promise(r => setTimeout(r, ms));
    }
    return true;
};
function emitResponse(detail) {
    const always = META.dispatchAlways;
    const emit = globalThis.dispatchEvent;
    return Boolean(always && emit && emit(new CustomEvent(always, { detail })));
}
const fetchAttempt = async (params) => {
    var _a, _b;
    const { name, props = {}, method } = params;
    const reject = ((props === null || props === void 0 ? void 0 : props.$reject) || ((_b = (_a = META === null || META === void 0 ? void 0 : META.collections[name]) === null || _a === void 0 ? void 0 : _a.props) === null || _b === void 0 ? void 0 : _b.$reject)) === true;
    const _c = await fetchOne({ name, props, method }).catch(utils_1.produceError), { $req } = _c, result = __rest(_c, ["$req"]);
    const output = (0, utils_1.omit)(result, ['$req']);
    if ($req)
        emitResponse(output);
    // Delay the response if needed
    $req && await delayResponse($req);
    return output.error === 1 && reject ? Promise.reject(output) : output;
};
// ##### Options management #####
const shallowMerge = (origin, ops) => {
    return Object.entries(ops).reduce((acc, [k, v]) => {
        if ((0, utils_1.isObject)(v)) {
            acc[k] = Object.assign(Object.assign({}, acc[k]), v);
        }
        return acc;
    }, structuredClone(META.origins.get(origin)));
};
const optionsAdd = (origin, ops, merge = false) => {
    const { origins } = META;
    const has = origins.has(origin);
    const ok = has && (0, utils_1.isObject)(ops);
    if (ok) {
        const value = merge === true ? shallowMerge(origin, ops) : ops;
        origins.set(origin, value);
    }
    return ok;
};
const optionsDrop = (origin) => META.origins.set(origin, {});
// ##### Origin management #####
const collectionsAdd = (origin, list, ops = {}, merge = false) => {
    const entries = Object.entries(list);
    if (!entries.length)
        return false;
    const collections = entries.reduce((acc, [k, v]) => {
        return Object.assign(acc, { [k]: Object.assign(Object.assign({}, v), { origin }) });
    }, META.collections);
    META.collections = collections;
    META.origins.set(origin, {});
    // Add origin options, if any
    if ((0, utils_1.isObject)(ops, true)) {
        optionsAdd(origin, ops, merge);
    }
    return true;
};
const collectionsDrop = (list) => {
    if (!Array.isArray(list) || !list.length)
        return false;
    const collections = Object.assign({}, META.collections);
    list.forEach((k) => k in collections && delete collections[k]);
    META.collections = collections;
    // Clean up emtpy origins
    const origins = new Set(Object.values(collections).map((v) => v.origin));
    Array.from(META.origins.keys()).forEach(k => !origins.has(k) && META.origins.delete(k));
    return true;
};
const reset = () => {
    META.origins.clear();
    META.collections = {};
    return true;
};
// ##### The proxy #####
// const exposed: Obj = Object.freeze({
const exposed = {
    META,
    reset,
    optionsAdd,
    optionsDrop,
    collectionsAdd,
    collectionsDrop,
    fetch: (name, props = {}) => fetchAttempt({ name, props })
};
const proxy = new Proxy(exposed, {
    get(target, prop) {
        if (VIRTUAL_METHODS.has(prop)) {
            return (name, props = {}) => fetchAttempt({ name, props, method: prop });
        }
        else if (prop in target) {
            return target[prop];
        }
    },
    // TODO: Find a better way to accomodate this 'always' thing
    set(target, key, value) {
        if (key === 'dispatchAlways' && (0, utils_1.isString)(value, true)) {
            META.dispatchAlways = value;
            return true;
        }
        return false;
    }
});
exports.default = proxy;
