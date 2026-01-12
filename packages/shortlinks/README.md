# @ottabase/shortlinks

A reusable shortlink management system designed for Cloudflare infrastructure.

## Features

- 🔗 URL shortening with custom identifiers
- 🎯 Multi-tenant support via `appName` field
- ⏰ Optional expiry dates
- 📊 Click tracking and analytics
- 🏗️ Built on Drizzle ORM for Cloudflare D1
- 🔄 Reusable across monorepo apps

## Installation

```bash
pnpm add @ottabase/shortlinks
```

## Usage

### Import Schema

```typescript
import { shortlinksTable } from "@ottabase/shortlinks/schema";
```

### Import Types

```typescript
import type { Shortlink, CreateShortlinkRequest } from "@ottabase/shortlinks";
```

## Database Schema

The package exports a `shortlinksTable` Drizzle schema with the following fields:

- `id` - UUID primary key
- `fullUrl` - Destination URL
- `shortCode` - Unique short identifier
- `type` - Link type (redirect, tracking, internal, external)
- `appName` - App identifier for multi-tenant support
- `expiryDate` - Optional expiry timestamp
- `clicks` - Click counter
- `lastClickedAt` - Last click timestamp
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

## Example

```typescript
import { drizzle } from "drizzle-orm/d1";
import { shortlinksTable } from "@ottabase/shortlinks/schema";

// Create a shortlink
await db.insert(shortlinksTable).values({
  fullUrl: "https://github.com/ottabase",
  shortCode: "gh",
  type: "redirect",
  appName: "myapp",
});

// Query shortlinks
const link = await db
  .select()
  .from(shortlinksTable)
  .where(eq(shortlinksTable.shortCode, "gh"))
  .get();
```

## License

MIT
