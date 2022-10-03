import { Obj, ReqProps, PrefetchProps, FetchProps, FetchMethod, FetchResponse, SetupOptions, CollectionOptions, CollectionsOptions } from './types'
import * as fetchStore from './store'
import { fetchData, splitProps, propsToCGI, isString, isObject, produceError, omit, extractResponse, cleanOb } from './utils'

// let dispatchAlways = ''
const EXPOSED: Obj = cleanOb({ origins: new Map(), collections: new Map() })
const METHODS = new Set(['get', 'put', 'post', 'patch', 'delete'])
const VERIFY: Obj = {
  name: { test: (v: string) => EXPOSED.collections.has(v), text: "Collection '{{value}}' was not recognized" },
  url: { text: "Collection '{{value}}' has no URL" },
  method:{ text: "Collection '{{value}}' has no method" },
}

// ######################### CODE #########################

const buildURL = (req: ReqProps, method: FetchMethod) => {
  const { origin = '', url } = req.collection
  const result = origin + url + (req.special.$path || '')
  const postfix = method.toUpperCase() === 'GET' ? propsToCGI(req.body) : ''
  return result + postfix
}

function buildInfo(fetchProps: FetchProps): PrefetchProps {
  const { name, props } = fetchProps
  const collection = EXPOSED.collections.get(name)
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
  const collection: CollectionOptions = EXPOSED.collections.get(name)
  const { params, special } = splitProps(props)
  const hash = `${name}+++${JSON.stringify(params)}`
  const body = special.$body || { ...collection.props, ...params }
  const multi = Array.isArray(collection.collections) && Boolean(collection.collections.length)
  const spawned = Date.now()
  const originOptions = EXPOSED.origins.get(collection.origin)
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

// TODO: Started throwing compile errors after updating TS // const buildFetchArgs = (req: ReqProps, url: string) => {
const buildFetchArgs = (req: Obj, url: string): { url: string, options: Obj } => {
  const { collection, options, props, body } = req

  if (options.method !== 'GET') {
    if (collection.isFile) {
      Object.assign(options.headers, { enctype: 'multipart/form-data' })
      options.body = props.formData
    } else {
      options.body = JSON.stringify(body)
    }
  }

  return { url, options }
}

const doMock = async (req: ReqProps, fetchArgs: { url: string, options: Obj }) => {
  const { mock } = req.collection
  const data = typeof mock === 'function'
    ? await mock(fetchArgs)
    : mock
  return Promise.resolve({ data, MOCK: true })
}

const requestData = (req?: ReqProps, url?: string) => {
  if (!req || !url) return Promise.reject(new Error('BAD THING HAPPENED'))

  const CACHE = fetchStore.cacheHas(req.hash)
  const useCache = !!(CACHE && req.special.$refresh !== true)
  if (useCache) return Promise.resolve(CACHE)

  const fetchArgs = buildFetchArgs(req, url)
  const promise = 'mock' in req.collection
    ? doMock(req, fetchArgs)
    : fetchData(fetchArgs.url, fetchArgs.options)

  fetchStore.reqAdd(req.hash, promise)

  return promise
}

const fetchOne = (fetchProps: FetchProps): Promise<any|FetchResponse> => {
  try {
    const { req, url, problems } = buildInfo(fetchProps)
    const existing = fetchStore.reqHas(req?.hash)
    const { collections = [] } = EXPOSED.collections.get(fetchProps.name) || {}

    if (collections.length) return fetchMultiple(collections, fetchProps.props)
    if (existing) return existing // Intercept a matching unresolved request and use its Promise

    const promise = problems?.length ? Promise.reject({ problems, $req: req }) : requestData(req, url)

    return promise
      .then((v: Obj) => ({...v, $req: req}))
      .then((v: Obj) => processResponse(req || {}, v))
      .then((v: Obj) => extractResponse(v, (req?.special.$extract || req?.collection.extract)))
  } catch (err) {
    return Promise.reject(err)
  }
}
const fetchMultiple = async (collections: string[], props: Obj) => {
  const list = collections.map((name: string) => fetchAttempt({ name, props: props[name] }))

  const data = await Promise.all(list)
  return collections.reduce((result: Obj, name: string, idx: number) => ({ ...result, [name]: data[idx] }), {})
}

const processResponse = (req: Obj, response: unknown) => {
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

function emitResponse(detail: unknown) {
  const always = EXPOSED.dispatchAlways
  const emit = globalThis.dispatchEvent

  return Boolean(always && emit && emit(new CustomEvent(always, { detail })))
}

const fetchAttempt = async (params: FetchProps) => {
  const { name, props = {}, method } = params
  const reject = (props?.$reject || EXPOSED.collections.get(name)?.props?.$reject) === true
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
    acc[k] = isObject(v)
      ? { ...acc[k], ...v }
      : v
    return acc
  }, structuredClone(EXPOSED.origins.get(origin)))
}
const optionsChange = (origin: string, ops: Obj, merge = false) => {
  const { origins } = EXPOSED
  const has = origins.has(origin)
  const ok = has && isObject(ops)

  if (ok) {
    const value = merge === true ? shallowMerge(origin, ops) : ops
    origins.set(origin, value)
  }

  return ok
}

// ##### Origin management #####
const collectionsAdd = (origin: string, list: Obj, ops: Obj = {}, merge = false) => {
  const entries = Object.entries(list)

  if (typeof origin !== 'string' || !entries?.length) return false

  const { collections } = EXPOSED
  EXPOSED.origins.set(origin, {})
  entries.forEach(([k, v]: [string, any]) => collections.set(k, { ...v, origin}))

  // Add origin options, if any
  if (isObject(ops, true)) {
    optionsChange(origin, ops, merge)
  }

  return true
}

const collectionsDrop = (list: string|string[]): boolean => {
  const arr = isString(list, true) ? [list] : list

  if (!Array.isArray(arr) || !arr.length) return false

  const { origins, collections } = EXPOSED
  const ok = arr.every((k: unknown) => collections.delete(k))

  // Clean up emtpy origins
  const originsFound = new Set([...collections.values()].map((v: any) => v.origin))
  Array.from(origins.keys()).forEach(k => !originsFound.has(k) && origins.delete(k))

  return ok
}

const originsDrop = (list: string|string[]): boolean => {
  const arr = isString(list, true) ? [list] : list

  if (Array.isArray(arr)) {
    const filtered = arr.filter(v => isString(v, true))
    const regex = new RegExp(`^${filtered.join('|')}$`)
    const { origins, collections } = EXPOSED

    collections.forEach((v: any, k: string) => regex.test(v.origin) && collections.delete(k))
    return filtered.map(v => origins.delete(v)).every(v => v === true)
  }
  
  return false
}

const reset = () => {
  EXPOSED.origins.clear()
  EXPOSED.collections.clear()
  return true
}

Object.defineProperties(EXPOSED.collections, {
  add: { value: collectionsAdd },
  drop: { value: collectionsDrop }
})

Object.defineProperties(EXPOSED.origins, {
  drop: { value: originsDrop },
  change: { value: optionsChange }
})

// Come up with a better solution. Proxies are fun
// We don't have to expose all the getters and setters
const buildDispatchAlways = () => {
  let value = ''
  return {
    dispatchAlways: {
      get: () => value,
      set: (candidate: string) => {
        if (isString(candidate, true)) value = candidate
      }
    }
  }
}

// Extend the exposed object before giving it to the proxy
Object.defineProperties(EXPOSED, buildDispatchAlways())
Object.freeze(Object.assign(EXPOSED, {
  reset,
  fetch: (name: string, props: Obj = {}) => fetchAttempt({ name, props })
}))

const proxy = new Proxy(EXPOSED, {
  get(target: Obj, prop: FetchMethod) {
    return METHODS.has(prop)
      ? (name: string, props: Obj = {}) => fetchAttempt({ name, props, method: prop })
      : target[prop]
  }
})

export default proxy
