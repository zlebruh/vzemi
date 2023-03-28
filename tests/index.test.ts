import vzemi, { virtualMethods } from '../src/index'
import { GenericObj } from '../src/types'

const resetMaps = () => {
  vzemi.endpoints.clear()
  vzemi.origins.clear()
}

const mockFn = (uri: string, options: GenericObj, name: string) => ({ uri, options, name })

describe('vzemi - index.ts', () => {  
  const COL_A = { uri: '/path-A', method: 'GET' }
  const COL_B = { uri: '/path-B', method: 'POST', mock: [111, 222, 333] }
  const COL_C = { uri: '/path-Z', method: 'POST', mock: mockFn }
  const COL_Z = { uri: '/path-Z', method: 'PUT', mock: { no: 'wai' }, delayAtLeast: 500 }

  const manyEndpoints: GenericObj = { colA: COL_A, colB: COL_B, colC: COL_C }
  const manyOrigins: GenericObj = {
    '/': {
      mode: 'cors',
      headers: { LEVEL_0_H: '0_hehehe' }
    },
    'http://localhost:1001': {
      mode: 'no-cors',
      cache: 'force-cache',
      signal: null,
      boo2: '222_shakalaka',
      headers: { auth: 'DIESEL_123' }
    }
  }

  describe('Proxy sanity check', () => {
    it('Verify Proxy fetch methods', () => {
      virtualMethods.forEach((v: string) => expect(typeof vzemi[v]).toBe('function'))
    })

    it('All props exist and are of the correct type', () => {
      expect(vzemi.origins instanceof Map).toBe(true)
      expect(vzemi.endpoints instanceof Map).toBe(true)
      expect(typeof vzemi.emitAlways === 'undefined').toBe(true)
    })

    it('All props have the correct default values', () => {
      expect(vzemi.origins.size).toBe(0)
      expect(vzemi.endpoints.size).toBe(0)
      expect(vzemi.emitAlways === void 0).toBe(true)
    })

    it('Ensure Map instances [Endpoints/Origins] works as such', () => {
      const { endpoints, origins } = vzemi

      // Purely mechanical simulation
      origins.set('oh', 'yeah')
      endpoints.set('more', 'values')

      expect(origins.size).toBe(1)
      expect(endpoints.size).toBe(1)
      resetMaps()
      expect(origins.size).toBe(0)
      expect(endpoints.size).toBe(0)
    })
  })

  describe('Verify special features behave as expected', () => {
    beforeEach(resetMaps)
    afterEach(resetMaps)

    describe('Building the right uri', () => {
      it('With GET: non-special params are transform to cgi query', async () => {
        const name = 'ccc'
        vzemi.endpoints.set(name, COL_C)

        const result = await vzemi.get(name, { no: 'wai', it: 'works' }).catch((v: unknown) => v)
        const expected = {
          MOCK: true,
          data: {
            name,
            uri: COL_C.uri + '?no=wai&it=works',
            options: { headers: {}, method: 'get' },
          },
        }
  
        expect(result).toEqual(expected)
      })

      it('Ensure the path is inserted at the right places', async () => {
        const name = 'ccc'
        vzemi.endpoints.set(name, COL_C)

        const props = { $path: '/some-path', it: 'works' }
        const result = await vzemi.get(name, props).catch((v: unknown) => v)
        const expected = {
          MOCK: true,
          data: {
            name,
            uri: COL_C.uri + '/some-path?it=works',
            options: { headers: {}, method: 'get' },
          },
        }
  
        expect(result).toEqual(expected)
      })
    })

    it('Merging options/headers/props correctly', async () => {
      const COL_X = {
        uri: '/path-X',
        method: 'POST',
        mock: mockFn,
        options: { mode: 'cors' },
        headers: { another: 'token' },
      }
      const name = 'xxx'
      vzemi.endpoints.set(name, COL_X)
      vzemi.origins.set('/', { cache: 'force-cache' })

      const props = { no: 'wai', $headers: { mama: 'nono' } }
      const result = await vzemi.post(name, props).catch((v: unknown) => v)
      const expected = {
        MOCK: true,
        data: {
          name,
          uri: COL_X.uri,
          options: {
            cache: 'force-cache',
            mode: 'cors',
            body: JSON.stringify({ no: 'wai' }),
            headers: { ...props.$headers, ...COL_X.headers },
            method: 'post'
          },
        },
      }

      expect(result).toEqual(expected)
    })

    it('Delaying responses to test the limits of your app', async () => {
      const name = 'zzz'
      vzemi.endpoints.set(name, COL_Z)

      const reqStart = Date.now()
      const result = await vzemi.fetch(name).catch((v: unknown) => v)
      const reqDelta = Date.now() - reqStart

      expect(reqDelta >= COL_Z.delayAtLeast)
      expect(result.data).toEqual(COL_Z.mock)
    })

    it('Build FormData', async () => {
      const name = 'ccc'
      vzemi.endpoints.set(name, COL_C)

      const props = {
        no: 'wai',
        the: {
          dark: 'forst',
          theory: ['might be correct'],
          arr: ['AAA', 'BBB', 'CCC'],
          arr2: [{ name: '123'}, { name: '456'}, { name: '789'}],
        },
        $formData: true
      }
      const expected = [
        [ 'no', 'wai' ],
        [ 'the[dark]', 'forst' ],
        [ 'the[theory][0]', 'might be correct' ],
        [ 'the[arr][0]', 'AAA' ],
        [ 'the[arr][1]', 'BBB' ],
        [ 'the[arr][2]', 'CCC' ],
        [ 'the[arr2][0][name]', '123' ],
        [ 'the[arr2][1][name]', '456' ],
        [ 'the[arr2][2][name]', '789' ]
      ]

      const result = await vzemi.post(name, props).catch((v: unknown) => v)
      const { body } = result.data.options

      // Verify format
      expect(body instanceof FormData).toEqual(true)
      expect([...body.entries()]).toEqual(expected)
    })

    it.skip('Emit CustomEvent upon completion', async () => {
      const name = 'ccc'
      vzemi.endpoints.set(name, COL_C)

      const callback = jest.fn()
      globalThis.addEventListener('sisi', callback)

      await vzemi.get(name, { no: 'wai', it: 'works' }).catch((v: unknown) => v)
      expect(callback).toHaveBeenCalledTimes(0)

      // Set global event - this should be dispatched on each fetch resolution, successful or not
      vzemi.emitAlways = 'sisi'

      await vzemi.get(name, { no: 'wai', it: 'works' }).catch((v: unknown) => v)
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('Proxy usage', () => {
    describe('Incorrect usage', () => {
      afterEach(resetMaps)

      it('Non-existing endpoint', async () => {
        const name = 'waaa'
        const result = await vzemi.fetch(name).catch((v: unknown) => v)
        const expected = {
          error: 1,
          data: null,
          problems: [
            `Endpoint '${name}' not found in endpoints`,
            `Endpoint '${name}' has no URI`,
            `Endpoint '${name}' has no method`,
          ],
        }
  
        expect(result).toEqual(expected)
      })

      it('Existing endpoint without uri', async () => {
        const name = 'waaa'
        vzemi.endpoints.set(name)

        const result = await vzemi.fetch(name).catch((v: unknown) => v)
        const expected = {
          error: 1,
          data: null,
          problems: [
            `Endpoint '${name}' has no URI`,
            `Endpoint '${name}' has no method`,
          ],
        }
  
        expect(result).toEqual(expected)
      })

      it('Existing endpoint without method', async () => {
        const name = 'waaa1'
        vzemi.endpoints.set(name, { uri: '/jiggaMon' })

        const result = await vzemi.fetch(name).catch((v: unknown) => v)
        const expected = {
          error: 1,
          data: null,
          problems: [`Endpoint '${name}' has no method`],
        }
  
        expect(result).toEqual(expected)
      })
    })

    describe('Setting Endpoints and Origins', () => {
      beforeEach(resetMaps)
      afterEach(resetMaps)

      // Since both extend Map, we only test for custom stuff
      it('Endpoints - set & setMany', () => {
        expect(vzemi.endpoints.size).toBe(0)

        vzemi.endpoints.set('colZ', COL_Z)
        expect(vzemi.endpoints.size).toBe(1)

        vzemi.endpoints.setMany(manyEndpoints)
        expect(vzemi.endpoints.size).toBe(4)

        const allOK = Object.keys(manyEndpoints).every((key) => {
          return manyEndpoints[key] === vzemi.endpoints.get(key)
        })

        expect(allOK).toBe(true)
      })

      it('Origins - set & setMany', () => {
        expect(vzemi.origins.size).toBe(0)

        vzemi.origins.set('/aha', {})
        expect(vzemi.origins.size).toBe(1)

        vzemi.origins.setMany(manyOrigins)
        expect(vzemi.origins.size).toBe(3)

        const allOK = Object.keys(manyOrigins).every((key) => {
          return manyOrigins[key] === vzemi.origins.get(key)
        })

        expect(allOK).toBe(true)
      })

      it('Origins - find options', () => {
        // Sanity
        expect(vzemi.origins.find()).toEqual({})
        expect(vzemi.origins.find('')).toEqual({})

        // Setup a working situation
        vzemi.endpoints.setMany(manyEndpoints)
        vzemi.origins.setMany(manyOrigins)

        expect(vzemi.origins.find('/')).toEqual(manyOrigins['/'])
      })
    })

    describe('Correct usage', () => {
      afterEach(resetMaps)

      it('Unreachable endpoint entry', async () => {
        const name = 'aaa'
        vzemi.endpoints.set(name, COL_A)

        const result = await vzemi.fetch(name).catch((v: unknown) => v)
        const expected = {
          error: 1,
          data: null,
          problems: [`TypeError: Failed to parse URL from ${COL_A.uri}`],
        }
  
        expect(result).toEqual(expected)
      })

      it('Mocked endpoint entry - data', async () => {
        const name = 'bbb'
        vzemi.endpoints.set(name, COL_B)

        const result = await vzemi.fetch(name).catch((v: unknown) => v)
        const expected = {
          MOCK: true,
          data: COL_B.mock,
        }
  
        expect(result).toEqual(expected)
      })

      it('Mocked endpoint entry - function', async () => {
        const name = 'ccc'
        vzemi.endpoints.set(name, COL_C)

        const result = await vzemi.fetch(name).catch((v: unknown) => v)
        const expected = {
          MOCK: true,
          data: {
            name,
            uri: COL_C.uri,
            options: { body: JSON.stringify({}), headers: {}, method: COL_C.method },
          },
        }
  
        expect(result).toEqual(expected)
      })
    })
  })
})
