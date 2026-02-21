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
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

## Example

```typescript
import { drizzle } from 'drizzle-orm/d1';
import { shortlinksTable } from '@ottabase/shortlinks';

// Create a shortlink
await db.insert(shortlinksTable).values({
    fullUrl: 'https://github.com/ottabase',
    shortCode: 'gh',
    type: 'redirect',
    appId: 'myapp',
    interstitialEnabled: true,
});

// Query shortlinks
const link = await db.select().from(shortlinksTable).where(eq(shortlinksTable.shortCode, 'gh')).get();
```

For worker-side redirects, reuse the exported helpers instead of reconstructing the markup:

```ts
import { buildRedirectResponse } from '@ottabase/shortlinks';

const response = buildRedirectResponse(shortlink);
```

## License

MIT
