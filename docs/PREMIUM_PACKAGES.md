# Premium Packages

How to install, build, license and operate commercial add-ons in an Ottabase app.

The framework is [`@ottabase/premium`](../packages/premium/README.md); the worked example is
[`@ottabase/premium-webhooks`](../packages/premium-webhooks/README.md).

**An app with no Premium Packages is unaffected.** Leave `PREMIUM_PACKAGES` empty and nothing mounts: no routes, no KV
reads, no nav entries, no tables. Everything below is opt-in.

---

## 1. Installing one (the whole job)

```typescript
// apps/otta-web/ottabase/config.premium.ts
import { createReportsPackage } from '@vendor/reports';

export const PREMIUM_PACKAGES = [createReportsPackage({ resolveCaller })];
```

Then:

```bash
curl -X POST http://localhost:3004/api/ottaorm/init   # creates the package's tables
```

…and paste the license at **Admin → Growth → Premium packages** (or set `PREMIUM_LICENSE_<KEY>`).

The server integration is centralized here: tables, migrations, models, RLS policies and API routes are read from the
manifest. You do **not** touch `config.migrations.ts`, `config.routes.ts`, `db-utils.ts` or `ottabase.config.ts` — those
are for free built-in and custom packages, and a Premium Package deliberately bypasses all four.

### Client adapter

The manifest remains server-only. For a package with rendered admin pages, explicitly register its key and lazy page
loader in `src/ottabase/config/premium.ts`, and add static table exports to `ottabase/db/schema.ts` for drizzle-kit.
`otta-web` scans every `packages/premium*/src` directory for Tailwind, so premium package styles need no separate
configuration. The app's premium-registration test asserts that the server manifest, client adapter, and Drizzle schema
exports stay in sync.

### Uninstalling

Delete the entry from `PREMIUM_PACKAGES`. Routes and nav disappear on the next deploy. **Tables are left alone** —
dropping customer data as a side effect of removing an import is not recoverable. Drop them deliberately, with a
migration that says so.

---

## 2. What a manifest can contribute

| Field                       | Effect                                                                       |
| --------------------------- | ---------------------------------------------------------------------------- |
| `tables` / `migrations`     | Merged into `getEnabledPackageTables()`, so `/api/ottaorm/init` creates them |
| `models`                    | Registered with the ORM at boot (generic CRUD still default-denies them)     |
| `routes`                    | Mounted at `basePath` behind the package's gate                              |
| `nav`                       | Admin navigation entries                                                     |
| `features` / `freeFeatures` | Feature-flag gates, and which of them are free                               |
| `freeLimits`                | Numeric ceilings that apply without a license                                |
| `lifecycle`                 | `onInstall`, `onUpgrade`, `onActivate`, `onDeactivate`, `onUninstall`        |
| `licensePublicKey`          | Vendor key licenses are verified against. **Omit ⇒ the package is free**     |

---

## 3. Licensing

A license is a signed, offline-verifiable token — `obp1.<claims>.<signature>`, ECDSA P-256 over Web Crypto. It is
checked in microseconds, works air-gapped, and cannot be forged without the vendor's private key.

**It also cannot be revoked before it expires.** Revocation is what expiry is for: subscription vendors mint short-dated
tokens and re-issue on renewal.

### Where a customer puts the key

| Source                  | Precedence | Notes                                                |
| ----------------------- | ---------- | ---------------------------------------------------- |
| `PREMIUM_LICENSE_<KEY>` | 1          | Per package, key upper-snake-cased                   |
| `PREMIUM_LICENSES`      | 2          | JSON map `{"webhooks":"obp1…"}` for several packages |
| Admin UI (stored in KV) | 3          | Ignored when an env key exists for that package      |

Env wins deliberately: the key in your infrastructure config must be the key actually in force.

Pasting a malformed, mismatched, expired, or otherwise non-serving key returns a validation error and leaves any
currently working stored key untouched.

`PREMIUM_PKG_<KEY>=false` switches a package off entirely — the kill switch, independent of licensing.

### Scope

Premium licenses are deployment-wide, not per-organisation subscriptions. A SaaS that sells different organisation plans
must use a separate tenant-scoped billing and entitlement system; a package license must not be used as its substitute.

### States

| State        | Serving | What the app does                                           |
| ------------ | ------- | ----------------------------------------------------------- |
| `active`     | yes     | Everything the plan includes                                |
| `grace`      | yes     | Expired, inside `graceDays` — serving, badged as a deadline |
| `expired`    | no      | Paid surface closed; **free tier still works**              |
| `invalid`    | no      | Bad signature, wrong package, or wrong `appId`              |
| `unlicensed` | no      | Registered, no key supplied — free tier applies             |
| `disabled`   | no      | Switched off by config or env                               |

---

## 4. Two ways to gate routes

Set on the manifest's `routes.gate`:

**`'license'` (default)** — the whole namespace requires a serving license. One gate, no way to forget one. Right for a
package with no free tier.

**`'entitlements'`** — routes mount whenever the package is not disabled, and the package guards its own paid paths.
This is what makes a free tier reachable (`1 endpoint free, 25 on Pro`); under `'license'` an unlicensed caller gets 402
for the whole namespace and never reaches the free path. The cost is real: every paid route must call a guard itself,
and a missed call is an unguarded paid route.

```typescript
import { requirePremiumFeature, requirePremiumLimit } from '@ottabase/premium/server';

const denied = await requirePremiumFeature(registry, env, 'reports', 'reports.export');
if (denied) return denied; // 402 { code: 'PREMIUM_REQUIRED', metadata: { package, reason, purchaseUrl } }

// `current` MUST be measured server-side — a client-supplied count raises its own ceiling.
const overLimit = await requirePremiumLimit(registry, env, 'reports', 'reports', await Report.count());
if (overLimit) return overLimit;
```

---

## 5. Gating the UI

```tsx
import { PremiumGate, PremiumProvider, usePremiumFeature } from '@ottabase/premium/react';
import { premiumRequest } from '@/lib/premium';

<PremiumProvider basePath="/api/premium" request={premiumRequest}>
    <PremiumGate packageKey="reports" feature="reports.export">
        <ExportButton />
    </PremiumGate>
</PremiumProvider>;
```

Rules that matter:

- **Client gates fail closed** while loading, on error, and outside the provider. They are a UX affordance; the server
  guard is the boundary.
- **Register a paid page's route unconditionally on INSTALL, never on LICENSE.** A route that disappears when a license
  lapses gives a bookmarked link a 404 and no explanation; render the upsell instead.
- **Pass the app's API client** to `request`. It attaches `X-Org-Id` and `X-App-Id`, which select the tenant the server
  resolves against.
- `otta-web` already scans `packages/premium*/src` for Tailwind classes. Other hosts should adopt the same glob rather
  than adding each Premium Package one at a time.

---

## 6. Operating

`/api/premium/*` (platform-admin for writes, either-scope admin for reads):

| Method   | Path                     | Purpose                 |
| -------- | ------------------------ | ----------------------- |
| `GET`    | `/packages`              | Every package + state   |
| `GET`    | `/packages/:key`         | One package             |
| `POST`   | `/packages/:key/license` | Activate a pasted key   |
| `DELETE` | `/packages/:key/license` | Remove the stored key   |
| `POST`   | `/refresh`               | Drop cached resolutions |

License keys are **never returned** by any of these.

Resolution is cached per isolate for 60s, so activating a key can take up to a minute to reach every isolate. The admin
UI busts its own isolate immediately, and "Re-check licenses" busts the rest on demand.

---

## 7. Building one to sell

```typescript
import { generateLicenseKeypair, issueLicense } from '@ottabase/premium/license-tools';

const { publicKey, privateKey } = await generateLicenseKeypair(); // publicKey → your manifest
```

Keep the private key where release signing material lives — **never in the repo, never in the app, never in an env var
the app can read**. Anyone holding it can mint licenses for your package forever.

Ship your package as a normal workspace/npm package with a `definePremiumPackage()` manifest. See
`packages/premium-webhooks` for a complete one: tables, models, its own routes, HMAC-signed outbound delivery, a free
tier, and a licensed delivery log.

### Design notes worth copying

- **Free tier that survives expiry.** A lapsed license collapses to `freeFeatures`/`freeLimits`, not to nothing. The
  customer keeps their data and their basic path; only the paid surface closes.
- **Undeclared limits are unlimited**, not zero — a package that never declares a ceiling is saying it does not cap.
- **Lifecycle hooks are best-effort and must be idempotent.** A throwing hook is logged and swallowed, because a paid
  add-on's bookkeeping must never take the host app down. Anything that _must_ succeed belongs in a migration.
- **Do not stamp tenancy from request input.** Take `organizationId`/`appId` from the resolved caller; that value is the
  only thing separating two customers' rows.
- **Exact null scopes.** A personal scope is `organizationId: null` plus `userId`; never drop either field from a query.
  Every premium model with tenant data should contribute a fail-closed RLS policy as defense in depth.

---

## See also

- [`packages/premium/README.md`](../packages/premium/README.md) — full API
- [`packages/premium-webhooks/README.md`](../packages/premium-webhooks/README.md) — the worked example
- [`docs/PACKAGE_CREATION_GUIDE.md`](./PACKAGE_CREATION_GUIDE.md) — free packages, for comparison
