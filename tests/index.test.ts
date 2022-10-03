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

  describe('Collections management', () => {
    const HOST_A = 'http://localhost:1001'
    const HOST_B = 'http://turbo.hostyessss'
    const HOST_C = 'https://dir.bg'

    const COL_A = { url: '/path-A', method: 'GET' }
    const COL_B = { url: '/path-B', method: 'POST', mock: [111, 222, 333], delayAtLeast: 5000 }
    const COL_C = { url: '/path-C', method: 'PUT' }
    const COL_D = { url: '/path-D', method: 'POST' }
    const COL_Z = { url: '/path-Z', method: 'POST', mock: (req: unknown) => req }

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

      // expect(0).toBe(0)
    })
  })

  // ######################################

  describe('Origins management', () => {
    it('Side effects #1', () => {
      expect(0).toBe(0)
    })

    it('Side effects #2', () => {
      expect(0).toBe(0)
    })

    it('Side effects #31', () => {
      expect(0).toBe(0)
    })

    it('Add options', () => {
      expect(0).toBe(0)
    })

    it('Replace options', () => {
      expect(0).toBe(0)
    })

    it('Merge options', () => {
      expect(0).toBe(0)
    })

    it('Drop options', () => {
      expect(0).toBe(0)
    })
  })

  // describe('QQQTTTT', () => {
  //   it('WWW', () => {
  //     expect(0).toBe(0)
  //   })
  // })

  // test('SERVICE OK #1', () => {
  //   const types = ['origins', 'collections', 'fetch', 'reset', 'dispatchAlways']

  //   // console.warn('ZEMI', zemi)

  //   expect('dummy').toBe('dummy')
  // })
})
