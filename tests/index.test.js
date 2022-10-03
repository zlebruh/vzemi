"use strict";
// import zemi from '../dist/index.js'
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("../src/index"));
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
            expect(index_1.default.origins instanceof Map).toBe(true);
            expect(index_1.default.collections instanceof Map).toBe(true);
            expect(index_1.default.fetch instanceof Function).toBe(true);
            expect(index_1.default.reset instanceof Function).toBe(true);
            expect(typeof index_1.default.dispatchAlways === 'string').toBe(true);
        });
        it('All props have the correct default values', () => {
            expect(index_1.default.origins.size).toBe(0);
            expect(index_1.default.collections.size).toBe(0);
            expect(index_1.default.dispatchAlways === '').toBe(true);
        });
    });
    describe('Collections management', () => {
        const HOST_A = 'http://localhost:1001';
        const HOST_B = 'http://turbo.hostyessss';
        const HOST_C = 'https://dir.bg';
        const COL_A = { url: '/path-A', method: 'GET' };
        const COL_B = { url: '/path-B', method: 'POST', mock: [111, 222, 333], delayAtLeast: 5000 };
        it('Add one collection', () => {
            index_1.default.collections.add(HOST_A, { COL_A });
            expect(index_1.default.collections.size).toBe(1);
            expect(index_1.default.origins.size).toBe(1);
            expect(index_1.default.collections.get('COL_A')).toBeDefined();
        });
        it('Add multiple collections', () => {
            expect(0).toBe(0);
        });
    });
    // ######################################
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
});
