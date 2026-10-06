# @ottabase/shortlinks

URL shortening system for Cloudflare D1: redirect handling, interstitial pages, expiry, and click analytics.

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
    interstitialSeconds: 10, // countdown duration when interstitial enabled
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

`buildRedirectResponse` checks `expiryDate` and `interstitialEnabled` internally. If you need custom pages:

```typescript
// Expired link page (reads theme from localStorage key 'ottabase.theme')
return renderExpiredShortlinkPage();

// Custom theme key
return renderExpiredShortlinkPage({ themeStorageKey: 'myapp.theme' });

// Interstitial countdown page
return renderShortlinkInterstitialPage({
    url: shortlink.fullUrl,
    seconds: shortlink.interstitialSeconds ?? 10,
    themeStorageKey: 'ottabase.theme',
});
```

The interstitial passes `url` through `sanitizeUrl` (non-`http(s)`/`mailto`/`tel`/`sms` targets become `#`) and escapes
it for HTML and inline script, so a stored `javascript:` target cannot execute.

**Theme detection:** Both page helpers read `localStorage` for `'ottabase.theme'` (or your custom key) to apply
light/dark mode. The value should be `'light'`, `'dark'`, or `'system'`.

## Managing links

The `/shortlinks` page in the app is the everyday surface. Paste a URL and press Shorten: the worker makes a readable
six character code (`generateShortCode`, letters and digits without lookalikes) unless you typed a custom one, and the
short link `https://your.site/<code>` is copied to the clipboard. The list is a data table with search over code and
destination, a clicks column for the last 30 days when Analytics Engine is configured, and a side panel editor for the
destination, code, type, expiry and interstitial. Each row links to the analytics tab filtered to its code.

The admin API behind it:

| Method   | Path                                      | Notes                                                             |
| -------- | ----------------------------------------- | ----------------------------------------------------------------- |
| `GET`    | `/api/shortlinks?page=&per_page=&search=` | Paged list; `search` matches `shortCode` and `fullUrl`            |
| `POST`   | `/api/shortlinks`                         | `fullUrl` required; `shortCode` optional, generated               |
| `PATCH`  | `/api/shortlinks/:id`                     | Any of the writable fields                                        |
| `DELETE` | `/api/shortlinks/:id`                     |                                                                   |
| `GET`    | `/api/shortlinks/analytics`               | `groupBy` of `country`, `shortCode` or `day`; `days`; `shortCode` |

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
| `interstitialSeconds` | Countdown duration (1 to 60)                   |
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
