import fetcherScopedCode from './code'

// Misc
const emitResponse = (params) => {
  const { pl: detail, $req: req } = params
  const done = req?.special.$done || req?.collection.done
  const type = typeof done
  const { dispatchEvent } = globalThis

  if (type === 'string' && dispatchEvent) dispatchEvent(new CustomEvent(done, { detail }))

  // TODO: This does not work because...
  // functions cannot be transferred to the worker
  // Find a solution
  if (type === 'function') done(detail)

  return detail
}
const spawnWorker = () => {
  const tpl = `(${fetcherScopedCode.toString()})();`
  const blob = new Blob([tpl], { type: 'application/javascript' })
  return new Worker(URL.createObjectURL(blob), [META])
}

const VIRTUAL_METHODS = new Set(['get', 'put', 'post', 'patch', 'delete'])
const META = { options: {}, collections: {} }
const WORKER = spawnWorker()

// Fetch job dispatching
let jobCounter = 0
const jobs = new Map()
const jobTimeout = 15000
const jobErrorTpl = { result: null, error: 1, message: `Job failed to executed within ${jobTimeout} seconds` }

const jobEnd = (response) => {
  const { jobID, toReject, pl } = response
  const action = toReject ? 'reject' : 'resolve'

  jobs.get(jobID)[action](pl)
  clearTimeout(jobID)
  return jobs.delete(jobID)
}

const msgHandler = ({ data }) => {
  const { cmd, pl } = data

  switch (cmd) {
    case 'init_out':
    case 'setup_out': Object.assign(META, pl); break;
    case 'fetch_out': jobEnd(data); break;
    case 'emit_out': emitResponse(data); break;
    default: console.warn('HANDLER DEFAULT', data); break;
  }
}

const jobStart = (props = {}) => {
  return new Promise((resolve, reject) => {
    const jobID = ++jobCounter
    const timer = setTimeout(() => jobEnd(jobID, jobErrorTpl), jobTimeout)
    jobs.set(jobID, { jobID, timer, resolve, reject })
    WORKER.postMessage({ jobID, cmd: 'fetch_in', pl: props })
  })
}

// Fetch setup
const fetchPublic = (name, props = {}) => jobStart({ name, props })
const fetchSetup = pl => WORKER.postMessage({ pl, cmd: 'setup_in' })

// Init
WORKER.addEventListener('message', msgHandler)
WORKER.postMessage({ cmd: 'init_in', pl: { META } })

const proxy = new Proxy(Object.freeze({ META, setup: fetchSetup, fetch: fetchPublic }), {
  get(target, prop) {
    if (VIRTUAL_METHODS.has(prop)) {
      return (name, props = {}) => jobStart({ name, props, method: prop })
    } else if (prop in target) {
      return target[prop]
    }
  }
})

// TODO: REMOVE WHEN DONE
proxy.setup({collections: {
  aaa: { method: 'GET', url: 'https://dir.bg/' },
  mocked: {
    method: 'GET',
    url: 'https://TIIIIR.bg/',
    mock: { cool: 'shit' },
    done: 'aistiga'
  },
}})

export default proxy
