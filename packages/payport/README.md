# @ottabase/payport

Provider-agnostic payments + subscriptions + entitlements for Ottabase apps. Ships with a [Polar.sh](https://polar.sh)
adapter out of the box; built to also host Stripe / Paddle / LemonSqueezy.

> **Optional package.** Not every app needs billing — wire it into an app via `customPackages` in `ottabase.config.ts`
> only when you want it.

---

## What you get

- **One API** for checkout, subscriptions, billing portal, entitlements and webhooks.
- **Provider registry** — swap providers without touching app code.
- **Universal event taxonomy** (`payment.subscription.activated`, `payment.checkout.completed`, …) — write listeners
  once, they fire regardless of the upstream provider.
- **Plan catalog** — declare plans + features in code, map them to each provider's product ids.
- **Entitlements** — `payport.entitlements.has(userId, 'feature.x')`.
- **OttaORM models + tables** — local mirror of customers, subscriptions, checkouts, events, plans, products,
  entitlements.
- **Edge-safe** — no Node dependencies; signature verification uses Web Crypto.

---

## Install

It is a workspace package — declared with `workspace:*` in any app that needs it:

```jsonc
{
    "dependencies": {
        "@ottabase/payport": "workspace:*",
    },
}
```

---

## Quickstart

### 1. Register a provider + hydrate the DB-driven plan catalog (worker bootstrap)

Plans live in the `payment_plans` DB table — managed from the admin UI at `/admin/billing`. On first boot you can seed
defaults via `seedPlansIfEmpty(...)`, then load them into the in-memory catalog with `loadPlansFromDb()`. After that,
`/admin/billing` is the source of truth — no code edits required to add or edit plans.

```ts
import { payport, PolarProvider, seedPlansIfEmpty, loadPlansFromDb } from '@ottabase/payport';

payport.registerProvider(
    new PolarProvider({
        accessToken: env.POLAR_ACCESS_TOKEN,
        webhookSecret: env.POLAR_WEBHOOK_SECRET,
        organizationId: env.POLAR_ORG_ID,
    }),
);

// First-run seed (idempotent — only inserts when payment_plans is empty)
await seedPlansIfEmpty([
    {
        slug: 'free',
        name: 'Free',
        features: ['basic.read'],
        priceMonthly: 0,
        priceYearly: 0,
        currency: 'USD',
        isDefault: true,
        provider: 'none',
    },
    {
        slug: 'pro',
        name: 'Pro',
        features: ['basic.read', 'basic.write', 'ai.gpt5'],
        priceMonthly: 1900, // cents
        priceYearly: 19000,
        currency: 'USD',
        provider: 'polar',
        providerProductId: env.POLAR_PRO_PRODUCT_ID,
    },
]);

// Hydrate in-memory catalog from DB (call once per isolate; idempotent via ensurePlansLoaded)
await loadPlansFromDb();
```

> **Default plan = registration hook.** Mark one plan as `isDefault: true`. New users automatically inherit its features
> via `payport.entitlements.has(...)` — no signup-time DB writes, no provider call required. Provider customer records
> are created lazily on first checkout.

### 2. Mount routes (`ottabase/config.routes.ts`)

```ts
import {
    handleCreateCheckout,
    handleGetSubscription,
    handleGetEntitlements,
    handleBillingPortal,
    handleCancelSubscription,
    handleResumeSubscription,
    handleWebhook,
} from '@ottabase/payport/server';

// Inside your custom-route switch:
if (url.pathname === '/api/payport/checkout' && request.method === 'POST') {
    return handleCreateCheckout({ request, userId, appId });
}
if (url.pathname === '/api/payport/subscription' && request.method === 'GET') {
    return handleGetSubscription({ request, userId });
}
if (url.pathname === '/api/payport/entitlements' && request.method === 'GET') {
    return handleGetEntitlements({ request, userId });
}
if (url.pathname === '/api/payport/portal' && request.method === 'POST') {
    return handleBillingPortal({ request, userId });
}
if (url.pathname.startsWith('/api/payport/webhooks/')) {
    const provider = url.pathname.split('/').pop() as 'polar';
    return handleWebhook({ request, provider });
}
```

### 3. Use it in React (`@ottabase/payport/client`)

```tsx
import {
    useEntitlements,
    useCheckout,
    useSubscription,
    useBillingPortal,
    usePublicPlans,
    capturePendingPlanFromUrl,
    readPendingPlan,
    clearPendingPlan,
} from '@ottabase/payport/client';

// Marketing/pricing page — render plans straight from the DB
export function Pricing() {
    const { data } = usePublicPlans();
    return data?.plans.map((p) => (
        <a key={p.slug} href={`/register?plan=${p.slug}&interval=monthly`}>
            {p.name} — ${(p.priceMonthly ?? 0) / 100}/mo
        </a>
    ));
}

// Register page — capture intent on mount, then checkout after auth
export function Register() {
    useEffect(() => {
        capturePendingPlanFromUrl();
    }, []);
    // ...after successful signup:
    const pending = readPendingPlan();
    if (pending) {
        clearPendingPlan();
        // call useCheckout().mutate({ plan: pending.plan, ... })
    }
}

export function PricingButton() {
    const checkout = useCheckout();
    return (
        <button
            onClick={() =>
                checkout.mutate({
                    plan: 'pro',
                    successUrl: `${location.origin}/billing/success`,
                    cancelUrl: `${location.origin}/pricing`,
                })
            }
        >
            Upgrade to Pro
        </button>
    );
}

export function GptFeature() {
    const { hasFeature } = useEntitlements();
    // ...
}
```

> Public plans endpoint: `GET /api/payport/plans` (no auth). Returns active plans where `isPublic = true`, sorted by
> `displayOrder`. Wire it via `handleListPublicPlans` from `@ottabase/payport/server`.

### 4. Guard server logic via entitlements

```ts
import { payport } from '@ottabase/payport';

await payport.entitlements.requireFeature(userId, 'ai.gpt5'); // throws EntitlementError if missing
```

### 5. Listen for normalized events

```ts
import { onSubscriptionActivated, onSubscriptionCancelled } from '@ottabase/payport';

onSubscriptionActivated(async (event) => {
    // grant feature flags, send email, etc.
});
onSubscriptionCancelled(async (event) => {
    // revoke, send win-back, etc.
});
```

---

## App integration (otta-web style)

Payport is **not** in the built-in `packages` list — register it as a custom package:

```ts
// apps/otta-web/ottabase/ottabase.config.ts
import {
    paymentCheckoutsTable,
    paymentCustomersTable,
    paymentEntitlementsTable,
    paymentEventsTable,
    paymentPlansTable,
    paymentProductsTable,
    paymentSubscriptionsTable,
} from '@ottabase/payport/schema';

export const ottabaseConfig = defineOttabaseConfig({
    // ...
    customPackages: {
        payport: {
            tables: {
                paymentCheckoutsTable,
                paymentCustomersTable,
                paymentEntitlementsTable,
                paymentEventsTable,
                paymentPlansTable,
                paymentProductsTable,
                paymentSubscriptionsTable,
                // Advanced (Stage 2 — Meters, Refunds, Discounts, License Keys)
                paymentDiscountsTable,
                paymentMetersTable,
                paymentMeterEventsTable,
                paymentRefundsTable,
                paymentLicenseKeysTable,
                paymentLicenseActivationsTable,
            },
        },
    },
});
```

---

## Advanced features

These are **opt-in** capabilities. Adapters declare which they support via `provider.capabilities`. Calls fall back to a
`ProviderCapabilityError` when the active provider doesn't implement the capability — so app code stays
provider-agnostic.

| Capability                | Polar | Stripe (planned) | Paddle (planned) |
| ------------------------- | :---: | :--------------: | :--------------: |
| `meters`                  |  ✅   |        ✅        |        ✅        |
| `refunds`                 |  ✅   |        ✅        |        ✅        |
| `discounts`               |  ✅   |        ✅        |        ✅        |
| `licenseKeys`             |  ✅   |        ❌        |        ❌        |
| `serverSideSubscriptions` |  ✅   |        ✅        |        ✅        |

### Discounts / coupons

```ts
// Server: create a launch discount
await payport.discounts.create({
    code: 'LAUNCH50',
    name: 'Launch 50% off',
    type: 'percentage',
    amount: 5000, // basis points = 50%
    duration: 'once',
});

// Client: list active discounts on a pricing page
const { data } = useDiscounts();

// Apply to checkout — slug, code or external id all work
await payport.checkout.create({ userId, plan: 'pro', discount: 'LAUNCH50', successUrl, cancelUrl });
```

### Meters — usage-based billing

Record usage events idempotently against a meter. Polar (and other providers) aggregate events into the customer's meter
balance and bill at the end of the period.

```ts
// Server (or worker) — bill 1 token per AI call.
await payport.meters.recordUsage({
    userId: 'u_123',
    meter: 'ai-tokens',
    value: 1,
    externalEventId: `req_${requestId}`, // idempotent — safe to retry
    metadata: { model: 'gpt-4o' },
});

// Client — render current consumption.
const { data } = useCustomerMeter('ai-tokens');
// data.meter?.consumedUnits / creditedUnits / balance
```

The local mirror in `payment_meter_events` deduplicates on `(provider, externalEventId)` so retries never double-bill.

### Refunds

```ts
// Server — refund an order (full or partial).
await payport.refunds.create({
    userId: 'u_123',
    orderId: 'ord_abc',
    amount: 500, // optional; full refund when omitted
    reason: 'requested_by_customer',
});

// Client — show user their refund history.
const { data } = useRefunds();
```

### License keys

For one-time purchases or seat-limited licenses (e.g. desktop apps).

```ts
// Validate from a customer's machine — public endpoint.
const { mutateAsync: validate } = useValidateLicense();
const result = await validate({ key: 'XXXX-YYYY-ZZZZ' });
if (!result.valid) showLicenseError(result.reason);

// First-time activation (records the device).
const { mutateAsync: activate } = useActivateLicense();
await activate({ key, label: 'MacBook Pro 16"' });

// Deactivation (free up a seat).
const { mutateAsync: deactivate } = useDeactivateLicense();
await deactivate({ key, activationId });
```

### Server-side subscription creation

For invoice-driven flows (sales-led plans, custom contracts) — bypass checkout entirely:

```ts
const sub = await payport.subscriptions.create({
    userId,
    plan: 'enterprise',
    discount: 'STARTUP-DEAL',
    metadata: { contract: 'CT-2024-001' },
});
```

### Webhook event coverage

The Polar adapter additionally normalizes:

| Polar event              | Payport event                 |
| ------------------------ | ----------------------------- |
| `discount.created`       | `payment.discount.created`    |
| `discount.updated`       | `payment.discount.updated`    |
| `meter.created`          | `payment.meter.created`       |
| `meter.updated`          | `payment.meter.updated`       |
| `customer.state_changed` | `payment.customer.updated`    |
| `benefit_grant.created`  | `payment.license_key.created` |
| `benefit_grant.cycled`   | `payment.license_key.updated` |
| `benefit_grant.updated`  | `payment.license_key.updated` |
| `benefit_grant.revoked`  | `payment.license_key.revoked` |

Listen as usual:

```ts
on('payment.license_key.revoked', async (e) => {
    await disableUserAccess(e.data);
});
```

Then register the models in `worker/lib/db-utils.ts`:

```ts
import { PAYPORT_MODELS } from '@ottabase/payport/server';
// ...
registerModels([...coreModels, ...appModels, ...PAYPORT_MODELS]);
```

Run `POST /api/ottaorm/init` and the `payment_*` tables are created.

> **Preferred for apps in this monorepo**: rather than wiring tables, models, providers, plans, and routes in four
> separate files, create a single `ottabase/config.payport.ts` SSOT (Single Source of Truth) module per app. See
> [`apps/otta-web/ottabase/config.payport.ts`](../../apps/otta-web/ottabase/config.payport.ts) for the canonical
> pattern: one file exports `PAYPORT_ENABLED`, `PAYPORT_TABLES`, `PAYPORT_MODEL_REGISTRATIONS`, `bootstrapPayport(env)`,
> and `handlePayportRoute(context)`. The three call-sites (`ottabase.config.ts`, `config.routes.ts`, `db-utils.ts`) then
> each become a single import + spread.

---

## Adding a new provider

```ts
import type { PaymentProvider } from '@ottabase/payport';

export class StripeProvider implements PaymentProvider {
    name = 'stripe' as const;
    // implement: createCustomer, getCustomer, listProducts, createCheckout,
    // getSubscription, updateSubscription, cancelSubscription, resumeSubscription,
    // createBillingPortalSession, verifyWebhook, handleWebhook
}

payport.registerProvider(new StripeProvider({ secretKey: env.STRIPE_SECRET }));
```

Make sure `handleWebhook` returns events using the canonical `payment.*` event names — listeners stay provider-agnostic.

---

## Expected environment

```text
POLAR_ACCESS_TOKEN=...
POLAR_WEBHOOK_SECRET=whsec_...
POLAR_ORG_ID=...           # optional, only needed if your token spans multiple orgs
```

Put these in your app's `wrangler.jsonc` vars / secrets (don't commit secrets — use
`wrangler secret put POLAR_WEBHOOK_SECRET`).

---

## Security & Performance notes

### Admin API auth

`handlePayportRoute` (in `config.payport.server.ts`) server-side guards every `/api/payport/admin/*` request via
`requireAdminAccess` before dispatching:

- `GET /api/payport/admin/stats` → requires system admin role (`owner` or `admin`).
- `GET /api/payport/admin/providers` → requires wildcard permission (`*:*`).
- `POST /api/payport/admin/resync-customer` → requires `*:*`.

Client-side route gating (via `ProtectedRoute`) is defence-in-depth only — the API itself enforces auth.

### Entitlements caching

`resolveEntitlements(userId)` is memoized per-userId for 5 seconds (`ENTITLEMENTS_CACHE_TTL_MS`). This collapses
multiple `hasFeature()` calls within the same HTTP handler into a single pair of DB round-trips.

The cache is evicted automatically when a subscription changes (cancel, resume, changePlan, or a webhook updates the
local mirror). You can also evict manually:

```ts
import { clearEntitlementsCache } from '@ottabase/payport';
clearEntitlementsCache(userId); // evict one user
clearEntitlementsCache(); // clear all

// via the facade:
payport.entitlements.clearCache(userId);
```

---

## Tests

```bash
pnpm --filter @ottabase/payport test
```

---

## Admin module (`@ottabase/payport/admin`)

An opt-in subpath that ships a complete super-admin UI for managing every Payport entity. Core (`@ottabase/payport`)
stays UI-free; importing `/admin` pulls in React, lucide-react, `@ottabase/ui-shadcn`, `@ottabase/forms`, and
`@tanstack/react-query` — declared as **optional peer dependencies**.

### What you get

- **Dashboard** (`/admin/billing`) — MRR/ARR, active/trial/cancelled/past-due subs, customer counts, refunds, webhook
  activity in the last 24h, active provider capability matrix, and the most recent 20 webhook events.
- **Providers** (`/admin/billing/providers`, super-admin only) — registered providers, capability matrix, and the
  in-memory plan catalog merged with the DB-backed `PaymentPlan` pricing mirror.
- **13 config-driven CRUD pages** — one per Payport model (plans, products, customers, subscriptions, entitlements,
  checkouts, refunds, discounts, meters, meter events, license keys, license activations, events). Backed by the generic
  `/api/ottaorm/{entity}` endpoint. Read-only views for system-of-record tables (events, checkouts, meter events,
  entitlements, license activations).

### Wiring (3 imports)

```ts
// 1. Nav — append to your app's ADMIN_NAV_GROUPS array.
import { PAYPORT_ADMIN_NAV } from '@ottabase/payport/admin';
export const ADMIN_NAV_GROUPS = [...EXISTING, PAYPORT_ADMIN_NAV];

// 2. Routes — let the package generate them with your router primitive.
//    The factory now receives a lazy getter (() => React.ReactElement) instead of
//    a pre-created element, so payport admin components are NOT bundled until
//    the user visits a billing admin page.
import { createPayportAdminRoutes } from '@ottabase/payport/admin';
const billingRoutes = createPayportAdminRoutes((path, getElement, opts) => {
    const LazyPage = React.lazy(() => Promise.resolve({ default: () => getElement() }));
    return makeAdminRoute(path, <React.Suspense fallback={null}><LazyPage /></React.Suspense>, opts);
});

// 3. Server — admin endpoints are already guarded by requireAdminAccess inside
//    handlePayportRoute (config.payport.server.ts). No extra wiring needed.
//    Endpoint reference:
//   GET  /api/payport/admin/stats           → system admin
//   GET  /api/payport/admin/providers       → super-admin (*:*)
//   POST /api/payport/admin/resync-customer → super-admin (*:*)
```

> The host app's `AdminNavGroup.id` union must include `'billing'`. The package defines its own `PayportAdminNavGroup`
> and relies on structural typing — widen the host union if TypeScript complains.

### Per-entity customization

`PAYPORT_ENTITIES` is just a list of `{ key, config, title, description, ... }` where `config` is a `ModelConfig` from
`@ottabase/forms`. Override anything by shallow-merging into the descriptor before passing it to `<ModelCrud />`.

### User ↔ Customer link

Calling `payport.customer.ensure(user)` now also writes the provider customer id back onto `users.payport_customer_id`
(a nullable column on the core `users` table — added in an auto-migration-safe way). Run `POST /api/ottaorm/init` once
to materialize the column. Use `payport.customer.link(userId, customerId)` to do this manually.
