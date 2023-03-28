export interface GenericObj { [key: string]: any }
export interface FetchResponse {
  MOCK?: boolean
  data: unknown | null,
  status?: number
  error?: 1,
  problems?: string[],
}

export interface FetchErrorOutput extends FetchResponse { error: 1 }

export type FetchErrorInput = {
  problems?: string[]
  message?: string
  error?: string
  errors?: string
}

export type Fn = ((...args: unknown[]) => never)
export interface NoProtoObject { __proto__: null }

export type VirtualMethod = 'get' | 'put' | 'post' | 'patch' | 'delete' | 'fetch'
export type SpecialKey = '$body' | '$path' | '$options' | '$headers' | '$formData'
export interface SpecialKeys { [SpecialKey: string]: any }

export interface SpecialSplitResult {
  params: GenericObj
  special: {
    [key: string]: SpecialKey
  }
}

export interface BuildPayloadProps {
  endpoint: EndPoint
  props: GenericObj
  method: VirtualMethod
  special: SpecialKeys
}

export interface EndPointProps extends GenericObj {
  [SpecialKey: string]: HTMLFormElement | GenericObj
}

export interface EndPoint {
  uri: string
  method?: string
  props?: EndPointProps
  options?: RequestInit
  headers?: Headers
  mock?: EndPointMock
}

export interface EndPoints {
  [key: string]: EndPoint
}

export type EndPointMock = GenericObj | Fn

export interface BuildFormDataProps {
  params: GenericObj
  prefix?: string
}