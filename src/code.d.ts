import {
  Obj, ReqProps, PrefetchProps, FetchProps, FetchMethod, FetchError,
  FetchResponse, SetupOptions, CollectionOptions
} from '../types'

declare function fetcherScopedCode(): void

// ################ Utils ################
declare const regex: { json: RegExp, file: RegExp }
declare const contentType = 'content-type'

declare function isString(str: string, checkEmpty?: boolean): boolean
declare function isObject(val: any, checkEmpty?: boolean): boolean
declare function produceError(err: Obj|any, result?: Obj): FetchError
declare function propsToCGI(options: Obj): string
declare function splitProps(obj: Obj): { params: Obj, special: Obj }
declare function omit(target: Obj, keys:string[]): Obj
declare function pick(target: Obj, keys:string[]): Obj
declare function extractResponse(reqResponse: Obj, extract: string[]): Obj
declare function emitResponse(detail: any, req: ReqProps): Obj
declare function fetchData(uri: string, options: RequestInit): Promise<Obj>

// ################ Store ################
declare const fetchStore: { CACHE: Obj, REQUESTS: Obj }
declare function entityAdd(store, hash, payload): boolean
declare function entityRemove(store, hash): boolean
declare function reqHas(hash: string): Obj|null
declare function reqAdd(hash: string, promise: Promise<Obj>): boolean
declare function reqRemove(hash: string): boolean
declare function cacheHas(hash: string): Obj|null
declare function cacheAdd(hash, data): boolean
declare function cacheRemove(hash: string): boolean

// ################ Fetcher ################
declare const META: null | { options: Obj, collections: Obj }
declare const VERIFY: Obj

declare function buildURL(req: ReqProps, method: FetchMethod): string
declare function buildInfo(fetchProps: FetchProps): PrefetchProps
declare function verifyInfo(info: Obj): string[]
declare function buildReq(name: string, props: Obj, method: FetchMethod): ReqProps
declare function initiateRequest(req: Obj, url: string): Promise<Obj>
declare function requestData(req?: ReqProps, url?: string): Promise<Obj>
declare function fetchOne(fetchProps: FetchProps): Promise<FetchResponse>
declare function functionfetchMultiple(collections: string[], props: Obj): Promise<Obj>
declare function processResponse(req: Obj, response: Obj): Obj
declare function setup(props: SetupOptions): Obj
declare function fetchAttempt(jobID: string, params: {name: string, props: Obj, method?: FetchMethod}): Promise<Obj>
