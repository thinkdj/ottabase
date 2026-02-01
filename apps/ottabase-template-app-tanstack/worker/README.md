# Cloudflare Worker Modular Architecture

This directory contains the modular structure for the Cloudflare Worker, breaking down the monolithic
`cloudflare-worker.ts` file into manageable, reusable components.

## Overview

The original `cloudflare-worker.ts` file was 2,485 lines and contained all route handlers, utilities, and business logic
in a single file. This modular architecture improves:

- **Maintainability**: Each handler is in its own file
- **Testability**: Modules can be tested independently
- **Reusability**: Utilities and middleware can be shared
- **Organization**: Clear separation of concerns

## Directory Structure

```
./worker/
├── README.md                     # This file
├── types.ts                      # Shared type definitions
├── utils/                        # Utility functions
│   ├── request.ts               # HTTP request utilities (isHtmlRequest, readJson)
│   ├── rate-limit.ts            # Rate limiting implementation
│   └── db.ts                    # Database initialization & connection management
├── middleware/                   # Request/response middleware
│   └── cors.ts                  # CORS header management & preflight handling
└── handlers/                     # Route handlers
    ├── health.ts                # Health check endpoint
    ├── demo.ts                  # Demo/test API endpoints
    ├── email.ts                 # Email provider configuration & testing
    ├── auth.ts                  # Authentication routes (Auth.js integration)
    ├── cron.ts                  # Scheduled task management
    └── blog.ts                  # Blog CMS (themes/plugins)
```

## Extracted Modules

### Utilities (`./utils/`)

#### `request.ts`

Request parsing and validation utilities:

- `isHtmlRequest(request)` - Determines if request expects HTML
- `readJson<T>(request)` - Safely parses JSON request body

#### `rate-limit.ts`

Rate limiting using Cloudflare KV:

- `simulateRateLimit(env, key)` - Implements sliding window rate limiting

#### `db.ts`

Database connection and model registration:

- `initDbConnection(env)` - Initializes D1 connection and registers all models
- `initAdminCron(env)` - Specialized init for cron endpoints
- `checkMigrationAuth(request, env)` - Validates migration endpoint authorization

### Middleware (`./middleware/`)

#### `cors.ts`

Cross-Origin Resource Sharing support:

- `getCorsHeaders(origin)` - Generates CORS headers
- `handlePreflight(request)` - Handles OPTIONS preflight requests
- `applyCorsHeaders(response, origin)` - Applies CORS headers to response

### Handlers (`./handlers/`)

#### `health.ts`

Health check endpoint (`GET /api/health`):

- Returns service status and timestamp

#### `demo.ts`

Demo/test endpoints:

- `GET /api/demo` - Simple GET request demo
- `POST /api/demo` - Echoes request body
- `DELETE /api/demo` - DELETE request demo
- `GET /api/demo/error` - Error response demonstration

#### `email.ts`

Email provider management:

- `GET /api/email/providers` - Lists available email providers (Resend, SES, Nodemailer)
- `POST /api/email/test` - Sends test emails

#### `auth.ts`

Authentication handlers:

- `GET /api/auth/config` - Returns auth configuration
- `POST /api/auth/register` - User registration with referral attribution
- `* /api/auth/*` - Delegates to Auth.js for all auth routes

#### `cron.ts`

Scheduled task management:

- `GET /api/admin/cron` - Lists all scheduled tasks with stats
- `POST /api/admin/cron` - Creates new scheduled task
- `POST /api/admin/cron/{id}/toggle` - Toggles task active status
- `POST /api/admin/cron/{id}/run` - Manually triggers task
- `DELETE /api/admin/cron/{id}` - Deletes task

#### `blog.ts`

Blog CMS studio management:

- `GET /api/blog/studio/state` - Returns theme and plugin state
- `POST /api/blog/studio/theme/activate` - Activates a theme
- `POST /api/blog/studio/plugin/enable` - Enables/disables a plugin
- `POST /api/blog/studio/plugin/config` - Updates plugin configuration

## Handlers To Be Extracted

The following handlers remain in `cloudflare-worker.ts` and should be extracted in future iterations:

1. **ottaorm.ts** - Generic CRUD operations (`/api/ottaorm/*`)
2. **shortlinks.ts** - URL shortening (`/api/shortlinks/*`, shortlink redirects)
3. **referrals.ts** - Referral tracking system (`/api/referrals/*`)
4. **cloudflare-demos.ts** - Cloudflare services demos (KV, R2, Images, D1, Queues, Rate Limiting, Realtime)
5. **queue.ts** - Queue management & DLQ (`/api/admin/queues/*`)
6. **db-admin.ts** - Database admin tools (`/api/admin/db/*`)
7. **static.ts** - Static asset serving with SPA fallback

## Usage Pattern

### In cloudflare-worker.ts

```typescript
// Import utilities
import { initDbConnection } from './worker/utils/db';
import { handlePreflight } from './worker/middleware/cors';

// Import handlers
import { handleHealthCheck } from './worker/handlers/health';
import { handleAuthConfig } from './worker/handlers/auth';

export default {
    async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
        // Initialize DB first
        initDbConnection(env);

        const url = new URL(request.url);

        // Handle CORS preflight
        const preflightResponse = handlePreflight(request);
        if (preflightResponse) return preflightResponse;

        // Route to handlers
        if (url.pathname === '/api/health') {
            return handleHealthCheck();
        }

        if (url.pathname === '/api/auth/config') {
            return handleAuthConfig(env, origin);
        }

        // ... more routes
    },

    queue: queueHandler,
};
```

### Creating a New Handler

1. Create a new file in `./worker/handlers/`
2. Export handler functions that accept `(request, env, url?)` parameters
3. Import and use in `cloudflare-worker.ts`

Example:

```typescript
// ./worker/handlers/my-feature.ts
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';

export async function handleMyFeature(request: Request, env: CloudflareEnv): Promise<Response> {
    try {
        // Handler logic here
        return jsonResponse({ success: true });
    } catch (error) {
        return errorResponse('Feature failed', 500);
    }
}
```

## Benefits of Modular Structure

### Before (Monolithic)

- Single 2,485-line file
- All logic mixed together
- Difficult to navigate
- Hard to test individual features
- Unclear dependencies

### After (Modular)

- Organized into focused modules
- Each module < 200 lines
- Clear separation of concerns
- Easy to test in isolation
- Explicit dependencies

## Testing

Each module can be tested independently:

```typescript
import { isHtmlRequest } from './worker/utils/request';

describe('request utils', () => {
    it('should detect HTML requests', () => {
        const request = new Request('https://example.com/', {
            headers: { Accept: 'text/html' },
        });
        expect(isHtmlRequest(request)).toBe(true);
    });
});
```

## Next Steps

To complete the modularization:

1. Extract remaining handlers (see "Handlers To Be Extracted" above)
2. Update `cloudflare-worker.ts` to use all extracted handlers
3. Add unit tests for each module
4. Consider extracting route definitions to a separate router file
5. Document handler interfaces and contracts

## File Sizes

- **Original**: `cloudflare-worker.ts` (2,485 lines)
- **After extraction**: Core utilities and handlers (avg ~100 lines each)
- **Total reduction**: Significant reduction in main file complexity

## Contributing

When adding new features:

1. Create handlers in `./worker/handlers/`
2. Extract reusable logic to `./worker/utils/`
3. Add middleware to `./worker/middleware/` if needed
4. Keep modules focused and under 200 lines
5. Document exported functions with JSDoc

## References

- Main worker: `./cloudflare-worker.ts`
- Original backup: `./cloudflare-worker.original.ts`
- Wrangler config: `./wrangler.jsonc`
