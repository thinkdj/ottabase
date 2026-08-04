# @ottabase/premium-webhooks

Outbound webhooks for Ottabase apps — and the **worked example** of a paid package built on
[`@ottabase/premium`](../premium/README.md).

Customers register HTTPS endpoints, subscribe to events, and receive HMAC-signed deliveries. The package ships a
genuinely usable free tier and sells the parts that cost money to run.

| Tier               | Endpoints | Signed delivery | Endpoint health | Delivery history |
| ------------------ | --------- | --------------- | --------------- | ---------------- |
| No license         | 1         | ✅              | ✅              | ❌               |
| Demo "pro" license | 25        | ✅              | ✅              | ✅               |

That split is the point of the example: it exercises a **limit** gate, a **feature** gate, and a free tier that stays
reachable when the license lapses.

## Try it in otta-web

The package is already registered in `apps/otta-web/ottabase/config.premium.ts`.

1. Run migrations so the two tables exist: `curl -X POST http://localhost:3004/api/ottaorm/init`
2. Open **Admin → Growth → Webhooks**. With no license you can add **one** endpoint; the second attempt is refused with
   402 and the UI says why.
3. Open **Admin → Growth → Premium packages**, paste the demo license below, and press _Activate_.
4. Back on the webhooks page: the ceiling is now 25 and the delivery log has replaced its upsell.

```text
obp1.eyJpZCI6ImxpY19kZW1vX3Byb18wMDAxIiwicGtnIjoid2ViaG9va3MiLCJwbGFuIjoicHJvIiwibGljZW5zZWUiOiJPdHRhYmFzZSBEZW1vIiwiZmVhdHVyZXMiOlsiZGVsaXZlcmllcy5sb2ciLCJjdXN0b20taGVhZGVycyJdLCJsaW1pdHMiOnsiZW5kcG9pbnRzIjoyNX0sImlhdCI6MTczNTY4OTYwMH0.yNy_XM1hjiwMCqOQUwC4INMt6FZ19jObyESanPU_C5hPv6cQhl0FbXwIXCvfn-smOz2ziqFIi784Mp4ErZ68mg
```

Or set it per deploy, which takes precedence over anything pasted in the UI:

```bash
PREMIUM_LICENSE_WEBHOOKS=obp1.…
```

## Licensing

**The demo keypair in `src/demo-license.ts` is published on purpose — including the private key.** Anyone can mint a
license for `webhooks`; that is what makes the flow above try-able without buying anything.

A real vendor generates its own keypair, puts only the **public** key in the manifest, and keeps the private key
wherever release signing material lives:

```typescript
import { generateLicenseKeypair, issueLicense } from '@ottabase/premium/license-tools';

const { publicKey, privateKey } = await generateLicenseKeypair();

const token = await issueLicense(
    {
        pkg: 'webhooks',
        plan: 'pro',
        licensee: 'Customer Inc',
        features: ['deliveries.log'],
        limits: { endpoints: 25 },
    },
    privateKey,
    { expiresInDays: 365 },
);
```

## Registering it in an app

```typescript
// apps/otta-web/ottabase/config.premium.ts
import { createWebhooksPackage } from '@ottabase/premium-webhooks';

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
    events: ['*', 'todo.created', 'todo.completed', 'user.registered'],
});

export const PREMIUM_PACKAGES = [webhooksPackage];
```

That is the whole integration — tables, models, routes at `/api/webhooks`, nav entry and gates all come from the
manifest.

## Sending events

```typescript
import { dispatchWebhookEvent } from '@ottabase/premium-webhooks';

await dispatchWebhookEvent({
    registry: premium,
    env,
    event: 'todo.created',
    payload: { id: todo.id, title: todo.title },
    tenant: { organizationId, appId },
});
```

Safe to call unconditionally: an unlicensed or disabled package delivers nothing and returns `[]`, so host code never
has to ask whether the add-on is installed.

**Delivery is single-attempt and best-effort.** Retries with backoff belong in a queue — a retry loop on the request
path turns one slow customer endpoint into your app's latency. `deliverToEndpoint()` is exported so a `@ottabase/queue`
consumer can own the retry policy.

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
import { verifySignatureHeader } from '@ottabase/premium-webhooks';

const body = await request.text();
const valid = await verifySignatureHeader(mySecret, body, request.headers.get('X-Ottabase-Signature'));
if (!valid) return new Response('bad signature', { status: 401 });
```

The signing secret is returned **exactly once**, in the create response. It is not retrievable afterwards; delete and
recreate the endpoint if it is lost.

## API

All routes are mounted at `/api/webhooks` with `gate: 'entitlements'` — the namespace stays reachable so the free tier
works, and each paid path guards itself.

| Method   | Path          | Gate                     |
| -------- | ------------- | ------------------------ |
| `GET`    | `/events`     | free                     |
| `GET`    | `/`           | free                     |
| `POST`   | `/`           | limit `endpoints`        |
| `PATCH`  | `/:id`        | free                     |
| `DELETE` | `/:id`        | free                     |
| `POST`   | `/:id/test`   | free                     |
| `GET`    | `/deliveries` | feature `deliveries.log` |

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

## Tailwind

Add to the consuming app's `content` array, or the components render unstyled with no error:

```javascript
'../../packages/premium-webhooks/src/**/*.{js,ts,jsx,tsx}';
```

## Testing

```bash
pnpm test --filter=@ottabase/premium-webhooks
```
