# zemi
Data fetching service for REST APIs

## Usage
```javascript
import zemi from 'zemi';

zemi.setup({ collections: myCollections });

await zemi.fetch('SOME_COLLECTION_NAME', {...});
```

# Configuration
## All **setup** options
```typescript
zemi.setup({
  // User provided string is used to dispatch a CustomEvent instance after every fetch
  always?: string,

  // Set a list of global options and headers used for every request
  // Each of those can be overwritten by collections and requests
  options?: {
    headers: {
      no: 'more',
      hanging: 'wires',
      bearer: 'HASH' // Your token or null to disable the header
    }
  }

  // Your collections. Each one has a name and a few basic props such as
  collections?: {
    [key: string]: {
      // This can be any full or relative path
      url: string,

      // Optional but highly recommended
      method?: string,

      // Optional. 'ram' is the only accepted value at this time
      cache?: string,

      // Optional. The actual fetch RequestInit object that includes headers and stuff
      options?: object,

      // Optional. Collection-specific headers.
      // Merged with domain-specific headers. Can be overwritten while making this request via '$headers'
      headers?: object,

      // You can assign anything to the `mock` property
      // Whatever you put here will be your `data` property
      mock?: {some: [1, 22, 333], more: 'stuff', aaa: 111, bbb: 222, ccc: {ama: 'zing'}},

      // Extract a list of props from the response. Think of it as "pick"
      extract?: ['thing1', 'anotherThing'], // string[]
      
      // Delay a request by ms. Applies to mocked and failed ones
      // Skipped when the request takes longer than provided integer
      // Time it took the request is substracted from provided integer
      delayAtLeast?: number,

      // You can also upload files
      uploadFile?: {
        url: '/upload',
        method: 'POST',
        isFile: true,
      },

      // You may use collections of aggregated collections
      allInfo: {
        collections: [
          // No such collections. Someone forgot them here...
          'about', 'info',

          // These are real ones
          'employees', 'employee', 'create', 'update', 'delete',
        ],
      },
    }
  }
});
```

## Simple Configuration - Define your collections / end-points
```javascript
const myCollections = {
  unfinished: {
    url: 'http://non.finished-api.yourdomain.com/api/v3/something',
    method: 'GET',
    mock: {some: [1, 22, 333], more: 'stuff', aaa: 111, bbb: 222, ccc: {ama: 'zing'}},
    extract: ['some', 'ccc']
    delayAtLeast: 5000
  },
  employee: {
    url: 'http://dummy.restapiexample.com/api/v1/employee/1',
    method: 'GET',
    cache: 'ram'
  },
  creater: {
    url: 'http://dummy.restapiexample.com/api/v1/create',
    method: 'POST',
  },
  updater: {
    url: 'http://dummy.restapiexample.com/api/v1/update/21',
    method: 'PUT',
  },
  patcher: {
    url: 'http://dummy.restapiexample.com/api/v1/update/21',
    method: 'patch',
  },
  deleter: {
    url: 'http://dummy.restapiexample.com/api/v1/delete/2',
    method: 'DELETE',
  },
};
```

## Usage and special props - everything is optional
```javascript

const mai_data = await fff.fetch('employee', {
  // Your props are transformed to either CGI in the URL or body payload
  a: 1,
  b: 2,
  c: 3,
  
  // Special props ARE OPTIONAL

  // When used, its value will replace your regular non-special props
  // which are usually used as your body payload
  $body: {},
  
  // Causes the fetcher to reject failed attempts
  // Be default, we don't do that and simply resolve
  // Exmaple: {error: 1, message: 'Bla bla bla', data: null}
  $reject: true,

  // Merged into a collection's url
  $path: '/aaa/bbb/ccc',

  // Merged with the fetch options object.
  // Will overwrite any matching props provided by
  // the global options and the collection itself
  $options: {...},

  // Merged with headers from the global setup object
  // AND the headers in the collection itself
  $headers: {x: 1, y: 2, z: 3},

  // Cached collection response, if any, is being ignored and a new request is being made.
  // If successful, any prior cache is updated
  $refresh: true,

  // Replaces the collection `extract` property, if any
  $extract: ['prop1', 'prop2', 'prop3'],
})
```

## Aborting requests
The simplest way to abort a request is like this
```javascript
const ac = new AbortController()

zemi.get('someCollection', {
  $options: { signal: ac.signal }
})

ac.abort()
```

## Overwriting collection HTTP method
`zemi.fetch` does't make much sense to you? We've got you covered with<br >
Existing collection method is being overwritten while making this request
```javascript
zemi.get('someCollection', {...})
zemi.put('someCollection', {...})
zemi.post('someCollection', {...})
zemi.patch('someCollection', {...})
zemi.delete('someCollection', {...})
```

## Changing options, headers, etc.
```javascript
zemi.setup({
  collections: myCollections,
  options: {
    headers: {
      no: 'more',
      hanging: 'wires',
      bearer: 'HASH' // Your token or null to disable the header
    }
  }
});
```

## Mocking endpoints
```javascript
const myCollections = {
  unfinished: {
    url: 'http://non.finished-api.yourdomain.com/api/v3/something',
    method: 'GET',

    // OPTIONAL PARAMETER - Whatever you put here will be your `data`
    mock: {some: [1, 22, 333], more: 'stuff'}
  },
};

await fff.fetch('unfinished')
// {
//   MOCK: true,
//   collection: "unfinished",
//   data: {some: [1, 22, 333], more: "stuff"},
// }
```

## Dispatching global event on **any** fetch, successful and failed
```javascript
zemi.setup({
  always: 'YOUR_EVENT_NAME', // OPTIONAL PARAMETER - String
});
```

## Important note about fetch
You are expected to have `fetch` in your global scope.
