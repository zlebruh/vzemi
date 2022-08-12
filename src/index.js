// ### UTILS - Start - #############################################################################################################################
const fetcherBoot = () => {
  const isString = (str, checkEmpty) => {
    const isString = typeof str === 'string'
    return checkEmpty !== true ? isString : isString && !!str.length
  }

  const isObject = (val, checkEmpty) => {
    try {
      const isOb = typeof val === 'object' && !Array.isArray(val) && val !== null
      return checkEmpty === true
        ? isOb && !!Object.keys(val).length
        : isOb
    } catch (err) {
      return false
    }
  }

  const produceError = (err, result) => {
    const { problems = [], $req = null } = err || {}
    const { data = null } = result || {}
    const message = err.message || err.error || err.errors

    if (message) problems.push(message)

    return { ...result, error: 1, data, problems, $req }
  }

  const propsToCGI = (options = {}) => {
    const keys = Object.keys(options)
    const max = keys.length - 1
    const initial = keys.length ? '?' : ''

    return keys.reduce((sum, key, idx) => {
      const item = String(options[key])
      const amp = idx >= max ? '' : '&'
      return `${sum + key}=${item + amp}`
    }, initial)
  }

  const splitProps = (obj) => {
    const SPECIAL = ['$done', '$body', '$path', '$refresh', '$reject', '$options', '$headers', '$extract']
    const params = { ...obj }
    const special = {}

    for (let i = 0; i < SPECIAL.length; i += 1) {
      const key = SPECIAL[i]
      if (key in params) {
        special[key] = params[key]
        delete params[key]
      }
    }
    return { params, special }
  }

  const omit = (target, keys = []) => {
    const result = { ...target }
    for (const key of keys) delete result[key]
    return result
  }

  const pick = (target, keys = []) => {
    return isObject(target)
      ? keys.filter(v => v).reduce((v, k) => ({ ...v, [k]: target[k] }), null) || target
      : target
  }

  const extractResponse = (reqResponse, extract) => {
    return { ...reqResponse, data: pick(reqResponse.data, extract) }
  }

  const emitResponse = (detail, req) => {
    const done = req?.special.$done || req?.collection.done
    const type = typeof done
    const { dispatchEvent } = globalThis

    if (type === 'string' && dispatchEvent) dispatchEvent(new CustomEvent(done, { detail }))
    if (type === 'function') done(detail)

    return detail
  }

  // ####################### FETCH #######################
  const regex = { json: /application\/json/, file: /image|file/ }
  const contentType = 'content-type'

  const fetchData = async (uri, options = {}) => {
    try {
      const res = await fetch(uri, options)
      const headers = [...res.headers.entries()].reduce((r, pair) => {
        const [key, val] = pair.map(v => v.toLowerCase())
        return Object.assign(r, { [key]: val })
      }, {})
      const contentHeader = headers[contentType]
      const data = await (regex.json.test(contentHeader)
        ? res.json()
        : regex.file.test(contentHeader) ? res.blob() : res.text())
      const { status } = res
      const result = { status, data }

      return status >= 400
        ? produceError({ message: res.statusText }, result)
        : data?.data === void 0 ? result : { status, ...data }
    } catch (err) {
      return produceError(err)
    }
  }
  // ### UTILS -  End  - #############################################################################################################################

  // ### STORE - Start - #############################################################################################################################
  const CACHE = Object.create(null)
  const REQUESTS = Object.create(null)

  // Shorthands
  const entityAdd = (store, hash, payload) => {
    const existing = hash in store

    if (!existing) store[hash] = payload

    return existing
  }

  const entityRemove = (store, hash) => store[hash] ? delete store[hash] : false

  // Requests
  const reqHas = (hash = '') => REQUESTS[hash] || null
  const reqAdd = (hash, promise) => entityAdd(REQUESTS, hash, promise)
  const reqRemove = hash => entityRemove(REQUESTS, hash)

  // Cache
  const cacheHas = (hash) => CACHE[hash] || null
  const cacheAdd = (hash, data) => entityAdd(CACHE, hash, data)
  const cacheRemove = hash => entityRemove(CACHE, hash)
  // ### STORE -  End  - #############################################################################################################################

  // const META = { options: {}, collections: {} }
  // const VIRTUAL_METHODS = ['get', 'put', 'post', 'patch', 'delete']
  const VERIFY = {
    name: { test: (v) => v in META.collections, text: "Collection '{{value}}' was not recognized" },
    url: { text: "Collection '{{value}}' has no URL" },
    method: { text: "Collection '{{value}}' has no method" },
  }

  const buildURL = (req, method) => {
    const result = req.collection.url + (req.special.$path || '')
    const postfix = method.toUpperCase() === 'GET' ? propsToCGI(req.body) : ''
    return result + postfix
  }

  const buildInfo = (fetchProps) => {
    const { name, props } = fetchProps
    const collection = META.collections[name]
    const method = (fetchProps.method || collection?.method || '').toUpperCase()
    const problems = verifyInfo({ name, method, url: collection?.url })

    if (problems.length) return { problems }

    const req = buildReq(name, props, method)
    const url = buildURL(req, method)

    return { req, url }
  }
  const verifyInfo = (info) => {
    return Object.keys(VERIFY)
      .map((key) => {
        const { test, text } = VERIFY[key]
        return !isString(info[key], true) || !(test ? test(info.name) : true)
          ? text.replace('{{value}}', info.name)
          : null
      }).filter(Boolean)
  }

  const buildReq = (name, props, method) => {
    const collection = META.collections[name]
    const { params, special } = splitProps(props)
    const hash = `${name}+++${JSON.stringify(params)}`
    const body = special.$body || { ...collection.props, ...params }
    const multi = Array.isArray(collection.collections) && Boolean(collection.collections.length)
    const options = {
      ...META.options,
      ...collection.options,
      ...special.$options,
      method: method || collection.method,
      headers: {
        ...META.options.headers,
        ...collection.headers,
        ...special.$headers
      },
    }

    return { collection, body, options, props, special, name, hash, multi }
  }

  const initiateRequest = (req, url) => {
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

  const requestData = (req, url) => {
    if (!req || !url) return Promise.reject(new Error('BAD THING HAPPENED'))

    const cache = cacheHas(req.hash)
    const useCache = !!(cache && req.special.$refresh !== true)
    if (useCache) return Promise.resolve(cache)

    const promise = 'mock' in req.collection
      ? Promise.resolve({ data: req.collection.mock, MOCK: true })
      : initiateRequest(req, url)

    reqAdd(req.hash, promise)

    return promise
  }

  const fetchOne = (fetchProps) => {
    try {
      const { req, url, problems } = buildInfo(fetchProps)
      const existing = reqHas(req?.hash)
      const { collections = [] } = META.collections[fetchProps.name] || {}

      if (collections.length) return fetchMultiple(collections, fetchProps.props)
      if (existing) return existing // Intercept a matching unresolved request and use its Promise

      const promise = problems?.length ? Promise.reject({ problems, $req: req }) : requestData(req, url)

      return promise
        .then(v => ({ ...v, $req: req }))
        .then(v => processResponse(req || {}, v))
        .then(v => extractResponse(v, (req?.special.$extract || req?.collection.extract)))
    } catch (err) {
      return Promise.reject(err)
    }
  }
  const fetchMultiple = async (collections, props) => {
    const list = collections.map(name => fetchAttempt(name, props[name]))

    const data = await Promise.all(list)
    return collections.reduce((result, name, idx) => ({ ...result, [name]: data[idx] }), {})
  }

  const processResponse = (req, response) => {
    reqRemove(req.hash)
    const data = JSON.parse(JSON.stringify(response))

    if (req.collection?.cache === 'ram') cacheAdd(req.hash, data)

    return data
  }

  const setup = (props) => {
    const { collections, options } = props

    if (isObject(options, true)) META.options = options
    if (isObject(collections, true)) META.collections = collections

    return META
  }

  const fetchAttempt = async (name, props = {}, method) => {
    const reject = (props?.$reject || META?.collections[name]?.props?.$reject) === true
    const { $req, ...result } = await fetchOne({ name, props, method }).catch(produceError)
    const output = omit(result, ['$req'])

    console.warn('I AM:', globalThis)

    if ($req) emitResponse(output, $req)

    return reject ? Promise.reject(output) : output
  }
}

let WORKER = null

// ################ DISPATCHER - Start ################
let jobCounter = 0
const jobList = new Map()
const jobTimeout = 15000
const jobErrorTpl = { result: null, error: 1, message: `Job failed to executed within ${clearTimeout} seconds` }

const jobEnd = (jobID, payload) => {
  jobList.get(jobID)?.resolve(payload)
  clearTimeout(jobID)
  return jobList.delete(jobID)
}
const msgHandler = ({ data }) => jobEnd(data?.jobID, data?.response)

const jobStart = (props) => {
  const jobID = ++jobCounter
  const payload = { jobID, ...props }

  return new Promise((resolve) => {
    const timer = setTimeout(() => jobEnd(jobID, jobErrorTpl),jobTimeout)
    WORKER.postMessage(payload)
    jobList.set(jobID, { timer, resolve })
  })
}
// ################ DISPATCHER -  End  ################

const META = { options: {}, collections: {} }
const VIRTUAL_METHODS = ['get', 'put', 'post', 'patch', 'delete']

const spawnWorker = () => {
  const tpl = `
    const fun = ${fetcherBoot.toString()};
    fun();
    onmessage = (e) => console.warn('WWW:', e.data);
    postMessage({ok: true});
    console.warn('w000000000000t', globalThis);
  `
  const blob = new Blob([tpl], { type: 'application/javascript' })
  return new Worker(URL.createObjectURL(blob), [META])
}

WORKER = spawnWorker()
globalThis.www = WORKER

// ###
// WORKER.addEventListener('message', msgHandler)
WORKER.addEventListener('message', (e) => console.warn('EEE:', e.data.ok))
// ###

const askNicely = (fun, ...args) => {
  try {
    const payload = JSON.parse(JSON.stringify({ fun, args }))
    globalThis.www.postMessage(payload)
  } catch (err) {
    console.warn(err)
  }
}

const asetup = (...args) => askNicely('setup', ...args)
const attempt = (...args) => askNicely('fetchAttempt', ...args)

const proxy = new Proxy(Object.freeze({ fetch: attempt, setup: asetup, META }), {
  get(target, prop) {
    if (VIRTUAL_METHODS.includes(prop)) {
      return (name, props = {}) => attempt(name, props, prop)
    } else if (prop in target) {
      return target[prop]
    }
  }
})

export default proxy
