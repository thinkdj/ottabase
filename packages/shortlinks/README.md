# @ottabase/shortlinks

A reusable shortlink management system designed for Cloudflare infrastructure.

## Features

- 🔗 URL shortening with custom identifiers
- 🎯 Multi-app database sharing via opt-in `appId` column
- ⏰ Optional expiry dates
- 💡 Helpers for expired/interstitial redirects (`renderExpiredShortlinkPage`, `renderShortlinkInterstitialPage`,
  `buildRedirectResponse`)
- 📊 Click tracking and analytics
- 🏗️ Built on Drizzle ORM for Cloudflare D1
- 🔄 Reusable across monorepo apps

## Installation

```bash
pnpm add @ottabase/shortlinks
```

## Usage

### Import Model + Schema

```typescript
import { Shortlink, shortlinksTable } from '@ottabase/shortlinks';
```

### Import Types

```typescript
import type { ShortlinkRecord, CreateShortlinkRequest } from '@ottabase/shortlinks';
```

## Database Schema

The package exports a `shortlinksTable` Drizzle schema with the following fields:

- `id` - UUID primary key
- `fullUrl` - Destination URL
- `shortCode` - Unique short identifier
- `type` - Link type (redirect, tracking, internal, external)
- `appId` - Nullable app identifier (auto-set when `scopeByAppId: true` in config)
- `interstitialEnabled` - Whether to show the interstitial countdown page
- `interstitialSeconds` - Countdown duration (seconds) when interstitial is enabled
- `expiryDate` - Optional expiry timestamp
- `clicks` - Click counter
- `lastClickedAt` - Last click timestamp
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

## OttaORM Model

Import the ready-made Shortlink model:

```typescript
import { Shortlink } from '@ottabase/shortlinks';

// Create shortlink
const link = await Shortlink.create({
    fullUrl: 'https://github.com/ottabase',
    shortCode: 'gh',
    type: 'redirect',
    interstitialEnabled: false,
});

// Find by code
const found = await Shortlink.where('shortCode', '=', 'gh').first();

// List all with pagination
const links = await Shortlink.paginate(1, 20);

// Update
await Shortlink.where('id', '=', link.id).update({ clicks: link.clicks + 1 });

// Delete
await Shortlink.where('shortCode', '=', 'gh').delete();
```

## Examples

### Basic Redirect

```typescript
import { drizzle } from 'drizzle-orm/d1';
import { shortlinksTable, Shortlink } from '@ottabase/shortlinks';

const db = drizzle(d1Database);

// Create a shortlink
const link = await Shortlink.create({
    fullUrl: 'https://github.com/ottabase',
    shortCode: 'gh',
    type: 'redirect',
});
```

### With Interstitial Page

Show a countdown page before redirecting:

```typescript
const link = await Shortlink.create({
    fullUrl: 'https://example.com/long-path',
    shortCode: 'promo',
    type: 'redirect',
    interstitialEnabled: true,
    interstitialSeconds: 5, // 5-second countdown
});
```

### Track Clicks

```typescript
// Increment click counter on each visit
const link = await Shortlink.find(shortlinkId);
await link.increment('clicks');
await link.update({ lastClickedAt: new Date() });
```

### Expiring Links

Create links that expire after a certain date:

```typescript
const expiryDate = new Date();
expiryDate.setDate(expiryDate.getDate() + 30); // Expires in 30 days

const link = await Shortlink.create({
    fullUrl: 'https://example.com/limited-offer',
    shortCode: 'flash-sale',
    type: 'redirect',
    expiryDate,
});

// Check if expired
const isExpired = link.expiryDate && new Date() > link.expiryDate;
```

### Multi-App Isolation

Scope shortlinks to specific apps:

```typescript
// Create in "app1"
const link1 = await Shortlink.create({
    fullUrl: 'https://app1.example.com',
    shortCode: 'home',
    type: 'redirect',
    appId: 'app1',
});

// Create in "app2" with same code (no conflict)
const link2 = await Shortlink.create({
    fullUrl: 'https://app2.example.com',
    shortCode: 'home',
    type: 'redirect',
    appId: 'app2',
});

// Query with app scope
const appLinks = await Shortlink.where('appId', '=', 'app1').get();
```

### Worker Route Handler

```typescript
import { Shortlink, buildRedirectResponse } from '@ottabase/shortlinks';

export async function handleShortlink(env: CloudflareEnv, shortCode: string) {
    const link = await Shortlink.where('shortCode', '=', shortCode).first();

    if (!link) {
        return new Response('Not found', { status: 404 });
    }

    // Check expiry
    if (link.expiryDate && new Date() > link.expiryDate) {
        return renderExpiredShortlinkPage();
    }

    // Track click
    await link.increment('clicks');
    await link.update({ lastClickedAt: new Date() });

    // Build and return redirect
    return buildRedirectResponse(link);
}
```

### Analytics Dashboard

```typescript
// Get top shortlinks by clicks
const topLinks = await Shortlink.orderBy('clicks', 'desc').limit(10).get();

// Get recently created
const recent = await Shortlink.orderBy('createdAt', 'desc').limit(5).get();

// Get click stats for a link
const link = await Shortlink.find(id);
const totalClicks = link.clicks;
const lastClicked = link.lastClickedAt;
```

### Search Shortlinks

```typescript
// Search by URL or code
const results = await db
    .select()
    .from(shortlinksTable)
    .where(or(like(shortlinksTable.fullUrl, `%${query}%`), like(shortlinksTable.shortCode, `%${query}%`)))
    .limit(10);
```

## API Helpers

### buildRedirectResponse

Build an optimized redirect response for Cloudflare Workers:

```typescript
import { buildRedirectResponse, renderShortlinkInterstitialPage } from '@ottabase/shortlinks';

if (link.interstitialEnabled) {
    return renderShortlinkInterstitialPage(link);
} else {
    return buildRedirectResponse(link);
}
```

### renderExpiredShortlinkPage

Render a page for expired shortlinks:

```typescript
import { renderExpiredShortlinkPage } from '@ottabase/shortlinks';

if (link.expiryDate && new Date() > link.expiryDate) {
    return renderExpiredShortlinkPage();
}
```

## Link Types

The `type` field supports different link categories:

- `redirect` - Standard redirect
- `tracking` - Tracking pixel or conversion tracking
- `internal` - Internal app link
- `external` - External URL shortening

## Performance Notes

- **Indexed Queries** - `shortCode` and `appId` are indexed for fast lookups
- **Click Tracking** - Efficient increment operations without full record reload
- **Pagination** - Handle large datasets efficiently

## License

MIT
