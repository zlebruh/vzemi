export const produceError = (err: FetchErrorInput, result?: GenericObj): Promise<FetchErrorOutput> => {
  const { problems = [] } = err || {}
  const { data = null } = result || {}

  if (err.message) problems.push(err.message)

  return Promise.reject({ ...result, error: 1, data, problems })
}

export const splitProps = (obj: GenericObj): SpecialSplitResult => {
  const SPECIAL = new Set(['$body', '$path', '$options', '$headers', '$formData'])
  const result: SpecialSplitResult = { params: {}, special: {} }

  for (const key in obj) {
    const branch = SPECIAL.has(key) ? 'special' : 'params'

    result[branch][key] = obj[key]
  }
  return result
}

export const toCGI = (options: GenericObj = {}): string => {
  const keys = Object.keys(options)
  const max = keys.length - 1
  const initial = keys.length ? '?' : ''

  return keys.reduce((sum, key, idx) => {
    const item = String(options[key])
    const amp = idx >= max ? '' : '&'
    return `${sum + key}=${item + amp}`
  }, initial)
}

export const isString = (str: unknown, checkEmpty?: boolean) => {
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

export const fetchData = async (uri: string, options: RequestInit = {}) => {
  try {
    const res: GenericObj = await fetch(uri, options)
    const headers = Object.fromEntries(res.headers)
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

// TODO: ADD TESTS
export const drop = (ob: GenericObj, arr: string[]) => {
  const clone = { ...ob }
  arr.forEach((key) => delete clone[key])
  return clone
}