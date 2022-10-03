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
const fetchStore = __importStar(require("./store"));
const utils_1 = require("./utils");
// let dispatchAlways = ''
const EXPOSED = (0, utils_1.cleanOb)({ origins: new Map(), collections: new Map() });
const METHODS = new Set(['get', 'put', 'post', 'patch', 'delete']);
const VERIFY = {
    name: { test: (v) => EXPOSED.collections.has(v), text: "Collection '{{value}}' was not recognized" },
    url: { text: "Collection '{{value}}' has no URL" },
    method: { text: "Collection '{{value}}' has no method" },
};
// ######################### CODE #########################
const buildURL = (req, method) => {
    const { origin = '', url } = req.collection;
    const result = origin + url + (req.special.$path || '');
    const postfix = method.toUpperCase() === 'GET' ? (0, utils_1.propsToCGI)(req.body) : '';
    return result + postfix;
};
function buildInfo(fetchProps) {
    const { name, props } = fetchProps;
    const collection = EXPOSED.collections.get(name);
    const method = (fetchProps.method || collection?.method || '').toUpperCase();
    const problems = verifyInfo({ name, method, url: collection?.url });
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
    const collection = EXPOSED.collections.get(name);
    const { params, special } = (0, utils_1.splitProps)(props);
    const hash = `${name}+++${JSON.stringify(params)}`;
    const body = special.$body || { ...collection.props, ...params };
    const multi = Array.isArray(collection.collections) && Boolean(collection.collections.length);
    const spawned = Date.now();
    const originOptions = EXPOSED.origins.get(collection.origin);
    const options = {
        ...originOptions,
        ...collection.options,
        ...special.$options,
        method: method || collection.method,
        headers: {
            ...originOptions.headers,
            ...collection.headers,
            ...special.$options?.headers,
            ...special.$headers
        },
    };
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
        const existing = fetchStore.reqHas(req?.hash);
        const { collections = [] } = EXPOSED.collections.get(fetchProps.name) || {};
        if (collections.length)
            return fetchMultiple(collections, fetchProps.props);
        if (existing)
            return existing; // Intercept a matching unresolved request and use its Promise
        const promise = problems?.length ? Promise.reject({ problems, $req: req }) : requestData(req, url);
        return promise
            .then((v) => ({ ...v, $req: req }))
            .then((v) => processResponse(req || {}, v))
            .then((v) => (0, utils_1.extractResponse)(v, (req?.special.$extract || req?.collection.extract)));
    }
    catch (err) {
        return Promise.reject(err);
    }
};
const fetchMultiple = async (collections, props) => {
    const list = collections.map((name) => fetchAttempt({ name, props: props[name] }));
    const data = await Promise.all(list);
    return collections.reduce((result, name, idx) => ({ ...result, [name]: data[idx] }), {});
};
const processResponse = (req, response) => {
    fetchStore.reqRemove(req.hash);
    const data = JSON.parse(JSON.stringify(response));
    if (req.collection?.cache === 'ram')
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
    const always = EXPOSED.dispatchAlways;
    const emit = globalThis.dispatchEvent;
    return Boolean(always && emit && emit(new CustomEvent(always, { detail })));
}
const fetchAttempt = async (params) => {
    const { name, props = {}, method } = params;
    const reject = (props?.$reject || EXPOSED.collections.get(name)?.props?.$reject) === true;
    const { $req, ...result } = await fetchOne({ name, props, method }).catch(utils_1.produceError);
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
        acc[k] = (0, utils_1.isObject)(v)
            ? { ...acc[k], ...v }
            : v;
        return acc;
    }, structuredClone(EXPOSED.origins.get(origin)));
};
const optionsChange = (origin, ops, merge = false) => {
    const { origins } = EXPOSED;
    const has = origins.has(origin);
    const ok = has && (0, utils_1.isObject)(ops);
    if (ok) {
        const value = merge === true ? shallowMerge(origin, ops) : ops;
        origins.set(origin, value);
    }
    return ok;
};
// ##### Origin management #####
const collectionsAdd = (origin, list, ops = {}, merge = false) => {
    const entries = Object.entries(list);
    if (typeof origin !== 'string' || !entries?.length)
        return false;
    const { collections } = EXPOSED;
    EXPOSED.origins.set(origin, {});
    entries.forEach(([k, v]) => collections.set(k, { ...v, origin }));
    // Add origin options, if any
    if ((0, utils_1.isObject)(ops, true)) {
        optionsChange(origin, ops, merge);
    }
    return true;
};
const collectionsDrop = (list) => {
    const arr = (0, utils_1.isString)(list, true) ? [list] : list;
    if (!Array.isArray(arr) || !arr.length)
        return false;
    const { origins, collections } = EXPOSED;
    const ok = arr.every((k) => collections.delete(k));
    // Clean up emtpy origins
    const originsFound = new Set([...collections.values()].map((v) => v.origin));
    Array.from(origins.keys()).forEach(k => !originsFound.has(k) && origins.delete(k));
    return ok;
};
const originsDrop = (list) => {
    const arr = (0, utils_1.isString)(list, true) ? [list] : list;
    if (Array.isArray(arr)) {
        const filtered = arr.filter(v => (0, utils_1.isString)(v, true));
        const regex = new RegExp(`^${filtered.join('|')}$`);
        const { origins, collections } = EXPOSED;
        collections.forEach((v, k) => regex.test(v.origin) && collections.delete(k));
        return filtered.map(v => origins.delete(v)).every(v => v === true);
    }
    return false;
};
const reset = () => {
    EXPOSED.origins.clear();
    EXPOSED.collections.clear();
    return true;
};
Object.defineProperties(EXPOSED.collections, {
    add: { value: collectionsAdd },
    drop: { value: collectionsDrop }
});
Object.defineProperties(EXPOSED.origins, {
    drop: { value: originsDrop },
    change: { value: optionsChange }
});
// Come up with a better solution. Proxies are fun
// We don't have to expose all the getters and setters
const buildDispatchAlways = () => {
    let value = '';
    return {
        dispatchAlways: {
            get: () => value,
            set: (candidate) => {
                if ((0, utils_1.isString)(candidate, true))
                    value = candidate;
            }
        }
    };
};
// Extend the exposed object before giving it to the proxy
Object.defineProperties(EXPOSED, buildDispatchAlways());
Object.freeze(Object.assign(EXPOSED, {
    reset,
    fetch: (name, props = {}) => fetchAttempt({ name, props })
}));
const proxy = new Proxy(EXPOSED, {
    get(target, prop) {
        return METHODS.has(prop)
            ? (name, props = {}) => fetchAttempt({ name, props, method: prop })
            : target[prop];
    }
});
exports.default = proxy;
