import { Obj, ReqProps, PrefetchProps, FetchProps, FetchMethod, FetchResponse, SetupOptions, CollectionOptions, CollectionsOptions } from './types'
import * as fetchStore from './store'
import { fetchData, splitProps, propsToCGI, isString, isObject, produceError, omit, extractResponse } from './utils'

const META: Obj = { origins: new Map(), collections: {}, dispatchAlways: '' }
const VIRTUAL_METHODS = new Set(['get', 'put', 'post', 'patch', 'delete'])
const VERIFY: Obj = {
  name: { test: (v: string) => v in META.collections, text: "Collection '{{value}}' was not recognized" },
  url: { text: "Collection '{{value}}' has no URL" },
  method:{ text: "Collection '{{value}}' has no method" },
}

const buildURL = (req: ReqProps, method: FetchMethod) => {
  const { origin = '', url } = req.collection
  const result = origin + url + (req.special.$path || '')
  const postfix = method.toUpperCase() === 'GET' ? propsToCGI(req.body) : ''
  return result + postfix
}

function buildInfo(fetchProps: FetchProps): PrefetchProps {
  const { name, props } = fetchProps
  const collection = META.collections[name]
  const method = (fetchProps.method || collection?.method || '').toUpperCase()
  const problems = verifyInfo({ name, method, url: collection?.url })

  if (problems.length) return { problems }

  const req = buildReq(name, props, method)
  const url = buildURL(req, method)

  return { req, url }
}
function verifyInfo(info: Obj) {
  return Object.keys(VERIFY)
    .map((key) => {
      const { test, text } = VERIFY[key]
      return !isString(info[key], true) || !(test ? test(info.name) : true)
        ? text.replace('{{value}}', info.name)
        : null
    }).filter(Boolean)
}

function buildReq(name: string, props: Obj, method: FetchMethod): ReqProps {
  const collection: CollectionOptions = META.collections[name]
  const { params, special } = splitProps(props)
  const hash = `${name}+++${JSON.stringify(params)}`
  const body = special.$body || { ...collection.props, ...params }
  const multi = Array.isArray(collection.collections) && Boolean(collection.collections.length)
  const spawned = Date.now()
  const originOptions = META.origins.get(collection.origin)
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
  }

  return { collection, body, options, props, special, name, hash, multi, spawned }
}

// TODO: Started throwing compile errors after updating TS // const initiateRequest = (req: ReqProps, url: string) => {
const initiateRequest = (req: Obj, url: string) => {
  const { collection, options, props, body } = req

  if (options.method !== 'GET') {
    if (collection.isFile) {
      Object.assign(options.headers, { enctype: 'multipart/form-data' })
      options.body = props.formData
    } else {
      options.body = JSON.stringify(body)
    }
  }

  return fetchData(url, options)
}

const requestData = (req?: ReqProps, url?: string) => {
  if (!req || !url) return Promise.reject(new Error('BAD THING HAPPENED'))

  const CACHE = fetchStore.cacheHas(req.hash)
  const useCache = !!(CACHE && req.special.$refresh !== true)
  if (useCache) return Promise.resolve(CACHE)

  const promise = 'mock' in req.collection
    ? Promise.resolve({ data: req.collection.mock, MOCK: true })
    : initiateRequest(req, url)

  fetchStore.reqAdd(req.hash, promise)

  return promise
}

const fetchOne = (fetchProps: FetchProps): Promise<any|FetchResponse> => {
  try {
    const { req, url, problems } = buildInfo(fetchProps)
    const existing = fetchStore.reqHas(req?.hash)
    const { collections = [] } = META.collections[fetchProps.name] || {}

    if (collections.length) return fetchMultiple(collections, fetchProps.props)
    if (existing) return existing // Intercept a matching unresolved request and use its Promise

    const promise = problems?.length ? Promise.reject({ problems, $req: req }) : requestData(req, url)

    return promise
      .then((v: any) => ({...v, $req: req}))
      .then((v: any) => processResponse(req || {}, v))
      .then((v: any) => extractResponse(v, (req?.special.$extract || req?.collection.extract)))
  } catch (err) {
    return Promise.reject(err)
  }
}
const fetchMultiple = async (collections: string[], props: Obj) => {
  const list = collections.map((name: string) => fetchAttempt({ name, props: props[name] }))

  const data = await Promise.all(list)
  return collections.reduce((result: Obj, name: string, idx: number) => ({ ...result, [name]: data[idx] }), {})
}

const processResponse = (req: Obj, response: any) => {
  fetchStore.reqRemove(req.hash)
  const data = JSON.parse(JSON.stringify(response))

  if (req.collection?.cache === 'ram') fetchStore.cacheAdd(req.hash, data)

  return data
}

const delayResponse = async (req: Obj) => {
  const { spawned, collection } = req
  const delay = collection.delayAtLeast

  if (typeof delay === 'number') {
    const now = Date.now()
    const ms = delay - (now - spawned)
    ms > 0 && await new Promise(r => setTimeout(r, ms))
  }

  return true
}

function emitResponse(detail: any) {
  const always = META.dispatchAlways
  const emit = globalThis.dispatchEvent

  return Boolean(always && emit && emit(new CustomEvent(always, { detail })))
}

const fetchAttempt = async (params: FetchProps) => {
  const { name, props = {}, method } = params
  const reject = (props?.$reject || META?.collections[name]?.props?.$reject) === true
  const { $req, ...result } = await fetchOne({name, props, method}).catch(produceError)
  const output = omit(result, ['$req'])

  if ($req) emitResponse(output)

  // Delay the response if needed
  $req && await delayResponse($req)

  return output.error === 1 && reject ? Promise.reject(output) : output
}

// ##### Options management #####
const shallowMerge = (origin: string, ops: Obj) => {
  return Object.entries(ops).reduce((acc: Obj, [k, v]: [string, any]) => {
    if (isObject(v)) {
      acc[k] = { ...acc[k], ...v }
    }
    
    return acc
  }, structuredClone(META.origins.get(origin)))
}
const optionsAdd = (origin: string, ops: Obj, merge = false) => {
  const { origins } = META
  const has = origins.has(origin)
  const ok = has && isObject(ops)

  if (ok) {
    const value = merge === true ? shallowMerge(origin, ops) : ops
    origins.set(origin, value)
  }

  return ok
}
const optionsDrop = (origin: string) => META.origins.set(origin, {})

// ##### Origin management #####
const collectionsAdd = (origin: string, list: Obj, ops: Obj = {}, merge = false) => {
  const entries = Object.entries(list)

  if (!entries.length) return false

  const collections = entries.reduce((acc: CollectionsOptions, [k, v]: [string, any]) => {
    return Object.assign(acc, { [k]: { ...v, origin } })
  }, META.collections)

  META.collections = collections
  META.origins.set(origin, {})

  if (isObject(ops, true)) {
    optionsAdd(origin, ops, merge)
  }

  return true
}
const collectionsDrop = (origin: string) => {
  if (!isString(origin)) return false

  const collections = { ...META.collections }
  Object.entries(collections).forEach(([k, v]: [string, any]) => origin === v.origin && delete collections[k])
  META.collections = collections
  META.origins.delete(origin)
  return true
}

const collectionsClear = () => {
  META.origins.clear()
  META.collections = {}
  return true
}

// ##### The proxy #####
// const exposed: Obj = Object.freeze({
const exposed: Obj = {
  META,
  optionsAdd,
  optionsDrop,
  collectionsClear,
  collectionsDrop,
  collectionsAdd,
  fetch: (name: string, props: Obj = {}) => fetchAttempt({ name, props })
}
// })

const proxy = new Proxy(exposed, {
  get(target: Obj, prop: FetchMethod) {
    if (VIRTUAL_METHODS.has(prop)) {
      return (name: string, props: Obj = {}) => fetchAttempt({ name, props, method: prop })
    } else if (prop in target) {
      return target[prop]
    }
  },
  // TODO: Find a better way to accomodate this 'always' thing
  set(target: Obj, key: string, value: any) {
    if (key === 'dispatchAlways' && isString(value, true)) {
      META.dispatchAlways = value
      return true
    }

    return false
  }
})

export default proxy
