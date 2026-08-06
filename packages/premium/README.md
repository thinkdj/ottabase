# @ottabase/premium

Premium Packages framework for Ottabase apps. A server manifest declares everything a commercial add-on contributes —
tables, models, routes, nav, entitlements and lifecycle hooks — and the host app wires it in with a single registration,
while rendered pages use the explicit client adapter described below.

**An app with no premium packages is completely unaffected**: no routes, no KV reads, no nav entries, no tables. The
framework is inert until something is sold.

## What it gives you

| Concern            | What you get                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Distribution       | A `definePremiumPackage()` manifest — the whole integration contract in one object                 |
| Licensing          | Offline-verifiable signed tokens (ECDSA P-256 / Web Crypto). No phone-home, no network on the gate |
| Lifecycle          | `onInstall`, `onUpgrade`, `onActivate`, `onDeactivate`, `onUninstall` — best-effort, never fatal   |
| Entitlements       | Feature flags and numeric limits, with a free tier that survives an expired license                |
| Server enforcement | `requirePremium*` guards and gated route mounting that answer **402 Payment Required**             |
| Client UX          | `<PremiumGate>`, `usePremiumFeature`, and a drop-in `<PremiumPackagesManager>` admin surface       |
| Operations         | `/api/premium/*` control plane: status, activate a key, remove a key, re-check                     |

## Install

```bash
pnpm add @ottabase/premium
```

## 1. Declare a package (vendor side)

```typescript
// packages/my-addon/src/manifest.ts
import { definePremiumPackage } from '@ottabase/premium';
import { createReportsRouter } from './routes';
import { reportsTable } from './schema';
import { Report } from './ottaorm-models/Report';

export const reportsPackage = definePremiumPackage({
    key: 'reports',
    name: 'Scheduled Reports',
    version: '1.0.0',
    vendor: 'Acme Add-ons',
    purchaseUrl: 'https://acme.example/pricing',

    // The vendor's PUBLIC key. Licenses are verified against it, offline.
    licensePublicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...',
    graceDays: 14,

    // What a license can unlock, and what an unlicensed install still gets.
    features: ['reports.schedule', 'reports.export'],
    freeFeatures: ['reports.view'],
    freeLimits: { reports: 1 },

    tables: { reportsTable },
    models: [Report],
    routes: { basePath: '/api/reports', build: () => createReportsRouter() },
    nav: [{ title: 'Reports', description: 'Scheduled reports', href: '/admin/reports', icon: 'FileText' }],

    lifecycle: {
        onInstall: async ({ env }) => seedDefaults(env),
        onUpgrade: async ({ previousVersion, version }) => migrateState(previousVersion, version),
        onDeactivate: async ({ reason }) => pauseSchedules(reason),
    },
});
```

## 2. Register its server manifest

```typescript
// apps/otta-web/ottabase/config.premium.ts
import { reportsPackage } from '@acme/reports';

export const PREMIUM_PACKAGES = [reportsPackage];

// Server-side registration only. See the next section for rendered pages.
```

Server contributions — migrations, model registration, RLS policies and gated routes — read from that array.

## 3. Register client pages explicitly

The server manifest is intentionally headless. For an add-on that renders an admin page, add its key and lazy page
import to the app's `src/ottabase/config/premium.ts` and add its schema export to `ottabase/db/schema.ts` for
drizzle-kit. `otta-web` scans every `packages/premium*/src` directory for Tailwind classes, so a Premium Package does
not need its own content-path edit. The app's premium-registration test verifies the server manifest, client adapter,
and Drizzle schema exports stay in sync.

## 4. Mount the routes and the control plane (worker)

```typescript
import { createPremiumAdminRouter, mountPremiumPackages } from '@ottabase/premium/server';

// Each package's routes, each behind its own license gate (402 when unlicensed).
mountPremiumPackages(apiRouter, premium);

// The operator API. Authorization is INJECTED — the framework has no idea what an admin is.
apiRouter.mount(
    '/api/premium',
    createPremiumAdminRouter(premium, {
        requireAdmin: async (c) => {
            const auth = await requireAdminAccess(makeApiRouteContext(c.req, c.env), { scope: 'system' });
            return auth instanceof Response ? auth : null;
        },
    }),
);
```

## 5. Enforce on the server

```typescript
import { requirePremiumFeature, requirePremiumLimit } from '@ottabase/premium/server';

// A paid feature
const denied = await requirePremiumFeature(premium, env, 'reports', 'reports.export');
if (denied) return denied; // 402 with { code, metadata: { package, reason, purchaseUrl } }

// A plan limit — `current` MUST be measured server-side
const overLimit = await requirePremiumLimit(premium, env, 'reports', 'reports', await Report.count());
if (overLimit) return overLimit;
```

## 6. Gate the UI

```tsx
import { PremiumGate, PremiumProvider, usePremiumFeature } from '@ottabase/premium/react';
import { api } from '@/lib/api';

const premiumRequest = async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
    const response = await api<{ data: T } | undefined>(path, { method: init?.method ?? 'GET', body: init?.body });
    return response?.data as T;
};

export function ReportsPage() {
    return (
        <PremiumProvider basePath="/api/premium" request={premiumRequest}>
            <PremiumGate packageKey="reports" title="Scheduled reports">
                <ReportsDashboard />
            </PremiumGate>
        </PremiumProvider>
    );
}

// Or gate one control inside an otherwise-free page:
const exportGate = usePremiumFeature('reports', 'reports.export');
<Button disabled={!exportGate.allowed}>Export</Button>;
```

Pass the app's API client to `request` — it is required and attaches `X-Org-Id` and `X-App-Id`, which select the tenancy
scope the server resolves against. There is no bare-fetch fallback.

**Tailwind:** configure a single `../../packages/premium*/src/**/*.{js,ts,jsx,tsx}` content glob in the consuming app,
so every installed premium package is scanned automatically.

## Client transport

`PremiumProvider` requires the host application's scoped request client. It never uses a bare-fetch fallback, so package
UI shares the app's authorization and tenant-selection path.

## Licenses

A license is a compact signed token: `obp1.<base64url(claims)>.<base64url(signature)>`.

```typescript
// Vendor side only — never imported by a consuming app.
import { generateLicenseKeypair, issueLicense } from '@ottabase/premium/license-tools';

const { publicKey, privateKey } = await generateLicenseKeypair(); // publicKey → the manifest

const token = await issueLicense(
    {
        pkg: 'reports',
        plan: 'pro',
        licensee: 'Customer Inc',
        features: ['reports.schedule', 'reports.export'],
        limits: { reports: 50 },
        appId: 'customer-prod', // optional binding; omit to allow any deployment
    },
    privateKey,
    { expiresInDays: 365 }, // omit for a perpetual license
);
```

### Where a customer puts the key

| Source                  | Precedence | Notes                                                             |
| ----------------------- | ---------- | ----------------------------------------------------------------- |
| `PREMIUM_LICENSE_<KEY>` | 1          | Per package, upper-snake-cased key (`PREMIUM_LICENSE_REPORTS`)    |
| `PREMIUM_LICENSES`      | 2          | JSON map `{"reports":"obp1…"}` for many packages in one variable  |
| Admin UI (stored in KV) | 3          | Pasted at `/admin/growth/premium`; ignored when an env key exists |

Env wins deliberately: the key in your infrastructure config must be the key actually in force.

`PREMIUM_PKG_<KEY>=false` switches a package off entirely, license or not.

### License states

| State        | Serving | Meaning                                                 |
| ------------ | ------- | ------------------------------------------------------- |
| `active`     | yes     | Verified, in date, correctly bound                      |
| `grace`      | yes     | Expired but inside `graceDays` — serving, loudly warned |
| `expired`    | no      | Past expiry + grace. Free tier still applies            |
| `invalid`    | no      | Bad signature, wrong package, or wrong `appId`          |
| `unlicensed` | no      | Registered, no key supplied                             |
| `disabled`   | no      | Switched off by config or env                           |

A package with **no** `licensePublicKey` is free by construction: there is nothing to verify, so it resolves `active`
with no claims. That is the right shape for an in-house add-on distributed inside one organisation.

### What offline verification cannot do

A signed token **cannot be revoked before it expires**. Revocation is what expiry is for: subscription vendors mint
short-dated tokens and re-issue on renewal. A vendor needing instant revocation needs an online check — a different
product decision, not a missing feature here.

### License scope

Licenses are deployment-scoped: one package key and one license state apply to the entire Ottabase deployment. They are
not organisation subscriptions. Products that sell distinct organisation plans need a separate tenant-scoped billing and
entitlement model; do not treat this deployment license as one.

## Entitlement semantics worth knowing

- A **non-serving** license collapses to the free tier, it does not collapse to nothing. A customer whose card expires
  keeps their data and their basic path; only the paid surface closes.
- An **undeclared limit is unlimited**, not zero. A package that never declares `freeLimits.reports` is saying "I do not
  cap reports".
- Gates report the **license-level** reason over the feature-level one: "limit reached" on an expired license is true
  but sends the operator to the wrong page.
- Client gates **fail closed** while loading, on error, and outside the provider. They are a UX affordance; the
  authoritative check is always the server guard.

## Lifecycle hooks

Hooks run at most once per cache window per isolate (not per request), and are **best-effort by contract**: a hook that
throws is logged and swallowed, because a paid add-on's bookkeeping must never take the host app down. Put anything that
must succeed in a migration instead. Hooks must also be idempotent — two isolates can resolve the same package
concurrently, and the framework deliberately takes no distributed lock over a best-effort write.

`onUninstall` is an explicit offboarding hook for a controlled deployment change. It is not available through the
runtime admin API: a package that remains in `PREMIUM_PACKAGES` would simply install again on its next request. Remove
the manifest in a deployment and perform cleanup through an explicit migration; tables are never dropped implicitly.

## Testing

```bash
pnpm --filter @ottabase/premium build
pnpm --filter @ottabase/premium test
```

## See also

- `docs/PREMIUM_PACKAGES.md` — the end-to-end host-integration guide
- `packages/premium-webhooks` — a complete working Premium Package built on this framework
