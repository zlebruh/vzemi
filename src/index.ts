import {
  fetchData, buildFormData, produceError, drop,
  toCGI, isString, splitProps, delayResponse,
} from './utils'

// Exposed
class TurboMap extends Map {
  setMany(list: EndPoints) {
    for (const key in list) this.set(key, list[key])
    return this
  }
}

class Origins extends TurboMap {
  find(uri: string) {
    const key = Array.from(this.keys()).find(k => uri?.startsWith(k))
    return this.get(key) || Object.create(null)
  }
}
class Endpoints extends TurboMap {}

export const virtualMethods = new Set(['get', 'put', 'post', 'patch', 'delete', 'fetch'])

const origins = new Origins()
const endpoints = new Endpoints()
const proxyTarget = Object.assign(Object.create(null), { origins, endpoints })
const ongoingRequests = new Map()
const VERIFY: GenericObj = {
  name: { test: (v: string) => endpoints.has(v), text: "Endpoint '{{value}}' not found in endpoints" },
  uri: { text: "Endpoint '{{value}}' has no URI" },
  method:{ text: "Endpoint '{{value}}' has no method" },
}

const verifyInfo = (info: GenericObj) => {
  return Object.keys(VERIFY)
    .map((key) => {
      const { test, text } = VERIFY[key]
      return !isString(info[key], true) || !(test ? test(info.name) : true)
        ? text.replace('{{value}}', info.name)
        : null
    }).filter(Boolean)
}

const buildReqSequenceObj = (name: string, method: VirtualMethod, endpoint: EndPoint, props: GenericObj): BuildSequenceObj => {
  // Find a matching origin
  const origin: EndPoint = origins.find(endpoint.uri)
  // Combine request origin props with endpoint and request props before splitting the object
  const { params, special }: SpecialSplitResult = splitProps({ ...origin.props, ...endpoint.props, ...props })
  const buildHelperProps: BuildSequenceHelperProps = { origin, endpoint, props: params, method, special }
  return {
    uri: buildURL(buildHelperProps),
    hash: `${method}/${name}/${JSON.stringify(params)}`.toLocaleLowerCase(),
    options: buildOptions(buildHelperProps),
  }
}

const buildOptions = (p: BuildSequenceHelperProps) => {
  const { origin, endpoint, props, method, special } = p
  const options = {
    ...drop(origin, ['props']),
    ...endpoint.options,
    ...special.$options,
    method: method || endpoint.method,
    headers: {
      ...origin.headers,
      ...endpoint.options?.headers,
      ...endpoint.headers,
      ...special.$options?.headers,
      ...special.$headers
    },
  }

  if (method.toUpperCase() !== 'GET') {
    const formData = special.$formData || endpoint.props?.formData
    if (formData) {
      options.body = globalThis?.Window && formData instanceof HTMLFormElement
        ? new FormData(formData)
        : buildFormData({ params: props })
    } else {
      options.body = JSON.stringify(special.$body || props)
    }
  }

  return options
}
const buildURL = (p: BuildSequenceHelperProps) => {
  const path = p.special.$path || ''
  const postfix = p.method.toUpperCase() === 'GET' ? toCGI(p.props) : ''
  return p.endpoint.uri + path + postfix
}

const doMock = async (mock: EndPointMock, uri: string, options: RequestInit, name: string) => {
  const data = typeof mock === 'function'
    ? await mock(uri, options, name)
    : mock
  return Promise.resolve({ data, MOCK: true })
}

const beginFetchSequence = async (methodKey: VirtualMethod | null, name: string, props: GenericObj) => {
  const endpoint = endpoints.get(name)
  const method = methodKey === 'fetch' ? endpoint?.method : methodKey
  const problems = verifyInfo({ name, method, uri: endpoint?.uri })

  if (problems.length) {
    return produceError({ problems })
  } else {
    const { uri, hash, options } = buildReqSequenceObj(name, method, endpoint, props)

    // Match duplicates
    if (ongoingRequests.has(hash)) return ongoingRequests.get(hash)

    // Mocks follow the same exact flow
    const promise = 'mock' in endpoint
      ? doMock(endpoint.mock, uri, options, name)
      : fetchData(uri, options)

    ongoingRequests.set(hash, promise)
    const startStamp = Date.now()
    const response = await promise.catch((v: GenericObj) => v)
    ongoingRequests.delete(hash)

    // Delay the response if needed
    if (endpoint.delayAtLeast) await delayResponse(startStamp, endpoint.delayAtLeast)

    // Emit (but delay until the next tick) the response if needed
    const event = proxyTarget.emitAlways
    event && setTimeout(() => globalThis?.dispatchEvent(new CustomEvent(event, { detail: response })), 0)

    return response.error ? Promise.reject(response) : Promise.resolve(response)
  }
}

const allowedSetters = new Set(['emitAlways'])
export default new Proxy(proxyTarget, {
  get(target: GenericObj, key: VirtualMethod) {
    return virtualMethods.has(key)
      ? (endpoint: string, props: GenericObj = {}) => beginFetchSequence(key, endpoint, props)
      : target[key]
  },
  set(target: GenericObj, key: string, value: unknown) {
    const willChange = allowedSetters.has(key) && isString(value, true)

    if (willChange) target[key] = value

    return willChange
  },
})
