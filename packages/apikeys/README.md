# @ottabase/apikeys

API keys for the end users of an Ottabase app: hashed at rest, scoped, expiring, revocable, shown once, verified in one
lookup.

Not the operator's provider keys (that is `@ottabase/ottaai`). These are the keys a customer creates to call YOUR API
from their own code, their widget embed, their CI, their metrics exporter. Every product that exposes an API, an ingest
endpoint or an embeddable widget needs them.

## Install

```bash
pnpm add @ottabase/apikeys
```

```typescript
// apps/otta-web/ottabase/packages/apikeys.ts
import { createApiKeys, createApiKeysPackage } from '@ottabase/apikeys';

export const apiKeys = createApiKeys<CloudflareEnv>({
    prefix: 'ok_live_',
    // A rate limit per key, with the app's limiter. Return a Response to refuse.
    afterVerify: (env, key, request) => enforceRateLimit(request, env, `apikey:${key.id}`),
});

export const apiKeysPackage = createApiKeysPackage<CloudflareEnv>({
    keys: apiKeys,
    resolveCaller,
    allowedScopes: ['read', 'write', 'events:ingest'],
});
```

List `apiKeysPackage` in `ottabase/packages.ts`: the `api_keys` table, its model and RLS policy, and the self-service
routes under `/api/keys` are installed.

## Protect a route

```typescript
router.post('/api/ingest', async (c) => {
    const auth = await apiKeys.authenticate(c.req, c.env, { scopes: ['events:ingest'] });
    if (auth instanceof Response) return auth; // 401 (missing, malformed, unknown, revoked, expired) or 403 (scope)
    // auth.subject is { appId, organizationId, userId }: who this key belongs to. Stamp tenancy from it, never from the body.
    return ingest(auth.subject, await c.req.json());
});
```

Keys are read from `Authorization: Bearer <key>` or `X-Api-Key`. A verified key's `lastUsedAt` is written back at most
once a minute.

## Self-service routes

| Method   | Path   | Who       | Does                                                              |
| -------- | ------ | --------- | ----------------------------------------------------------------- |
| `GET`    | `/`    | signed in | Lists the caller's personal keys; `?scope=organization` the org's |
| `POST`   | `/`    | signed in | Issues one; the response carries the plaintext **once**           |
| `DELETE` | `/:id` | signed in | Revokes a personal key, or an organization key for a manager      |

`POST` with `scope: 'organization'` issues an organization-wide key (managers only), whose requests resolve to the
organization with no user.

## Design notes

- **Only the SHA-256 is stored.** The visible head (`ok_live_ab12cd34`) is kept for display; the plaintext exists in the
  response that created it and nowhere else.
- **A recognisable prefix** so a leaked key is caught by secret scanners and obvious in a log.
- **Scopes are the host's vocabulary.** `*` grants everything; pass `allowedScopes` to the router to stop customers
  inventing them.
- **Rate limiting is a hook, not a feature.** `afterVerify` runs after a key verifies, so the app's own limiter (the
  Cloudflare Rate Limiting binding behind `enforceRateLimit`) applies per key.
- At most 25 active keys per subject by default (`maxKeysPerSubject`).
