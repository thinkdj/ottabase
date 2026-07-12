# @ottabase/api — agent notes

Typed fetch client: auth injection, retries, in-flight dedupe, ApiError. Full docs: ./README.md

## Use when

- Frontend/app code making HTTP/JSON calls that need auth tokens, timeouts, transient retries, or standardized ApiError handling.
- NOT for server-side route handlers or building API responses — use errorResponse(...) from @ottabase/utils/http-errors there.

## Imports

```ts
import { createApiClient, api, ApiError, isApiError, getErrorMessage, getErrorMessages, formDataDedupeSignature } from '@ottabase/api';
import type { ApiClientConfig, ApiRequestOptions, ApiRetryOptions, ApiFunction, HttpMethod } from '@ottabase/api';
```

## Canonical usage

```ts
const api = createApiClient({
    baseUrl: '/api',
    getAuthToken: () => localStorage.getItem('token'),
    onUnauthorized: () => redirect('/login'),
});

const user = await api<User>('/users/me');
const posts = await api<Post[]>('/posts', { params: { limit: 10 } });
await api('/posts', { method: 'POST', body: { title: 'Hello' } });
await api('/posts/1', 'DELETE'); // shorthand method syntax
```

```ts
try {
    await api('/posts', { method: 'POST', body, suppressGlobalErrorHandler: true });
} catch (err) {
    if (isApiError(err) && err.isUnauthorized()) { /* ... */ }
    toast(getErrorMessage(err));
}
```

## Gotchas

- Dedupe is ON by default (shared fetch Promise per identical request); pass `dedupe: false` or a distinct `dedupeKey` for intentional parallel identical requests.
- Retries only fire for GET/HEAD/OPTIONS and statuses 502/503/504 by default; opt in via `retry: n` or `ApiRetryOptions` (client or per-request).
- Non-JSON and 204 responses resolve to `undefined` — type as `T | void`.
- Timeout/network failures throw `ApiError` with `status: 0` and code `TIMEOUT` or `NETWORK_ERROR`; default timeout 30000ms.
- Per-request escapes: `skipAuth`, `skipUnauthorizedHandler`, `suppressGlobalErrorHandler`.
- Depends only on @ottabase/utils (workspace:*); edge-safe, no Node-only APIs.
