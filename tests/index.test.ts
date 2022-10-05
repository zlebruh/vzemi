// import zemi from '../dist/index.js'

import zemi from '../src/index'

// const COLLECTIONS = {
//   employees: {
//     url: 'http://dummy.restapiexample.com/api/v1/employees',
//     cache: 'ram', // OPTIONAL PARAMETER. 'ram' is the only accepted value at this time
//     method: 'GET',
//   },
//   employee: {
//     url: 'http://dummy.restapiexample.com/api/v1/employee/',
//     method: 'GET',
//   },
//   create: {
//     url: 'http://dummy.restapiexample.com/api/v1/create',
//     method: 'POST',
//   },
//   update: {
//     url: 'http://dummy.restapiexample.com/api/v1/update/',
//     method: 'PUT',
//   },
//   delete: {
//     url: 'http://dummy.restapiexample.com/api/v1/delete/',
//     method: 'DELETE',
//   },

//   // You can also upload files
//   uploadFile: {
//     url: 'http://dummy.restapiexample.com/api/v1/upload/',
//     method: 'POST',
//     isFile: true,
//   },

//   // AGGREGATED
//   // You may use collections of aggregated collections
//   allInfo: {
//     collections: [
//       'about', 'info',                                       // No such collections. Someone forgot them here...
//       'employees', 'employee', 'create', 'update', 'delete', // These are real ones
//     ],
//   },

//   // BROKEN
//   broken: {
//     url: 'https://fuck.you.hard/yea/deepr',
//     method: 'POST',
//   },
// };

// zemi.Setup({ collections: COLLECTIONS });

// #############################################################################################################

// zemi.collections.add('http://localhost:1001', {
//   aaa: { url: '/path-A', method: 'GET' },
//   bbb: { url: '/path-B', method: 'POST', mock: [111, 222, 333], delayAtLeast: 5000 }
// }, { boo: 123, headers: { aaaaa_AUTH_HEADERS: 11111 }})

// zemi.collections.add('http://turbo.hostyessss', {
//   yyy: { url: '/path-Y', method: 'GET' },
//   zzz: { url: '/path-Z', method: 'POST', mock: req => req}
// }, {headers: { TURBO___AUTH: 'I AM VERY AUTHORIZED OH YE' }})

describe('ZEMI - index.js', () => {
  const HOST_A = 'http://localhost:1001'
  const HOST_B = 'http://turbo.hostyessss'
  const HOST_C = 'https://dir.bg'
  
  const HEADERS_A = { auth: 'I AM VERY AUTHORIZED OH YE' }

  const COL_A = { url: '/path-A', method: 'GET' }
  const COL_B = { url: '/path-B', method: 'POST', mock: [111, 222, 333], delayAtLeast: 5000 }
  const COL_C = { url: '/path-C', method: 'PUT' }
  const COL_D = { url: '/path-D', method: 'POST' }
  const COL_Z = { url: '/path-Z', method: 'POST', mock: (req: unknown) => req }

  describe('Proxy sanity check', () => {
    it('All props exist and are of the correct type', () => {
      expect(zemi.origins instanceof Map).toBe(true)
      expect(zemi.collections instanceof Map).toBe(true)
      expect(zemi.fetch instanceof Function).toBe(true)
      expect(zemi.reset instanceof Function).toBe(true)
      expect(typeof zemi.dispatchAlways === 'string').toBe(true)
    })

    it('All props have the correct default values', () => {
      expect(zemi.origins.size).toBe(0)
      expect(zemi.collections.size).toBe(0)
      expect(zemi.dispatchAlways === '').toBe(true)
    })

    it('Ensure the "reset" method works as intended', () => {
      // Purely mechanical simulation
      zemi.origins.set('oh', 'yeah')
      zemi.collections.set('more', 'values')

      expect(zemi.origins.size).toBe(1)
      expect(zemi.collections.size).toBe(1)
      zemi.reset()
      expect(zemi.origins.size).toBe(0)
      expect(zemi.collections.size).toBe(0)
    })
  })

  describe('Collections management and "origins" side effects', () => {
    // ##### COLLECTIONS ADD #####
    it('Add one collection', () => {
      zemi.collections.add(HOST_A, { COL_A })
      expect(zemi.collections.get('COL_A')).toBeDefined()
      expect(zemi.collections.size).toBe(1)
      expect(zemi.origins.size).toBe(1)
    })

    it('Add more unique collections to same origin', () => {
      zemi.collections.add(HOST_A, { COL_B, COL_C })

      const cols = ['COL_A', 'COL_B', 'COL_C']
      cols.forEach((v: string) => expect(zemi.collections.get(v)).toBeDefined())

      expect(zemi.collections.size).toBe(3)
      expect(zemi.origins.size).toBe(1)
    })

    it('Replace existing collection', () => {
      zemi.collections.add(HOST_A, { COL_A: COL_D })

      expect({ ...COL_D, origin: HOST_A }).toStrictEqual(zemi.collections.get('COL_A'))
      expect(zemi.collections.size).toBe(3)
      expect(zemi.origins.size).toBe(1)
    })

    // ##### COLLECTIONS DROP #####
    it('Drop - but fail - unexisting collections', () => {
      const initialCollections = zemi.collections.size
      const list = ['missing_1', 'missing_2', 'missing_3']

      expect(list.every(zemi.collections.drop)).toBe(false)
      expect(zemi.collections.drop(list)).toBe(false)
      expect(zemi.collections.size).toBe(initialCollections)
    })

    it('Drop one collection', () => {
      const initialCollections = zemi.collections.size
      
      expect(zemi.collections.drop('COL_A')).toBe(true)
      expect(zemi.collections.size).toBe(initialCollections - 1)
    })

    it('Drop multiple collections', () => {
      const initialCollections = zemi.collections.size
      const list = ['COL_B', 'COL_C']

      expect(list.every(zemi.collections.drop)).toBe(true)
      expect(zemi.collections.size).toBe(initialCollections - 2)
    })
  })

  // ######################################

  describe('Origins management', () => {
    beforeEach(zemi.reset)

    it('Side effects sanity check', () => {
      zemi.collections.add(HOST_A, { COL_A })
      expect(zemi.collections.get('COL_A')).toBeDefined()
      expect(zemi.collections.size).toBe(1)
      expect(zemi.origins.size).toBe(1)
    })

    it('Change options - replace', () => {
      const changes = { replacer: true }
      const options = { headers: HEADERS_A }

      zemi.collections.add(HOST_A, { COL_C }, options)
      expect(zemi.origins.get(HOST_A)).toStrictEqual(options)

      // Actual test
      zemi.origins.change(HOST_A, changes)
      expect(zemi.origins.get(HOST_A)).toBe(changes)
    })

    it('Change options - merge', () => {
      const changes = { replacer: true }
      const options = { headers: HEADERS_A }
      const latest = () => zemi.origins.get(HOST_A)

      zemi.collections.add(HOST_A, { COL_C }, options)
      expect(latest()).toStrictEqual(options)

      // Actual test
      zemi.origins.change(HOST_A, changes, true)
      expect(latest()).toEqual({ ...latest(), ...changes })
    })

    it('Reset origin options', () => {
      zemi.collections.add(HOST_A, { COL_C }, {})
      expect(zemi.origins.get(HOST_A)).toEqual({})
    })

    describe('Dropping origins (and their collection)', () => {
      const hosts: string[] = [HOST_A, HOST_B, HOST_C]
      const addAndCheckMultiHostCollections = () => {
        zemi.collections.add(HOST_A, { COL_A })
        zemi.collections.add(HOST_B, { COL_B })
        zemi.collections.add(HOST_C, { COL_C, COL_Z })

        expect(zemi.collections.size).toBe(4)
        expect(zemi.origins.size).toBe(3)
      }

      it('Drop origin', () => {
        zemi.collections.add(HOST_A, { COL_C })
        expect(zemi.origins.drop(HOST_A)).toBe(true)
      })

      it('Drop multiple origins - manually #1', () => {
        // Sanity check
        addAndCheckMultiHostCollections()
  
        // Actual test
        const allGone = hosts.every(v => zemi.origins.drop(v) === true)
        expect(allGone).toBe(true)
        expect(zemi.collections.size).toBe(0)
        expect(zemi.origins.size).toBe(0)
      })

      it('Drop multiple origins - manually #2', () => {
        // Sanity check
        addAndCheckMultiHostCollections()
  
        // Actual test
        const initCollections = zemi.collections.size
        const initOrigins = zemi.origins.size

        zemi.origins.drop(HOST_A)
        expect(zemi.collections.size).toBe(initCollections - 1)
        expect(zemi.origins.size).toBe(initOrigins - 1)

        zemi.origins.drop(HOST_B)
        expect(zemi.collections.size).toBe(initCollections - 2)
        expect(zemi.origins.size).toBe(initOrigins - 2)

        zemi.origins.drop(HOST_C)
        expect(zemi.collections.size).toBe(initCollections - 4)
        expect(zemi.origins.size).toBe(initOrigins - 3)
      })
  
      it('Drop multiple origins - using an array', () => {
        // Sanity check
        addAndCheckMultiHostCollections()
  
        // Actual test
        zemi.origins.drop(hosts)
        expect(zemi.collections.size).toBe(0)
        expect(zemi.origins.size).toBe(0)
      })
  
      it('Drop unexisting origins', () => {
        // Checking random names
        const unexisting: string[] = ['aaa', 'bbb', 'ccc']
        unexisting.forEach(v => expect(zemi.origins.drop(v)).toBe(false))
  
        // Ensure sanity yet again
        const options = { headers: HEADERS_A }
        zemi.collections.add(HOST_A, { COL_C }, options)
        expect(zemi.origins.get(HOST_A)).toStrictEqual(options)
  
        // Actual test and one more for sanity's sake
        expect(zemi.origins.drop(HOST_A)).toBe(true)
        expect(zemi.origins.drop(HOST_A)).toBe(false)
      })
    })
  })

  // describe('AAAAA', () => {
  //   it('WWW', () => {
  //     expect(0).toBe(0)
  //   })
  // })
})
