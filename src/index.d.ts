import { Obj, ReqProps } from '../types'

declare function emitResponse(detail: any, req: ReqProps): Obj
declare function spawnWorker(): Worker

declare const VIRTUAL_METHODS: string[]
declare const META: { options: Obj, collections: Obj }
declare const WORKER: Worker

declare let jobCounter: number
declare const jobs: MapConstructor
declare const jobTimeout: number
declare const jobErrorTpl: { result: null, error: 1, message: string }

declare function jobEnd(response): MapConstructor
declare function msgHandler({ data }): void
declare function jobStart(props: Obj): Promise<Obj>

declare function fetchPublic(name: string, props?: Obj): Promise<Obj>
declare function fetchSetup(pl: Obj): void

declare const proxy: ProxyConstructor
