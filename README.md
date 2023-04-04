# vzemi

vzemi provides a wrapper for the global fetch method.

It exposes a Proxy object with two instances of Map: `endpoints` and `origins`.

## Quick usage

```javascript
import vzemi from "vzemi"

vzemi.endpoints.set("books", { uri: "/jumbo/books" })

await vzemi.get("books", { index: 0, size: 100 })
await vzemi.put("books", { index: 0, size: 100 })
await vzemi.post("books", { index: 0, size: 100 })
await vzemi.patch("books", { index: 0, size: 100 })
await vzemi.delete("books", { index: 0, size: 100 })
await vzemi.fetch("books", { index: 0, size: 100 })

// FetchResponse: {
//   MOCK?: boolean
//   data: unknown | null,
//   error?: 1,
//   problems?: string[],
// }
```

<br>

## A word on the vzemi's structure

Both `origins` and `endpoints` extend the regular old [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) and can be managed via the **set**, **setMany**, **delete**, and **clear** methods.

<br>

## Endpoints
An EndPoint is just an object helper for HTTP requests. Its contents are used
and/or merged when fetching data.

```typescript
interface EndPoint {
  // This can be any full or relative path
  uri: string

  // Optional. vzemi.fetch defaults to this value. vzemi.get/post/etc. override this value
  method?: string

  // Optional. Predefined props that you might have for this endpoint
  // Merged with request-specific params
  props?: {}

  // Optional. The actual fetch RequestInit object that includes headers, mode, etc
  // Merged with origin-specific options
  options?: {}

  // Optional. Merged with origin-specific headers.
  // Can be overwritten while making this request via '$headers'
  headers?: {}

  // Optional. Whatever you put here will be your `data` property
  mock?: {some: [1, 22, 333], more: 'stuff', aaa: 111, bbb: 222, ccc: {ama: 'zing'}},
  // OR... it can also be a function that recevies what `fetch` receives
  mock?: (uri: string, options: {}, endpointName: string) => ()
}
```

### Set one
```typescript
vzemi.endpoints.set("books", { uri: "/jumbo/books" })
```

### Set multiple
```typescript
zemi.endpoints.setMany({
  endpoint1: { uri: "https://example.com/endpoint1" },
  endpoint2: { uri: "https://example.com/endpoint2", method: "POST" },
})
```
<br>

## Origins
Before a request is being made, vzemi matches an EndPoint's uri to an existing key in `origins`.

This way, we can easily scope different header, credentials, or any other options, to an origin.

### Set one
```typescript
vzemi.origins.set("/", { cache: "force-cache" })
```

### Set multiple
```typescript
zemi.origins.setMany({
  "/": {
    mode: "cors",
    headers: { LEVEL_0_H: "0_hehehe" },
  },
  "http://localhost:1001": {
    mode: "no-cors",
    cache: "force-cache",
    signal: null,
    boo2: "222_shakalaka",
    headers: { auth: "DIESEL_123" },
  },
})
```

## Usage and special props - everything is optional

```typescript
const mai_data = await fff.fetch('employee', {
  // Your props are transformed to either CGI in the URL or body payload
  a: 1,
  b: 2,
  c: 3,
  
  // Special props ARE OPTIONAL

  // When used, its value will replace your regular non-special props
  // which are usually used as your body payload
  $body: {},

  // Merged into a collection's url
  $path: '/aaa/bbb/ccc',

  // Merged with the fetch options object.
  // Will overwrite any matching props provided by
  // the global options and the collection itself
  $options: {...},

  // Merged with headers from the global setup object
  // AND the headers in the collection itself
  $headers: {x: 1, y: 2, z: 3},

  // Causes to transform a non-GET request's body/payload to FormData
  $formData: true,
})
```

## Aborting requests

The simplest way to abort a request is like this

```javascript
const ac = new AbortController()

vzemi.get("someCollection", {
  $options: { signal: ac.signal },
})

ac.abort()
```

## Dispatching global event on **any** fetch, successful and failed

As vzemi is a Proxy, the setter function only accepts one possible key: `emitAlways`
The only acceptable value is `string`
```typescript
vzemi.emitAlways = 'custom-event-name'
```
