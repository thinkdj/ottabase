# Shortlink Management System - Implementation Guide

## Overview

A complete, modular shortlink management system built on Cloudflare infrastructure. This system allows you to create,
manage, and track short URLs that can be deployed across multiple applications in the monorepo.

## Architecture

### 1. Reusable Package (`@ottabase/shortlinks`)

Located in `packages/shortlinks/`, this package provides the core schema and types that can be shared across all apps.

**Exports:**

- `shortlinksTable` - Drizzle ORM schema for D1
- TypeScript types: `Shortlink`, `NewShortlink`, `ShortlinkType`
- Request/Response interfaces for API operations

**Database Schema:**

```typescript
{
  id: UUID (primary key)
  fullUrl: string (destination URL)
  shortCode: string (unique identifier)
  type: "redirect" | "tracking" | "internal" | "external"
  appName: string (multi-tenant support)
  expiryDate: Date | null (optional expiry)
  clicks: number (analytics)
  lastClickedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

### 2. TanStack App Implementation

Located in `apps/ottabase-template-app-tanstack/`, this provides a working reference implementation.

**Components:**

#### Backend (Cloudflare Worker)

- **GET /api/shortlinks** - List all shortlinks (supports filtering by appName and type)
- **POST /api/shortlinks** - Create new shortlink
- **PATCH /api/shortlinks/:id** - Update shortlink
- **DELETE /api/shortlinks/:id** - Delete shortlink
- **GET /:shortCode** - Redirect handler (with click tracking)

#### ORM Model (`ottabase/models/Shortlink.ts`)

Fat model with business logic:

- `findByCode(shortCode)` - Find by short code
- `active()` - Get non-expired links
- `byApp(appName)` - Filter by app
- `byType(type)` - Filter by type
- `isExpired()` - Check expiry
- `trackClick()` - Increment click counter
- `getShortUrl(baseUrl)` - Generate full short URL

#### Frontend UI (`src/pages/shortlinks/`)

- **ShortlinksPage.tsx** - Main management interface with:
    - Statistics dashboard (total links, clicks, active links)
    - Table view with sortable columns
    - Inline editing and deletion
    - Copy-to-clipboard functionality
    - Status badges (expired/active)

- **ShortlinkForm.tsx** - Create/Edit form with:
    - URL validation
    - Custom short code input with random generator
    - Type selector
    - App name configuration
    - Optional expiry date picker

## Features

### Core Functionality

- ✅ Create custom shortlinks with memorable codes
- ✅ Automatic URL validation
- ✅ Click tracking and analytics
- ✅ Optional expiry dates
- ✅ Multi-tenant support (appName field)
- ✅ Type categorization (redirect, tracking, internal, external)

### UI/UX

- ✅ Clean, minimal interface (inspired by modern tools)
- ✅ shadcn/ui components with Tailwind CSS
- ✅ Responsive design
- ✅ Dark mode support
- ✅ Real-time validation
- ✅ One-click copy to clipboard
- ✅ Inline editing
- ✅ Status indicators

### Technical

- ✅ Cloudflare D1 (SQLite) backend
- ✅ Drizzle ORM for type safety
- ✅ TanStack Router integration
- ✅ RESTful API design
- ✅ Error handling with proper status codes
- ✅ Duplicate prevention
- ✅ Modular, reusable architecture

## Usage

### 1. Install the Package

In any app in the monorepo:

```json
{
    "dependencies": {
        "@ottabase/shortlinks": "workspace:*"
    }
}
```

### 2. Add Schema to Your Database

```typescript
// ottabase/db/schema.ts
export { shortlinksTable } from '@ottabase/shortlinks';
```

### 3. Register ORM Model

```typescript
import { Shortlink } from '@ottabase/shortlinks';
import { registerModels } from '@ottabase/ottaorm';

registerModels([Shortlink]);
```

### 4. Add Backend Endpoints

```typescript
// cloudflare-worker.ts
import { Shortlink } from '@ottabase/shortlinks';

// In fetch handler:
// 1. Add CRUD endpoints for /api/shortlinks
// 2. Add redirect handler for /:shortCode
// See implementation for full examples
```

### 5. Add Frontend Route

```typescript
// router.tsx
const shortlinksRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/shortlinks',
    component: lazyRouteComponent(() => import('@/pages/shortlinks/ShortlinksPage')),
});
```

### 6. Push Schema to D1

```bash
cd apps/your-app
pnpm db:push
```

Or use the OttaORM auto-init endpoint:

```
POST /api/ottaorm/init
```

## API Examples

### Create Shortlink

```bash
POST /api/shortlinks
Content-Type: application/json

{
  "fullUrl": "https://github.com/ottabase/ottabase",
  "shortCode": "gh",
  "type": "redirect",
  "appName": "myapp",
  "expiryDate": "2025-12-31T23:59:59Z"  # optional
}
```

### Update Shortlink

```bash
PATCH /api/shortlinks/{id}
Content-Type: application/json

{
  "fullUrl": "https://github.com/ottabase/ottabase-v2",
  "shortCode": "gh2"
}
```

### List Shortlinks

```bash
GET /api/shortlinks
GET /api/shortlinks?appName=myapp
GET /api/shortlinks?type=redirect
```

### Use Shortlink

```bash
GET /gh
# Automatically redirects to full URL and tracks click
```

## Deployment

### Subdomain Setup (Recommended)

Deploy to a subdomain like `go.yourdomain.com`:

1. Configure Cloudflare DNS:

    ```
    CNAME go workers.dev
    ```

2. Update wrangler.jsonc:

    ```jsonc
    {
        "routes": [{ "pattern": "go.yourdomain.com/*", "custom_domain": true }],
    }
    ```

3. Deploy:
    ```bash
    pnpm deploy
    ```

Now your shortlinks work at `go.yourdomain.com/gh`

### Same Domain Deployment

If you want shortlinks on your main domain, ensure the redirect handler runs before static asset serving in your worker.

## Extensibility

### Multi-App Support

The `appName` field enables multiple apps to share the same shortlink database:

```typescript
// App A
await Shortlink.create({
    shortCode: 'github',
    fullUrl: 'https://github.com/org/repo-a',
    appName: 'app-a',
});

// App B
await Shortlink.create({
    shortCode: 'github', // Same code, different app
    fullUrl: 'https://github.com/org/repo-b',
    appName: 'app-b',
});

// Filter by app
const appALinks = await Shortlink.byApp('app-a');
```

### Custom Types

Define your own link types:

```typescript
const CustomTypes = {
    ...ShortlinkTypes,
    CAMPAIGN: 'campaign',
    AFFILIATE: 'affiliate',
    QR_CODE: 'qr-code',
} as const;
```

### Analytics Enhancement

Extend the model to track more metrics:

```typescript
export class ShortlinkWithAnalytics extends Shortlink {
    async getClicksByDay() {
        // Query D1 for daily click stats
    }

    async getClicksByCountry() {
        // Use Cloudflare request data
    }
}
```

## Best Practices

1. **Short Codes**: Use memorable, pronounceable codes (e.g., "gh" for GitHub)
2. **Type System**: Categorize links for easier filtering
3. **Expiry Dates**: Set expiry for temporary campaigns
4. **App Naming**: Use consistent app identifiers across your monorepo
5. **Validation**: Always validate URLs before creating shortlinks
6. **Rate Limiting**: Consider adding rate limits for redirect endpoints
7. **Analytics**: Track clicks to understand link usage

## Migration Path

To migrate existing shortlinks:

1. Export from current system
2. Transform to match schema
3. Bulk insert via API:

```typescript
const links = await fetchExistingLinks();
for (const link of links) {
    await Shortlink.create({
        fullUrl: link.destination,
        shortCode: link.slug,
        type: 'redirect',
        appName: 'migrated',
    });
}
```

## Security Considerations

- ✅ Duplicate short code prevention
- ✅ URL validation to prevent malicious redirects
- ⚠️ Consider adding authentication for management UI
- ⚠️ Add rate limiting for redirect endpoint
- ⚠️ Implement URL allowlist for sensitive applications
- ⚠️ Add audit logging for link creation/deletion

## Performance

- Fast redirects with D1 (sub-10ms latency)
- Edge caching possible with Cloudflare Workers
- Async click tracking (doesn't slow redirects)
- Indexed short_code column for fast lookups

## Future Enhancements

- [ ] QR code generation
- [ ] Link analytics dashboard
- [ ] Bulk import/export
- [ ] Custom domains per link
- [ ] A/B testing redirects
- [ ] Geographic targeting
- [ ] Browser targeting
- [ ] Link preview generation
- [ ] UTM parameter builder
- [ ] API key authentication
- [ ] Webhooks on click events

## Support

For issues or questions, refer to the main monorepo documentation or open an issue on GitHub.
