# @ottabase/shortlinks

URL shortener with fat model for Ottabase apps.

## Quick Start

### 1. Register Model

```typescript
// cloudflare-worker.ts
import { Shortlink } from "@ottabase/shortlinks";
import { registerModels } from "@ottabase/ottaorm";

registerModels([Shortlink]);
```

### 2. Export Table in Schema

```typescript
// ottabase/db/schema.ts
export { shortlinksTable } from "@ottabase/shortlinks";
```

### 3. Run Migrations

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

## Usage

```typescript
import { Shortlink } from "@ottabase/shortlinks";

// Create
const link = await Shortlink.create({
  fullUrl: "https://github.com/ottabase",
  shortCode: "gh",
  type: "redirect",
});

// Find by code
const link = await Shortlink.findByCode("gh");

// Check expiry
if (link.isExpired()) {
  return errorResponse("Link expired", 410);
}

// Track click
await link.trackClick();

// Redirect
return Response.redirect(link.get("fullUrl"), 302);
```

## Redirect Handler

```typescript
// cloudflare-worker.ts
if (!url.pathname.startsWith("/api/") && url.pathname !== "/") {
  const shortCode = url.pathname.substring(1);
  const link = await Shortlink.findByCode(shortCode);

  if (link && !link.isExpired()) {
    link.trackClick(); // Fire and forget
    return Response.redirect(link.get("fullUrl"), 302);
  }
}
```

## Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | text | UUID primary key |
| `fullUrl` | text | Destination URL |
| `shortCode` | text | Unique short identifier |
| `type` | text | redirect, tracking, internal |
| `appId` | text | Multi-app support (nullable) |
| `expiryDate` | timestamp | Optional expiration |
| `clicks` | integer | Click count |
| `lastClickedAt` | timestamp | Last click time |
| `createdAt` | timestamp | Created at |
| `updatedAt` | timestamp | Updated at |

## Link Types

```typescript
import { ShortlinkTypes } from "@ottabase/shortlinks";

ShortlinkTypes.REDIRECT  // "redirect"
ShortlinkTypes.TRACKING  // "tracking"
ShortlinkTypes.INTERNAL  // "internal"
```

## Exports

```typescript
import { Shortlink, shortlinksTable } from "@ottabase/shortlinks";
import { ShortlinkTypes } from "@ottabase/shortlinks";
import type { ShortlinkRecord, NewShortlinkRecord } from "@ottabase/shortlinks";
```
