# @ottabase/ottarouter

The simplest opinionated router for Cloudflare Workers — zero dependencies, order-free precedence, onion middleware,
gated mounts, and null-based fall-through.

Most routers make "whichever route you registered first" part of your app's behavior. ottarouter does not: precedence
lives in the pattern itself, so `/users/search` beats `/users/:id` no matter which file registered it, and two routes
that no request could ever tell apart throw at startup instead of shadowing each other in production. Handlers return a
`Response` or `null` ("not mine — keep matching"), and the router resolves `null` when nothing claims a request, so
composing with shortlink handlers, static assets, or any other fallback is a single `??`. The whole thing is one file,
built on nothing but `Request`, `Response`, and `URL`.

## Features

- **Zero dependencies** — no Node APIs, no framework types; only `Request`, `Response`, and `URL`. ESM and CJS,
  tree-shakeable.
- **Order-free precedence** — static > `:param` > `*`, leftmost segment first; exact method > `ALL`. Move any route to
  any file and outcomes never change.
- **Conflicts fail fast** — two routes with the same shape and overlapping methods throw `RouteConflictError` at
  registration, not at 3 a.m.
- **Null-based fall-through** — handlers return `Response | null`; `handle()` resolves `null` when nothing matched, so
  `await router.handle(...) ?? env.ASSETS.fetch(request)` is the whole integration.
- **Onion middleware** — prefix-scoped, runs once per request even when no route matches; a finalizer is just code after
  `await next()`.
- **Gated mounts** — mount sub-routers under a prefix with a request-time `when` gate; a false gate makes the whole
  subtree invisible and matching continues past it.
- **Typed params** — `c.params` is inferred from the pattern literal (`'/users/:id'` gives `{ id: string }`) at zero
  runtime cost.
- **Workers-first** — `export default router` just works; `withHeaders` never rebuilds a WebSocket upgrade response.

## Installation

```bash
pnpm add @ottabase/ottarouter
```

## Quick Start

### A Standalone Worker

```typescript
import { Router } from '@ottabase/ottarouter';

interface Env {
    TODOS: KVNamespace;
}

const router = new Router<Env>();

router.get('/health', () => Response.json({ ok: true }));

// c.params is typed { id: string }, inferred from the pattern literal.
router.get('/todos/:id', async (c) => {
    const todo = await c.env.TODOS.get(c.params.id, 'json');
    return todo ? Response.json(todo) : null; // null: not mine — keep matching (here: fall to the 404)
});

router.post('/todos/:id', async (c) => {
    await c.env.TODOS.put(c.params.id, JSON.stringify(await c.req.json()));
    return Response.json({ saved: c.params.id });
});

// '*' captures the rest of the path (one or more segments), raw, as c.params['*'].
router.get('/docs/*', (c) => new Response(`you asked for: ${c.params['*']}`));

// A Router instance works directly as the exported handler: fetch() is a pre-bound property
// that answers anything unmatched with Response.json({ code: 'NOT_FOUND' }, { status: 404 }).
export default router;
```

### Composing with Fall-Through

`handle()` is the composable entry point: it resolves the matched `Response`, or `null` when no route claimed the
request — either nothing matched, or every matching handler declined by returning `null`. That makes the router one
stage in a pipeline instead of the owner of your worker:

```typescript
import { router } from './routes';

interface Env {
    ASSETS: Fetcher;
}

export default {
    async fetch(request, env, ctx): Promise<Response> {
        return (await router.handle(request, env, ctx)) ?? (await env.ASSETS.fetch(request));
    },
} satisfies ExportedHandler<Env>;
```

Chain as many fallbacks as you need (`?? shortlinks(request, env) ?? env.ASSETS.fetch(request)`). One mechanism covers
both directions: a handler _declines_ by returning `null` (the request keeps falling), and a handler _blocks_
fall-through by returning a concrete 404 `Response` (nothing below it ever runs).

## The Rules

1. **Routes are order-free.** Precedence lives in the pattern, never in the code layout: static > `:param` > `*`,
   leftmost segment first; exact method > `ALL`. Move any registration to any file — outcomes are identical, or the
   router throws at startup.
2. **A handler returns a `Response` or `null`.** `null` means "not mine — keep matching". There is no third value.
3. **Unmatched is a value.** `handle()` resolves to `null`; compose with `?? fallback ?? assets`. `fetch()` turns `null`
   into a 404 for standalone workers.
4. **One middleware model.** Prefix-scoped onion functions that run once per request — even when no route matches. A
   finalizer is just code after `await next()`. There is no second hook system.
5. **The grammar is closed.** Static, `:param` (one segment), final `*` (the rest, one or more segments). No regex, no
   optional segments, no mid-segment wildcards. Anything fancier is an `if` inside your handler — return `null` to keep
   falling through.
6. **One trailing slash is forgiven** everywhere. Matching sees `c.path` (normalized); the query string lives on
   `c.url`.
7. **`:param` captures are decoded, `*` is raw.** A malformed percent-encoding is a `URIError` routed to `onError` — one
   policy, not three.
8. **Mounts flatten.** One global precedence table across all groups; conflicts throw at mount time. Gates run per
   request; a false gate makes the subtree invisible and matching continues.
9. **One error policy per worker.** Root `onError` only. Handler errors are caught inside the onion, so error responses
   flow through your CORS finalizer. No `onError` registered — the throw is yours.
10. **No magic.** No auto-405, no `Allow` header, no HEAD-to-GET aliasing. Want HEAD? `on(['GET', 'HEAD'], ...)`.

## Pattern Grammar

A pattern is `/`-separated segments. It must start with `/` and must not contain `?` or `#` — registration throws, which
catches `get('/x?y=1')` mistakes early. Query strings never participate in matching; read `c.url.searchParams`.

| Segment                  | Matches                                 | Capture                                  |
| ------------------------ | --------------------------------------- | ---------------------------------------- |
| static                   | the raw path segment, by exact equality | —                                        |
| `:name`                  | exactly one non-empty segment           | `c.params.name`, percent-decoded         |
| `*` (final segment only) | one or more remaining segments          | `c.params['*']`, raw — slashes preserved |

Semantics worth knowing:

- **Static segments are literal**, dots included: `sitemap.xml` is just a segment.
- **Decoding policy.** Matching runs on raw, un-decoded segments, so an encoded `%2F` can never forge a segment
  boundary. `:name` captures are decoded with `decodeURIComponent` after a route is selected; a malformed encoding
  throws `URIError`, which follows the error path (see Error Handling). `*` captures are never decoded. Because decoding
  happens after matching, a decoded `:name` value **can contain a `/`** (e.g. `/files/%2Fetc%2Fpasswd` decodes to
  `/etc/passwd`) — never pass a `:param` into a filesystem path or another router unsanitized.
- **Trailing slash.** Exactly one trailing `/` is stripped before matching (unless the path is `/`), so `/users/42/`
  matches `/users/:id`. All matching uses the normalized `c.path`; `c.url` keeps the original pathname.
- **`*` needs at least one segment.** `/api/auth/*` does not match `/api/auth` — register the bare path separately if
  you want it.
- **Registration throws** on: `*` anywhere but the final segment, an empty `:` name, duplicate param names in one
  pattern, and empty segments (`//`).

## Precedence

The route table is sorted once, into a single total order, on the first request:

1. Compare shapes position by position, left to right. At the first position where the segment kinds differ: **static >
   `:param` > `*`** — that position decides, and nothing to the right matters.
2. Identical shape: the **exact-method** route beats the **`ALL`** route.

Everything else is either disjoint (different static text, non-overlapping methods) or already threw at registration —
so registration order is never observable in matching. The classic footgun is simply gone:

```typescript
router.get('/users/:id', (c) => Response.json({ id: c.params.id }));
router.get('/users/search', handleSearch); // registered after — still wins for GET /users/search
router.get('/users/*', handleTail);

// GET /users/search   -> handleSearch  (static beats :param at segment 2)
// GET /users/42       -> the :id route (:param beats * at segment 2)
// GET /users/42/pets  -> handleTail    (only * matches deeper paths)
```

A route's _shape_ is its segment kinds plus static text — param names do not distinguish shapes. Two routes with the
same shape and overlapping methods could never be told apart by any request, so registration throws `RouteConflictError`
immediately (including collisions produced by `mount`):

```typescript
router.get('/users/:id', byId);
router.get('/users/:slug', bySlug); // throws RouteConflictError at registration
```

The same shape with _different_ methods is legal and useful — an exact method beating `ALL` is how you serve `GET`
explicitly and everything else generically:

```typescript
router.get('/api/things', listThings); // GET
router.all('/api/things', proxyThings); // POST, DELETE, ... — GET never lands here
```

A method mismatch is a **skip, never a 405**: `POST /users/search` sails past the GET-only route and keeps matching —
into a broader `all()` route if one exists, or out of the router as `null`. When in doubt, `router.routes()` prints the
full table in resolved precedence order.

## Middleware

There is exactly one middleware model: prefix-scoped onion functions with the dispatch loop at the center. `next()` runs
everything beneath (inner middleware, then the route table) and resolves `Response | null`:

```typescript
router.use(async (c, next) => {
    const start = Date.now();
    const res = await next();
    console.log(c.method, c.path, res?.status ?? 'no match', `${Date.now() - start}ms`);
    return res; // always propagate — null must survive for fall-through to work
});
```

- `use(mw)` is global. `use(prefix, mw)` scopes by **segment-boundary prefix**: `/api` covers `/api` and `/api/...`,
  never `/apifoo`. Scope prefixes are static segments only — `:` or `*` in a scope throws.
- Middleware runs **once per request**, in registration order, outermost first — and it runs **even when no route
  matches**. That is what makes preflight handling and finalizers possible.
- `next()` may be called at most once; a second call throws.
- `c.params` is `{}` inside middleware — captures only exist inside handlers. Pass values downstream through `c.data`.

The canonical example is CORS: preflight short-circuit and response finalizer in one function. This must be middleware,
not a route — under specificity, an `ALL /api/auth/*` route would outrank an `OPTIONS /api/*` route for
`OPTIONS /api/auth/csrf`, while middleware runs before any route is consulted:

```typescript
import { withHeaders } from '@ottabase/ottarouter';

const cors = (req: Request): Record<string, string> => ({
    'Access-Control-Allow-Origin': req.headers.get('Origin') ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
});

router.use('/api', async (c, next) => {
    if (c.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors(c.req) }); // preflight: short-circuit everything
    }
    const res = await next(); // Response | null from everything beneath
    return res ? withHeaders(res, cors(c.req)) : null; // finalizer: stamp responses, let null keep falling
});
```

`withHeaders` sets headers the Workers-safe way: 101/WebSocket upgrade responses are returned unchanged (rebuilding an
upgrade kills the socket), and immutable-header responses (cache or subrequest results) are cloned via
`new Response(res.body, res)` first. Because handler errors are resolved inside the onion (see Error Handling), your
`onError` responses get stamped by this finalizer too.

**The one footgun to know.** A middleware that swallows `next()`'s result converts every match beneath it into a miss:

```typescript
// WRONG — next() runs, but its Response is dropped. The router treats the request
// as unmatched and it silently falls through to your fallback or the 404.
router.use('/api', async (c, next) => {
    await next();
});

// RIGHT
router.use('/api', async (c, next) => {
    return await next();
});
```

The `Response | null` return type catches most missing returns at compile time; it cannot catch a missing `await` on a
path where you discard the value. Always return what `next()` gave you unless you are deliberately replacing it.

## Sub-Routers and Gates

Split features into modules with `mount`. Mounted routes **flatten** into the parent's single precedence table with the
prefix prepended, so specificity spans the whole tree — a parent's static route still beats a mounted `:param` of the
same shape, which nested dispatchers cannot guarantee. Cross-tree conflicts throw `RouteConflictError` at mount time,
and mounting freezes the sub-router.

```typescript
// blog.ts — a feature module with no ordering to maintain
export const blog = new Router<Env>()
    .get('/posts', listPosts)
    .get('/posts/:slug', (c) => getPost(c, c.params.slug))
    .get('/rss', rssFeed);

// router.ts — the gate is evaluated on every request, so an env-var feature
// flag takes effect immediately: false makes the whole subtree (routes AND its
// middleware) invisible, and matching continues past it.
router.mount('/api/blog', blog, { when: (c) => c.env.BLOG_ENABLED === 'true' });
```

- The mount `prefix` is static segments only, and `/` is legal — use `mount('/', sub, { when })` to gate a group whose
  routes span unrelated prefixes.
- The sub-router's middleware is spliced in at the mount call's position, with the prefix prepended to its scopes, and
  it inherits the mount gate: a gated-off group's middleware does not run either.
- Gates compose by AND across nested mounts, are synchronous by design, and each distinct gate function is evaluated at
  most once per request (memoized).
- A mounted router must not have `onError` or `notFound` set — those belong to the root, and `mount` throws otherwise.

## Error Handling

One error policy per worker, on the root router:

```typescript
router.onError((err, c) => {
    if (err instanceof URIError) {
        return Response.json({ code: 'BAD_REQUEST' }, { status: 400 }); // malformed :param percent-encoding
    }
    console.error('unhandled error on', c.path, err);
    return Response.json({ code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
});
```

The contract:

- **Handler-path errors** — a handler throw, a gate throw, or a `:param` decode `URIError` — are caught at the
  dispatcher and replaced by the `onError` Response, which then **unwinds through the middleware onion**. Your CORS
  finalizer stamps error responses too; no more CORS-less 500s.
- **Middleware errors** are caught at the `handle()` boundary and the `onError` Response is returned directly —
  remaining outer middleware is skipped, since it may be what broke.
- **No `onError` registered:** the error propagates out of `handle()`/`fetch()` untouched — your worker's own try/catch
  owns it.
- **If `onError` itself throws**, that propagates. One safety net, not two.

`notFound(fn)` customizes the 404 that `fetch()` produces when the result is `null` (default:
`Response.json({ code: 'NOT_FOUND' }, { status: 404 })`). It is used by `fetch()` only — `handle()` resolves `null` and
never calls it — and it runs after and outside the onion, so composed apps never see it and the default 404 is
deliberately not finalizer-stamped. Both hooks are root-only.

## API Reference

The entire public surface: one class, one function, one error class, and the supporting types.

### Router

```typescript
export class Router<Env = unknown> {
    // Registration. P is inferred from the pattern literal, so c.params is typed.
    get<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this;
    post<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this;
    put<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this;
    patch<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this;
    delete<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this;
    options<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this;
    head<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this;

    // 'ALL' matches every method and loses to an exact-method route of the same shape.
    all<P extends string>(pattern: P, handler: Handler<Env, PathParams<P>>): this;

    // Any HTTP token method(s) (RFC 9110 tchar; e.g. GET, M-SEARCH), uppercased before comparison.
    // At least one method is required; registering the same method twice in one call throws.
    on<P extends string>(method: string | readonly string[], pattern: P, handler: Handler<Env, PathParams<P>>): this;

    // Middleware: global, or scoped to a static segment-boundary prefix.
    use(mw: Middleware<Env>): this;
    use(prefix: string, mw: Middleware<Env>): this;

    // Mount a sub-router under a static prefix ('/' is legal). Flattens; freezes the sub.
    mount(prefix: string, sub: Router<Env>, opts?: { when?: Gate<Env> }): this;

    // Root-only hooks.
    onError(fn: (err: unknown, c: Ctx<Env>) => Awaitable<Response>): this;
    notFound(fn: (c: Ctx<Env>) => Awaitable<Response>): this;

    // Debug: the full route table in precedence order. Freezes the router.
    routes(): ReadonlyArray<{ method: string; pattern: string }>;

    // Composable entry point: the matched Response, or null when no route claimed the request.
    handle(req: Request, env: Env, ctx?: ExecutionContextLike): Promise<Response | null>;

    // Standalone entry point: handle(), then notFound on null. A pre-bound arrow property,
    // so a Router instance works directly as `export default router`.
    fetch: (req: Request, env: Env, ctx?: ExecutionContextLike) => Promise<Response>;
}
```

The first `handle()`, `fetch()`, or `routes()` call **freezes** the router (the table is sorted once). Registering
routes or middleware, mounting, or setting hooks after that throws — register everything before the first request.

### Types

```typescript
export type Awaitable<T> = T | Promise<T>;

/** Captured path parameters. ':name' values are percent-decoded; '*' is raw. */
export type Params = Record<string, string>;

/** Template-literal param extraction from a route pattern. Type-only, zero runtime. */
export type PathParams<P extends string> = string extends P
    ? Params
    : P extends `${infer A}/${infer B}`
      ? PathParams<A> & PathParams<B>
      : P extends `:${infer N}`
        ? { [K in N]: string }
        : P extends '*'
          ? { '*': string }
          : Record<never, string>;

/**
 * Structural subset of Cloudflare's ExecutionContext, so the package needs no
 * type dependency. The real ExecutionContext satisfies it.
 */
export interface ExecutionContextLike {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
}

/** Per-request context. One object, passed to middleware and handlers. */
export interface Ctx<Env = unknown, P = Params> {
    req: Request; // the original request
    env: Env;
    ctx: ExecutionContextLike; // c.ctx.waitUntil(...); a no-op stub when handle() is called without one
    url: URL; // parsed once, original and un-normalized; the query string lives here
    path: string; // normalized pathname (one trailing slash stripped, unless '/'); all matching uses this
    method: string; // req.method, uppercased
    params: P; // path captures; only meaningful inside a handler, {} in middleware
    data: Record<string, unknown>; // per-request scratch space: middleware writes, handlers read
}

/** A Response means handled — stop. null means "not mine — keep matching". */
export type Handler<Env = unknown, P = Params> = (c: Ctx<Env, P>) => Awaitable<Response | null>;

/** Resolves to the downstream result: a Response, or null when nothing matched. */
export type Next = () => Promise<Response | null>;

export type Middleware<Env = unknown> = (c: Ctx<Env>, next: Next) => Awaitable<Response | null>;

/**
 * Request-time visibility gate for mount(). Returns false to make the mounted
 * subtree invisible for this request (matching continues past it). Synchronous
 * by design; evaluated at most once per request per gate.
 */
export type Gate<Env = unknown> = (c: Ctx<Env>) => boolean;
```

### withHeaders

```typescript
/**
 * Set headers on a response, safely for Workers:
 * - 101 / WebSocket upgrade responses are returned unchanged (never rebuild an upgrade);
 * - immutable headers (cache/subrequest responses) are handled by cloning via new Response(res.body, res);
 * - repeated header names (notably Set-Cookie) keep every value instead of the last one winning;
 * - Vary is merged as unique comma-separated tokens instead of replaced, so stamping CORS's
 *   `Vary: Origin` never erases a Vary the response already had (e.g. Accept-Encoding).
 */
export function withHeaders(res: Response, headers: HeadersInit): Response;
```

### RouteConflictError

```typescript
/** Thrown at registration when two routes have the same shape and overlapping methods. */
export class RouteConflictError extends Error {
    readonly a: string; // e.g. 'GET /users/:id'
    readonly b: string; // e.g. 'GET /users/:slug'
    constructor(a: string, b: string);
}
```

## Tradeoffs

Opinionated means saying no. Here is what you give up, and why it is worth it:

- **You learn a five-line precedence table instead of reading top to bottom.** In exchange, route order stops being a
  thing any human maintains, and `routes()` prints the resolved order whenever you doubt it.
- **No per-route middleware.** Guard a single route by wrapping its handler — plain function composition, zero API:

    ```typescript
    const requireAdmin = (handler: Handler<Env>): Handler<Env> => {
        return (c) => (isAdmin(c) ? handler(c) : Response.json({ code: 'FORBIDDEN' }, { status: 403 }));
    };

    router.get('/admin/users', requireAdmin(listUsers));
    ```

- **No regex, no optional segments, no mid-segment wildcards.** The closed grammar is what makes precedence decidable
  and conflicts detectable at registration. Fancier matching is an `if` inside a handler — return `null` to keep the
  fall-through contract intact.
- **No auto-405, no `Allow` header, no auto-HEAD.** A method mismatch is a skip, because a 405 would block fall-through.
  Need a 405 wall? Register an `all()` sentinel that returns one. Need HEAD? `on(['GET', 'HEAD'], ...)`.
- **Linear scan.** Dispatch is O(n) over the sorted table — microseconds for hundreds of routes in workerd, and the flat
  table stays dumpable and debuggable. Bucketing would be an additive optimization if an app ever registers thousands.
- **Rigidity is the feature.** Freeze on first request, snapshot mounts, conflict throws, one error policy per worker.
  No monkey-patching routes in tests — build a fresh router per test.

## Compatibility

Built for Cloudflare Workers — `Ctx.ctx` mirrors the Workers `ExecutionContext`, and `withHeaders` specifically guards
against rebuilding WebSocket upgrade (`101`) responses, a Workers-specific footgun. Outside of that one detail, the
entire implementation is built on `Request`, `Response`, `URL`, and `Headers` — the Fetch API surface every modern JS
runtime implements — so it also runs unmodified on:

- **Deno** and **Bun**
- **Node.js ≥ 18.2** (native `fetch`/`Request`/`Response`/`Headers` globals; the default 404 uses the static
  `Response.json()`, added in 18.2)
- **Browsers**, for client-side routing over `Request`/`Response` (e.g. inside a Service Worker)

`ctx` is optional on both `handle()` and `fetch()` — call them without a third argument outside Workers and
`c.ctx.waitUntil(...)` becomes a no-op instead of throwing.

## Comparison

|                       | ottarouter                   | itty-router            | hono                         |
| --------------------- | ---------------------------- | ---------------------- | ---------------------------- |
| Dependencies          | Zero                         | Zero                   | Zero (core)                  |
| Precedence            | Order-free (pattern shape)   | Registration order     | Registration order           |
| Conflicting routes    | Throws at registration       | Silent shadowing       | Silent shadowing             |
| Middleware model      | Onion, prefix-scoped         | Composable handlers    | Onion (`next()`)             |
| Fall-through contract | `Response \| null`, explicit | Implicit (`undefined`) | Not a first-class concept    |
| Scope                 | Routing only                 | Routing only           | Full framework (JSX, RPC, …) |

ottarouter is not trying to be a framework — no JSX, no built-in validation, no RPC client generation. If you want
those, reach for hono. If you want the smallest possible surface with routing footguns designed out rather than
documented around, that's what this package is for.

## Development

This package is developed inside the [ottabase](https://github.com/thinkdj/ottabase) monorepo (`packages/ottarouter`).
See [PUBLISHING.md](./PUBLISHING.md) for local development setup, the release checklist, and npm publishing steps.
Issues and pull requests are welcome against that repository.

## License

MIT
