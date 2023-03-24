const { default: zemi, virtualMethods } = require('../dist/src/index')

const resetMaps = () => {
  zemi.endpoints.clear()
  zemi.origins.clear()
}

describe('ZEMI - index.js', () => {
  const HOST_A = 'http://localhost:1001'
  const HOST_B = 'http://turbo.hostyessss'
  const HOST_C = 'https://dir.bg'
  
  const HEADERS_A = { auth: 'I AM VERY AUTHORIZED OH YE' }

  const COL_A = { uri: '/path-A', method: 'GET' }
  const COL_B = { uri: '/path-B', method: 'POST', mock: [111, 222, 333] }
  const COL_C = { uri: '/path-Z', method: 'POST', mock: (uri, options, name) => ({ uri, options, name }) }
  const COL_Z = { uri: '/path-Z', method: 'PUT', mock: { no: 'wai' }, delayAtLeast: 500 }

  describe('Proxy sanity check', () => {
    it('Verify Proxy fetch methods', () => {
      virtualMethods.forEach(v => expect(typeof zemi[v]).toBe('function'))
    })

    it('All props exist and are of the correct type', () => {
      expect(zemi.origins instanceof Map).toBe(true)
      expect(zemi.endpoints instanceof Map).toBe(true)
      expect(typeof zemi.dispatchAlways === 'undefined').toBe(true)
    })

    it('All props have the correct default values', () => {
      expect(zemi.origins.size).toBe(0)
      expect(zemi.endpoints.size).toBe(0)
      expect(zemi.dispatchAlways === void 0).toBe(true)
    })

    it('Ensure Map instances [Endpoints/Origins] works as such', () => {
      const { endpoints, origins } = zemi

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

  describe('Check hidden extras behave as expected', () => {
    describe('Building the right uri', () => {
      it('With GET: non-special params are transform to cgi query', () => {
        expect(0).toBe(0)
      })

      it('Ensure the path is inserted at the right places', () => {
        expect(0).toBe(0)
      })
    })

    it('Merging options/headers/props correctly', () => {
      expect(0).toBe(0)

      // TODO: INCLUDE STUFF FROM ORIGINS
    })
  })

  describe('Proxy usage', () => {
    describe('Incorrect usage', () => {
      afterEach(resetMaps)

      it('Non-existing endpoint', async () => {
        const name = 'waaa'
        const result = await zemi.fetch(name).catch(v => v)
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
        zemi.endpoints.set(name)

        const result = await zemi.fetch(name).catch(v => v)
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
        zemi.endpoints.set(name, { uri: '/jiggaMon' })

        const result = await zemi.fetch(name).catch(v => v)
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
      it('Endpoints - setMany', () => {
        expect(zemi.endpoints.size).toBe(0)

        const manyEndpoints = { colA: COL_A, colB: COL_B, colC: COL_C }

        zemi.endpoints.setMany(manyEndpoints)
        expect(zemi.endpoints.size).toBe(3)

        const allOK = Object.keys(manyEndpoints).every((key) => {
          return manyEndpoints[key] === zemi.endpoints.get(key)
        })

        expect(allOK).toBe(true)
      })

      fit('Origins - collectOptions', () => {
        const name = 'ccc'
        zemi.endpoints.set(name, COL_C)
        zemi.origins.set()
        expect(1).toBe(1)
      })
    })

    describe('Correct usage', () => {
      afterEach(resetMaps)

      it('Unreachable endpoint entry', async () => {
        const name = 'aaa'
        zemi.endpoints.set(name, COL_A)

        const result = await zemi.fetch(name).catch(v => v)
        const expected = {
          error: 1,
          data: null,
          problems: [`TypeError: Failed to parse URL from ${COL_A.uri}`],
        }
  
        expect(result).toEqual(expected)
      })

      it('Mocked endpoint entry - data', async () => {
        const name = 'bbb'
        zemi.endpoints.set(name, COL_B)

        const result = await zemi.fetch(name).catch(v => v)
        const expected = {
          MOCK: true,
          data: COL_B.mock,
        }
  
        expect(result).toEqual(expected)
      })

      it('Mocked endpoint entry - function', async () => {
        const name = 'ccc'
        zemi.endpoints.set(name, COL_C)

        const result = await zemi.fetch(name).catch(v => v)
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

    describe('"Special" features', () => {
      it('Delaying responses to test the limits of your app', async () => {
        const name = 'zzz'
        zemi.endpoints.set(name, COL_Z)

        const reqStart = Date.now()
        const result = await zemi.fetch(name).catch(v => v)
        const reqDelta = Date.now() - reqStart
  
        expect(reqDelta >= COL_Z.delayAtLeast)
        expect(result.data).toEqual(COL_Z.mock)
      })

      it('Build FormData', () => {
        expect(0).toBe(0)
      })

      it('Emit CustomEvent upon completion', () => {
        const name = 'hehe'
        zemi.endpoints.set()
        expect(0).toBe(0)
      })
    })
  })
})
