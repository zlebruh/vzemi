import fetcherScopedCode from './code'

// Misc
const emitResponse = (detail) => {
  const { always } = META
  const { dispatchEvent } = globalThis

  always && dispatchEvent && dispatchEvent(new CustomEvent(always, { detail }))

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
const domains = new Set()
const jobs = new Map()
const jobTimeout = 300000 // 5 minutes. Yeah, it's alot
const jobErrorTpl = { result: null, error: 1, message: `Job failed to executed within ${jobTimeout} seconds` }

const jobEnd = (response) => {
  const { jobID, toReject, pl } = response
  const action = toReject ? 'reject' : 'resolve'

  jobs.get(jobID)?.[action](pl)
  setTimeout(() => emitResponse(pl), 0)
  clearTimeout(jobID)
  return jobs.delete(jobID)
}

const msgHandler = ({ data }) => {
  const { cmd, pl } = data

  switch (cmd) {
    case 'init_out':
    case 'setup_out': Object.assign(META, pl); break;
    case 'fetch_out': jobEnd(data); break;
    default: console.warn('HANDLER DEFAULT', data); break;
  }
}

const jobStart = (props = {}) => {
  return new Promise((resolve, reject) => {
    const jobID = ++jobCounter
    const timer = setTimeout(() => jobEnd({ jobID, pl: jobErrorTpl }), jobTimeout)
    jobs.set(jobID, { jobID, timer, resolve, reject })
    WORKER.postMessage({ jobID, cmd: 'fetch_in', pl: props })
  })
}

// Fetch setup
const fetchPublic = (name, props = {}) => jobStart({ name, props })
const fetchSetup = pl => WORKER.postMessage({ pl, cmd: 'setup_in' })

// Domain setup
const domainAdd = (domain, list) => {
  const entries = Object.entries(list)

  if (!entries.length) return false

  const processed = entries.reduce((acc, [k, v]) => {
    const value = { domain, url: domain + v.url }
    return Object.assign(acc, { [k]: value })
  }, {})

  const collections = { ...META.collections, ...processed }
  fetchSetup({ collections })

  return domains.add(domain)
}
const domainDrop = (domain) => {
  const collections = { ...META.collections }
  Object.entries(collections).forEach(([k, v]) => domain === v.domain && delete collections[k])
  fetchSetup({ collections })
  return domains.delete(domain)
}

// Init
WORKER.addEventListener('message', msgHandler)
WORKER.postMessage({ cmd: 'init_in', pl: { META } })

const exposedMethods = {
  setup: fetchSetup,
  fetch: fetchPublic,
  domainAdd,
  domainDrop
}

const proxy = new Proxy(Object.freeze({ META, domains, ...exposedMethods }), {
  get(target, prop) {
    if (VIRTUAL_METHODS.has(prop)) {
      return (name, props = {}) => jobStart({ name, props, method: prop })
    } else if (prop in target) {
      return target[prop]
    }
  }
})

// TODO: REMOVE WHEN DONE
Object.assign(globalThis, { jobs, META, domains })
globalThis.addEventListener('no-wai', e => {
  console.warn('EV:', e.detail)
})
proxy.setup({
  // always: 'no-wai',
  collections: {
    aaa: { method: 'GET', url: 'https://dir.bg/' },
    mocked: {
      method: 'GET',
      url: 'https://TIIIIR.bg/',
      mock: { cool: 'MOCK_1' }
    },
    mocked2: {
      method: 'GET',
      url: 'https://TIIIIR.bg/',
      mock: { cool: 'MOCK_2' }
    },
    mocked3: {
      url: 'https://aisTIGABEE.bg/',
      mock: { cool: 'MOCK_3' }
    },
  }
})

setTimeout(() => proxy.domainAdd('http://dir.bg', {
  index: { method: 'GET', url: '/' },
  feature: {
    method: 'GET',
    url: '/feature3',
    mock: { cool: 'shit1' }
  },
  feature2: {
    method: 'GET',
    url: '/feature2',
    mock: { cool: 'shit2' }
  },
  feature3: {
    url: '/feature3',
    mock: { cool: 'shit3' }
  },
}), 100)

export default proxy
