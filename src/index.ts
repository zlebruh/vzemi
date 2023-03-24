import type { GenericObj, EndPoints, EndPointMock, BuildPayloadProps, VirtualMethod,SpecialSplitResult } from '../types'
import {
  fetchData, buildFormData, produceError,
  toCGI, isString, splitProps, delayResponse, deepMerge,
} from './utils'

// Exposed
class Origins extends Map {
  collectScopedParams(uri: string) {
    return Array.from(this.keys()).reduce((acc, k) => {
      return uri?.startsWith(k)
        ? deepMerge(acc, this.get(k))
        : acc
    }, Object.create(null))
  }
}

class Endpoints extends Map {
  setMany(list: EndPoints) {
    for (const key in list) this.set(key, list[key])
    return this
  }
}

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

const buildOptions = (p: BuildPayloadProps) => {
  const { endpoint, props, method, special } = p
  const originParams = origins.collectScopedParams(endpoint.uri)
  const formData = special.$formData || endpoint.props?.formData

  const options = {
    ...originParams.options,
    ...endpoint.options,
    ...special.$options,
    method: method || endpoint.method,
    headers: {
      ...originParams.headers,
      ...endpoint.options?.headers,
      ...endpoint.headers,
      ...special.$options?.headers,
      ...special.$headers
    },
  }
  
  if (method.toUpperCase() !== 'GET') {
    if (formData) {
      options.body = formData instanceof HTMLFormElement
        ? new FormData(formData)
        : buildFormData({ params: props })
    } else {
      const body = special.$body || { ...originParams.props, ...endpoint.props, ...props }
      options.body = JSON.stringify(body)
    }
  }

  return options
}
const buildURL = (p: BuildPayloadProps) => {
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


const beginFetchSequence = (methodKey: VirtualMethod | null, name: string, props: GenericObj) => {
  const endpoint = endpoints.get(name)
  const method = methodKey === 'fetch' ? endpoint?.method : methodKey
  const problems = verifyInfo({ name, method, uri: endpoint?.uri })

  if (problems.length) {
    return produceError({ problems })
  } else {
    const { params, special }: SpecialSplitResult = splitProps(props)
    const buildPayloadProps = { endpoint, props: params, method, special }
    const options = buildOptions(buildPayloadProps)
    const uri = buildURL(buildPayloadProps)
    const hash = `${method}/${name}/${JSON.stringify(params)}`.toLocaleLowerCase()

    // Match duplicates
    if (ongoingRequests.has(hash)) return ongoingRequests.get(hash)

    // Mocks follow the same exact flow
    const promise = 'mock' in endpoint
      ? doMock(endpoint.mock, uri, options, name)
      : fetchData(uri, options)

    const startStamp = Date.now()
    
    ongoingRequests.set(hash, promise)

    return promise
      .then(async (v: GenericObj) => {
        // Delay the response if needed
        if (endpoint.delayAtLeast) await delayResponse(startStamp, endpoint.delayAtLeast)

        // Emit response if needed
        const always = proxyTarget.dispatchAlways
        always && globalThis?.dispatchEvent(new CustomEvent(always, { detail: v }))

        return v
      })
      .finally(() => ongoingRequests.delete(hash))
  }
}

export default new Proxy(proxyTarget, {
  get(target: GenericObj, key: VirtualMethod) {
    return virtualMethods.has(key)
      ? (endpoint: string, props: GenericObj = {}) => beginFetchSequence(key, endpoint, props)
      : target[key]
  },
  set(target: GenericObj, key: string, value: unknown) {
    const allowedSetters = new Set(['dispatchAlways'])
    const willChange = allowedSetters.has(key) && isString(value, true)

    if (willChange) target[key] = value

    return willChange
  },
})
