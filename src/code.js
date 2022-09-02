const fetcherScopedCode = () => {
  // ### UTILS - Start - #############################################################################################################################
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
    const SPECIAL = ['$body', '$path', '$refresh', '$reject', '$options', '$headers', '$extract']
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

  const extractResponse = (res, extract) => ({ ...res, data: pick(res.data, extract) })

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

  let META = null
  const validationPairs = {
    always: isString,
    options: isObject,
    domains: isObject,
    collections: isObject,
  }
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
    const spawned = Date.now()

    const options = {
      ...META.options,
      ...collection.options,
      ...special.$options,
      headers: {
        ...META.options.headers,
        ...collection.headers,
        ...special.$headers
      },
      method: method || collection.method
    }

    return { collection, body, options, props, special, name, hash, multi, spawned }
  }

  const initiateRequest = (req, url) => {
    const { collection, options, props, body } = req

    if (options.method !== 'GET') {
      if (collection.isFile) {
        options.body = props.formData
        options.headers.enctype = 'multipart/form-data'
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
    const list = collections.map(name => fetchAttempt({ name, props: props[name] }))

    const data = await Promise.all(list)
    return collections.reduce((result, name, idx) => ({ ...result, [name]: data[idx] }), {})
  }

  const processResponse = (req, response) => {
    reqRemove(req.hash)
    const data = structuredClone(response)

    if (req.collection?.cache === 'ram') cacheAdd(req.hash, data)

    return data
  }

  const delayResponse = async (req) => {
    const { spawned, collection } = req
    const delay = collection.delayAtLeast

    if (typeof delay === 'number') {
      const now = Date.now()
      const ms = delay - (now - spawned)
      ms > 0 && await new Promise(r => setTimeout(r, ms))
    }

    return true
  }

  const fetchAttempt = async (jobID, params) => {
    const { name, props, method } = params
    const reject = (props?.$reject || META?.collections[name]?.props?.$reject) === true
    const { $req, ...result } = await fetchOne({ name, props, method }).catch(produceError)
    const pl = omit(result, ['$req'])

    // Delay the response if needed
    $req && await delayResponse($req)

    return sendMsg({ jobID, pl, cmd: 'fetch_out', toReject: pl.error === 1 && reject})
  }

  const setup = (props) => {
    const obj = Object.entries(validationPairs).reduce((acc, [k, method]) => {
      const value = props[k]
      // TODO: Decide what to do with this
      // Might be a good idea to add more methods to zemi?
      // if (method(value, true)) acc[k] = value
      if (method(value)) acc[k] = value
      return acc
    }, {})

    const pl = Object.assign(META, obj)

    return sendMsg({ cmd: 'setup_out', pl })
  }

  const init = (props) => {
    if ('META' in props) {
      META = props.META
      sendMsg({ cmd: 'init_out', pl: META })
    }
  }

  // ############## COMMS - Start ##############
  globalThis.onmessage = ({ data }) => {
    const { cmd, jobID, pl } = data

    switch (cmd) {
      case 'init_in': init(pl); break;
      case 'setup_in': setup(pl); break;
      case 'fetch_in': fetchAttempt(jobID, pl); break;
      default: console.warn('DEFAULT', data); break;
    }
  }
  
  const sendMsg = (data) => {
    if (!isString(data.cmd, true)) {
      return console.warn('Output data.cmd should be a valid command. Received:', data)
    }

    globalThis.postMessage(data)
    return data
  }
  // ############## COMMS -  End  ##############
}

export default fetcherScopedCode
