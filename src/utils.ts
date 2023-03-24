import type { GenericObj, FetchErrorInput, FetchErrorOutput, SpecialSplitResult, BuildFormDataProps } from '../types'

export const isObject = (v: unknown) => v && typeof v === 'object' && !Array.isArray(v)

export const deepMergeXX = (A: GenericObj = {}, B: GenericObj = {}) => {
  const result = Object.create(null)

  for (const key of Object.keys({ ...A, ...B })) {
    const a = A[key]
    const b = B[key]

    result[key] = isObject(a) || isObject(b)
      ? deepMerge(a, b)
      : b || a
  }

  return result
}

export const deepMerge = (A: GenericObj = {}, B: GenericObj = {}): GenericObj => {
  return Object.keys({ ...A, ...B }).reduce((acc, key) => {
    const a = A[key]
    const b = B[key]
    const value = isObject(a) || isObject(b)
      ? deepMerge(a, b)
      : b || a

    return Object.assign(acc, { [key]: value })
  }, Object.create(null))
}

export function produceError(err: FetchErrorInput, result?: GenericObj): Promise<FetchErrorOutput> {
  const { problems = [] } = err || {}
  const { data = null } = result || {}

  if (err.message) problems.push(err.message)

  return Promise.reject({ ...result, error: 1, data, problems })
}

export function splitProps(obj: GenericObj): SpecialSplitResult {
  const SPECIAL = new Set(['$body', '$path', '$options', '$headers', '$formData'])
  const result: SpecialSplitResult = { params: {}, special: {} }

  for (const key in obj) {
    const branch = SPECIAL.has(key) ? 'special' : 'params'

    result[branch][key] = obj[key]
  }
  return result
}

export function toCGI(options: GenericObj = {}): string {
  const keys = Object.keys(options)
  const max = keys.length - 1
  const initial = keys.length ? '?' : ''

  return keys.reduce((sum, key, idx) => {
    const item = String(options[key])
    const amp = idx >= max ? '' : '&'
    return `${sum + key}=${item + amp}`
  }, initial)
}

export function isString(str: unknown, checkEmpty?: boolean) {
  const isString = typeof str === 'string'
  return checkEmpty !== true ? isString : isString && !!str.length
}

export const delayResponse = async (startStamp: number, delay: number) => {
  if (typeof delay === 'number') {
    const ms = delay - (Date.now() - startStamp)
    ms > 0 && await new Promise(r => setTimeout(r, ms))
  }

  return true
}

// ####################### FETCH #######################
const regex = { json: /application\/json/, file: /image|file/ }
const contentType = 'content-type'

export async function fetchData(uri: string, options: RequestInit = {}) {
  try {
    const res: GenericObj = await fetch(uri, options)
    const headers = Object.fromEntries(res.headers)
    const contentHeader = headers[contentType]
    const data = await (regex.json.test(contentHeader)
      ? res.json()
      : regex.file.test(contentHeader) ? res.blob() : res.text())
    const { status } = res
    const result = { status, data }
    console.warn('SAY WUT NOW', headers)

    return status >= 400
      ? produceError({ message: res.statusText }, result)
      : data?.data === void 0 ? result : { status, ...data }
  } catch (err) {
    const pl = err instanceof Error ? err : { message: String(err) }
    return produceError(pl)
  }
}

export type BuildFormDataEntries = Array<[string, string]>

export const buildFormDataEntries = (props: BuildFormDataProps) => {
  const { params, prefix = '' } = props
  const keys: BuildFormDataEntries = []

  for (const [k, v] of Object.entries(params)) {
    const key = prefix ? `${prefix}[${k}]` : k

    v && typeof v === 'object'
      ? keys.push(...buildFormDataEntries({ params: v, prefix: key }))
      : keys.push([key, v])
  }

  return keys
}

export const buildFormData = (props: BuildFormDataProps) => {
  const keys = buildFormDataEntries(props)
  const formData = new FormData()

  keys.forEach(([k, v]) => formData.append(k, v))

  return formData
}
