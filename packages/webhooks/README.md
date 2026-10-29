# @ottabase/webhooks

Outbound webhooks for Ottabase apps. Customers register HTTPS endpoints, subscribe to events, and receive HMAC-signed
deliveries, with each endpoint's health and a log of every delivery. Free and unlimited: no license, no endpoint cap.

## Try it in otta-web

The package is already listed in `apps/otta-web/ottabase/packages.ts` (`ottabase/packages/webhooks.ts`).

1. Run migrations so the two tables exist: `curl -X POST http://localhost:3004/api/ottaorm/init`
2. Open **Admin → Growth → Webhooks**, add an endpoint, and press _Test_: the outcome shows on the endpoint. Events your
   app dispatches (below) also land in the delivery log.

## Registering it in an app

```typescript
// apps/otta-web/ottabase/packages/webhooks.ts
import { createWebhooksPackage } from '@ottabase/webhooks';

export const webhooksPackage = createWebhooksPackage<CloudflareEnv>({
    // How the HOST authenticates. This package never reads a header to decide tenancy.
    resolveCaller: async (request, env) => {
        const session = await getSession(request, env);
        if (!session?.user) return null;
        return {
            userId: session.user.id,
            organizationId: session.user.organizationId ?? null,
            appId: getOttabaseConfig(env).appId,
            canManage: hasGrantedPermission(session.user.permissions, 'org:admin'),
        };
    },
    // This catalog is descriptive. Only list events your host actually dispatches.
    events: ['ping', 'todo.created'],
    // The app whose delivery log the nightly prune trims (cron has no caller to read it from).
    appId: (env) => getOttabaseConfig(env).appId,
    // Optional; these are the defaults.
    maxEndpoints: 10, // per tenant; one more answers 409 ENDPOINT_LIMIT
    deliveryRetentionDays: 30, // delivery log rows older than this are deleted nightly
});

// ottabase/packages.ts
definePackageList(() => [corePackage, appPackage, /* … */ webhooksPackage]);
```

The manifest contributes tables, models, RLS policies, routes at `/api/webhooks` (mounted by the kernel) and the nav
entry; its admin page is a client descriptor in `src/ottabase/config/packages.ts`.

`/events` is an event catalog, not an event bus. `ping` is emitted by the built-in test route; every product event must
be dispatched from its real, tenant-scoped domain write (as shown below). The template app therefore advertises only
`ping` until its product adds such producers.

**Limits and cleanup.** A tenant may register `maxEndpoints` endpoints (default 10). Every event goes to each subscribed
endpoint in turn, so the cap also bounds what one event costs in outbound requests. Every delivery writes a row to the
log; the seeded `webhooks:prune-deliveries` task (`17 4 * * *`) deletes this app's rows older than
`deliveryRetentionDays` (default 30). Each endpoint's last status lives on the endpoint and is never pruned.

The React hooks go through the app's `OttaQueryProvider` client (`useApiQuery` / `useApiMutation`), so the page needs no
provider of its own.

## Sending events

```typescript
import { dispatchWebhookEvent } from '@ottabase/webhooks';

await dispatchWebhookEvent({
    event: 'todo.created',
    payload: { id: todo.id, title: todo.title },
    tenant: { organizationId, appId, userId }, // userId is required when organizationId is null
});
```

Safe to call unconditionally: a tenant with no subscribed endpoints gets `[]`.

**Delivery is single-attempt and best-effort.** Retries with backoff belong in a queue — a retry loop on the request
path turns one slow customer endpoint into your app's latency. `deliverToEndpoint()` is exported so a `@ottabase/queue`
consumer can own the retry policy.

Personal dispatches without `userId` fail closed rather than widening to every endpoint with a null organization.

## Receiving and verifying

Every request carries:

| Header                 | Value                                        |
| ---------------------- | -------------------------------------------- |
| `X-Ottabase-Signature` | `t=<unix-seconds>,v1=<hex hmac-sha256>`      |
| `X-Ottabase-Event`     | Event name, so you can route without parsing |
| `X-Ottabase-Delivery`  | Delivery id, for idempotent receivers        |

The signature covers `` `${timestamp}.${body}` `` — the timestamp is **inside** the signed string, so a receiver that
enforces a tolerance window actually rejects replays. Verify with the helper rather than re-implementing it:

```typescript
import { verifySignatureHeader } from '@ottabase/webhooks';

const body = await request.text();
const valid = await verifySignatureHeader(mySecret, body, request.headers.get('X-Ottabase-Signature'));
if (!valid) return new Response('bad signature', { status: 401 });
```

The signing secret is returned **exactly once**, in the create response. It is not retrievable afterwards; delete and
recreate the endpoint if it is lost.

## API

All routes are mounted at `/api/webhooks` and resolve the caller first; writes need `canManage`.

| Method   | Path          | Does                                                                |
| -------- | ------------- | ------------------------------------------------------------------- |
| `GET`    | `/events`     | the event catalog                                                   |
| `GET`    | `/`           | the tenant's endpoints                                              |
| `POST`   | `/`           | create one, up to `maxEndpoints`; the only response with the secret |
| `PATCH`  | `/:id`        | edit url, description, events, enabled                              |
| `DELETE` | `/:id`        | remove one                                                          |
| `POST`   | `/:id/test`   | send a signed `ping`                                                |
| `GET`    | `/deliveries` | the tenant's delivery log (`?endpointId=`)                          |

## Security notes

- **HTTPS only**, no credentials in the URL, and literal private/loopback/link-local destinations are refused on write.
- **Redirects are never followed** (`redirect: 'manual'`) — a 3xx into an internal address would re-open SSRF after the
  URL check passed.
- **What this cannot do:** stop a hostname that _resolves_ to a private address. That needs DNS resolution before the
  request, which the Workers runtime does not expose. Deployments with sensitive internal services should route
  deliveries through an egress proxy that enforces the network boundary properly.
- **Delivery errors are summarized, never logged raw** — a fetch error can carry the signed body and the full URL into a
  log sink.
- The signing secret is **not encrypted at rest**. It is a per-endpoint shared secret that must be readable to sign; a
  package needing envelope encryption should follow `@ottabase/ottaai`'s credential store instead.

## Tenant isolation

Organization endpoints are scoped by verified `appId` and `organizationId`. Personal endpoints are scoped by `appId`,
`organizationId: null`, and `userId`; every query must retain all of those scope fields.

## Tailwind

Add to the consuming app's `content` array, or the components render unstyled with no error:

```javascript
'../../packages/webhooks/src/**/*.{js,ts,jsx,tsx}';
```

## Testing

```bash
pnpm --filter @ottabase/webhooks build
pnpm --filter @ottabase/webhooks test
```
