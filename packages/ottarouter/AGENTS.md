# @ottabase/ottarouter — agent notes

Zero-dependency HTTP router for Cloudflare Workers with order-free precedence (static > :param > *), middleware, and sub-router mounts. Full docs: ./README.md

## Use when

- Routing fetch requests in a Worker: typed path params, prefix-scoped middleware, gated `mount()`, null fall-through to assets/other handlers.
- NOT for Node servers, regex/optional-segment patterns, or anything beyond Request/Response routing (edge runtime only).

## Imports

```ts
import { Router, withHeaders, RouteConflictError } from '@ottabase/ottarouter';
import type { Ctx, Handler, Middleware, Next, Gate, Params, PathParams, Awaitable, ExecutionContextLike } from '@ottabase/ottarouter';
```

## Canonical usage

```ts
const router = new Router<Env>();
router.get('/api/users/:id', (c) => Response.json({ id: c.params.id })); // c.params typed from pattern
router.use('/api', async (c, next) => {
    const res = await next(); // Response | null
    return res ? withHeaders(res, { 'x-request-id': crypto.randomUUID() }) : res;
});
router.onError((err, c) => Response.json({ code: 'INTERNAL' }, { status: 500 })); // root only
export default router; // fetch() is pre-bound; null -> notFound (default JSON 404)
```

```ts
const api = new Router<Env>();
api.get('/health', () => Response.json({ ok: true }));
router.mount('/api', api, { when: (c) => c.method !== 'TRACE' }); // gate hides subtree per request

// composable entry: handle() resolves null when unmatched
const res = (await router.handle(req, env, ctx)) ?? (await env.ASSETS.fetch(req));
```

## Gotchas

- Duplicate route shapes with overlapping methods throw `RouteConflictError` at registration/mount time; param names do not distinguish shapes.
- Handlers return `Response | null`; `null` means "keep matching". `handle()` resolves null when nothing matched; `fetch()` turns null into 404.
- No auto-405 and no HEAD-to-GET aliasing — register HEAD explicitly: `on(['GET', 'HEAD'], ...)`.
- `:param` captures are percent-decoded; `*` capture (`c.params['*']`) is raw. Malformed encoding throws URIError into `onError`.
- Router freezes on first request or when mounted — register everything up front. `onError`/`notFound` are root-router only.
- `use()` scopes and `mount()` prefixes must be static segments; middleware runs even when no route matches.
