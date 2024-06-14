declare global {
  interface GenericObj { [key: string]: any }
  interface FetchResponse {
    MOCK?: boolean
    data: unknown | null,
    status?: number
    error?: 1,
    problems?: string[],
  }

  interface FetchErrorOutput extends FetchResponse { error: 1 }

  type FetchErrorInput = {
    problems?: string[]
    message?: string
    error?: string
    errors?: string
  }

  type Fn = ((...args: unknown[]) => never)
  interface NoProtoObject { __proto__: null }

  type VirtualMethod = 'get' | 'put' | 'post' | 'patch' | 'delete' | 'fetch'
  type SpecialKey = '$body' | '$path' | '$options' | '$headers' | '$formData'
  interface SpecialKeys { [SpecialKey: string]: any }

  interface SpecialSplitResult {
    params: GenericObj
    special: {
      [key: string]: SpecialKey
    }
  }

  interface BuildSequenceHelperProps {
    origin: GenericObj
    endpoint: EndPoint
    props: GenericObj
    method: VirtualMethod
    special: SpecialKeys
  }

  interface BuildSequenceObj { uri: string, hash: string, options: RequestInit }

  interface EndPointProps extends GenericObj {
    [SpecialKey: string]: HTMLFormElement | GenericObj
  }

  interface EndPoint {
    uri: string
    method?: string
    props?: EndPointProps
    options?: RequestInit
    headers?: Headers
    mock?: EndPointMock
  }

  interface EndPoints {
    [key: string]: EndPoint
  }

  type EndPointMock = GenericObj | Fn

  interface BuildFormDataProps {
    params: GenericObj
    prefix?: string
  }
}


export default global
