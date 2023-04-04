declare module 'vzemi' {
  interface GenericObj { [key: string]: any }
  interface DoFetchResponse {
    MOCK?: boolean
    data: unknown | null,
    error?: 1,
    problems?: string[],
  }
  type VirtualMethod = 'get' | 'put' | 'post' | 'patch' | 'delete' | 'fetch'

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

  type Fn = ((...args: unknown[]) => never)
  type EndPointMock = GenericObj | Fn

  interface VzemiProxy {
    get(target: ProxyTarget, key: VirtualMethod): ((
      endpoint: string,
      props?: GenericObj
    ) => Promise<DoFetchResponse>) | Origins | CoolMap
  }

  class CoolMap extends Map {
    setMany(list: EndPoints): this
  }

  class Origins extends CoolMap {
    find(uri: string): EndPoint | undefined
  }

  class Endpoints extends CoolMap {}

  type ProxyTarget = {
    origins: Origins,
    endpoints: Endpoints
    [VirtualMethod: string]: VirtualMethod
  }

  const proxy: ProxyHandler<VzemiProxy>

  export default proxy
}
