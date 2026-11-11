# @ottabase/shortlinks

URL shortening system for Cloudflare D1 — redirect handling, interstitial pages, expiry, and click analytics.

## Features

- URL shortening with custom short codes
- Multi-app support via `appId`
- Optional expiry dates
- Interstitial countdown page before redirect
- Standalone theme-aware interstitial UI with a built-in countdown and manual continue actions
- Expired link page
- Click tracking via Cloudflare Analytics Engine (WAE)
- Built on OttaORM for Cloudflare D1

## Installation

```bash
pnpm add @ottabase/shortlinks
```

## Usage

### Schema

Export the table from your app's Drizzle schema:

```typescript
// ottabase/db/schema.ts
export { shortlinksTable } from '@ottabase/shortlinks';
```

### Model

```typescript
import { Shortlink } from '@ottabase/shortlinks';

// Create a shortlink
const link = await Shortlink.create({
    fullUrl: 'https://github.com/ottabase',
    shortCode: 'gh',
    type: 'redirect', // redirect | tracking | internal | external
    interstitialEnabled: false,
    interstitialSeconds: 5, // countdown duration when interstitial enabled
});

// Find by short code
const link = await Shortlink.findByCode('gh');
const link = await Shortlink.findByCode('gh', { appId: 'myapp' });

// List for an app
const links = await Shortlink.forApp('myapp');
```

### Redirect Handler

Use `buildRedirectResponse` in your worker route handler for short code redirects:

```typescript
import {
    Shortlink,
    buildRedirectResponse,
    renderExpiredShortlinkPage,
    renderShortlinkInterstitialPage,
} from '@ottabase/shortlinks';

// In your worker router:
const shortlink = await Shortlink.findByCode(code);

if (!shortlink) {
    return new Response('Not found', { status: 404 });
}

// Handles expiry, interstitial, and direct redirect automatically
return buildRedirectResponse(shortlink);
```

In `otta-web` short codes resolve at `/s/<code>` (GET and HEAD), an ordinary package route, so no other request pays a
lookup. Set the `SHORTLINKS_HOST` var (for example `go.example.com`) to add a redirect-only domain: on that host a bare
`/<code>` resolves and everything else is a 404. Point the domain at the same Worker; the admin page then shows each
link at its short-domain address. A value that names the app's own domain (`AUTH_URL`) is ignored.

A short code is 2 to 50 letters, numbers, dashes or underscores (`SHORT_CODE`). The model refuses anything else on
create and update, so a handler can turn away a path that cannot be a code without a database read:

```typescript
import { SHORT_CODE, renderShortlinkNotFoundPage } from '@ottabase/shortlinks';

if (!SHORT_CODE.test(code)) return renderShortlinkNotFoundPage(); // 404, same look as the expired page
```

`buildRedirectResponse` checks `expiryDate` and `interstitialEnabled` internally. If you need custom pages:

```typescript
// Expired link page (reads theme from localStorage key 'ottabase.theme')
return renderExpiredShortlinkPage();

// Custom theme key
return renderExpiredShortlinkPage({ themeStorageKey: 'myapp.theme' });

// Interstitial countdown page
return renderShortlinkInterstitialPage({
    url: shortlink.fullUrl,
    seconds: shortlink.interstitialSeconds ?? 5,
    themeStorageKey: 'ottabase.theme',
});
```

The interstitial passes `url` through `sanitizeUrl` (non-`http(s)`/`mailto`/`tel`/`sms` targets become `#`) and escapes
it for HTML and inline script, so a stored `javascript:` target cannot execute.

**Theme detection:** Both page helpers read `localStorage` for `'ottabase.theme'` (or your custom key) to apply
light/dark mode. The value should be `'light'`, `'dark'`, or `'system'`.

## Database Schema

`shortlinks` table fields:

| Column                | Description                                    |
| --------------------- | ---------------------------------------------- |
| `id`                  | UUID primary key                               |
| `fullUrl`             | Destination URL                                |
| `shortCode`           | Unique short identifier                        |
| `type`                | `redirect`, `tracking`, `internal`, `external` |
| `appId`               | Nullable app identifier (multi-app support)    |
| `interstitialEnabled` | Show countdown page before redirect            |
| `interstitialSeconds` | Countdown duration (1–60)                      |
| `expiryDate`          | Optional expiry Unix timestamp (ms)            |
| `createdAt`           | Creation timestamp                             |
| `updatedAt`           | Last update timestamp                          |

## Click Analytics

Shortlink clicks are tracked via Cloudflare Analytics Engine. Configure the WAE binding in `wrangler.jsonc`:

```jsonc
"analytics_engine_datasets": [
    { "binding": "OBCF_ANALYTICS_SHORTLINKS", "dataset": "shortlink_clicks" }
]
```

Use `@ottabase/analytics` to write click events, then query via the `/analytics` page in the Vite app.

## License

MIT
