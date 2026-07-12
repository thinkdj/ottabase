# @ottabase/shortlinks — agent notes

URL shortlinks on D1: redirect handler with expiry, countdown interstitial, and expired pages. Full docs: ./README.md

## Use when

- Creating/resolving short URLs in a Cloudflare Worker: custom codes, per-app scoping (`appId`), expiry, interstitial countdown, WAE click tracking.
- NOT for general routing or analytics querying — use ottarouter / `@ottabase/analytics` instead.

## Imports

```ts
import { Shortlink, buildRedirectResponse, shortlinksTable } from '@ottabase/shortlinks';
import { renderExpiredShortlinkPage, renderShortlinkInterstitialPage, getShortlinkPageCss, DEFAULT_THEME_STORAGE_KEY } from '@ottabase/shortlinks';
import { ShortlinkTypes, type ShortlinkType, type ShortlinkRecord, type CreateShortlinkRequest, type UpdateShortlinkRequest } from '@ottabase/shortlinks';
```

## Canonical usage

```ts
// Create (fat model; register connection first)
registerConnection('default', createD1Driver(env.OBCF_D1));
const shortlink = await Shortlink.create({
    fullUrl: body.fullUrl,
    shortCode: body.shortCode,
    appId: body.appId || 'default', // type defaults to ShortlinkTypes.REDIRECT
});

// Resolve + redirect (handles expired page, interstitial, 302)
const found = await Shortlink.findByCode(code); // optional { appId }
if (!found) return errorResponse('Not found', 404);
return buildRedirectResponse(found);
```

## Wiring

1. PACKAGE_REGISTRY in `apps/<app>/ottabase/config.migrations.ts`: `shortlinks: { tables: { shortlinksTable }, migrations: [] }`.
2. Add `Shortlink` to `registerModels(...)` in `apps/<app>/worker/lib/db-utils.ts` (gated by `packages.shortlinks`); no app-side model file needed.
3. Re-export `shortlinksTable` from `apps/<app>/ottabase/db/schema.ts` for Drizzle migrations.

## Gotchas

- `drizzle-orm` is a peerDependency (`catalog:`) — the consuming app must provide it.
- `appId` is create-only writable (set server-side for app scoping), not updatable; `expiryDate`/`interstitial*` are cast fields.
- Pages read theme from localStorage key `'ottabase.theme'` (`DEFAULT_THEME_STORAGE_KEY`); override via `themeStorageKey`. Interstitial seconds clamped 1–60 (default 10).
- Click tracking is app-side: WAE binding `OBCF_ANALYTICS_SHORTLINKS` + `trackEvent` from `@ottabase/analytics/track` (see `apps/otta-web/worker/routes/shortlinks.ts`).
