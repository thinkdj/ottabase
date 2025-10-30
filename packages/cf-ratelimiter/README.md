# @ottabase/cf-ratelimiter

Cloudflare Durable Objects-based rate limiter for API protection. Uses atomic counting for precise per-IP daily quotas.

## Features

- ✅ **100 requests/day per IP** (configurable)
- ✅ **Atomic counting** via Cloudflare Durable Objects
- ✅ **Daily reset** at midnight UTC
- ✅ **Authentication bypass** support
- ✅ **Path-based** inclusion/exclusion
- ✅ **Next.js Edge Middleware** ready

## Architecture

**Hybrid approach** combining:
1. **Cloudflare Rate Limiting** (dashboard rule): 10 req/min per IP at network edge
2. **Durable Object** (this package): 100 req/day per IP with atomic storage

## Quick Start

### 1. Install

```bash
pnpm add @ottabase/cf-ratelimiter
```

### 2. Setup Durable Object (wrangler.toml)

```toml
name = "my-app"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[durable_objects.bindings]]
name = "RATE_LIMITER"
class_name = "RateLimitDO"
script_name = "my-app"

[[migrations]]
tag = "v1"
new_classes = ["RateLimitDO"]
```

### 3. Export Durable Object (Worker)

```typescript
// src/index.ts
export { RateLimitDO } from '@ottabase/cf-ratelimiter/durable-object';

export default {
  async fetch(request: Request, env: Env) {
    // Your API logic
    return new Response('Hello!');
  }
};
```

### 4. Use in Next.js Middleware

```typescript
// middleware.ts
import { withRateLimit } from '@ottabase/cf-ratelimiter/middleware';

export default withRateLimit({
  dailyLimit: 100,
  bypassAuthenticated: true,
  excludePaths: ['/api/health', '/_next'],
});

export const config = {
  matcher: '/api/:path*',
};
```

## Configuration

```typescript
interface RateLimitConfig {
  dailyLimit?: number;              // Default: 100
  bypassAuthenticated?: boolean;    // Default: false
  authHeader?: string;              // Default: 'authorization'
  excludePaths?: string[];          // Paths to exclude
  includePaths?: string[];          // Only limit these paths (if set)
}
```

## Custom Middleware Logic

```typescript
import { createRateLimitMiddleware } from '@ottabase/cf-ratelimiter/middleware';

export default createRateLimitMiddleware(
  { dailyLimit: 100 },
  async (request, rateLimitResult) => {
    // Custom logic here
    if (request.nextUrl.pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }
);
```

## Cloudflare Dashboard Setup

1. Go to **Security** → **WAF** → **Rate limiting rules**
2. Create rule:
   - **Match**: `http.request.uri.path matches "^/api/.*"`
   - **Key**: IP address
   - **Threshold**: 10 requests
   - **Window**: 1 minute
   - **Action**: Block with 429

This protects against burst attacks before hitting your Worker.

## Direct API Usage

```typescript
import { checkRateLimit, createRateLimitResponse } from '@ottabase/cf-ratelimiter';

export default {
  async fetch(request: Request, env: Env) {
    const result = await checkRateLimit(request, env, {
      dailyLimit: 100,
    });

    if (!result.allowed) {
      return createRateLimitResponse(result);
    }

    // Your API logic
    return new Response('Success!');
  }
};
```

## API Reference

### `checkRateLimit(request, env, config)`

Check rate limit for a request. Returns `RateLimitResult`.

### `getClientIP(request)`

Extract client IP from Cloudflare headers (`CF-Connecting-IP`).

### `createRateLimitResponse(result)`

Create a 429 response with proper headers and retry-after.

### `createRateLimitHeaders(result)`

Generate `X-RateLimit-*` headers for responses.

## Environment Variables

```bash
# Optional: Override default daily limit
RATE_LIMIT_DAILY=100
```

## Testing Locally

Use Wrangler dev mode:

```bash
wrangler dev
```

Test rate limiting:

```bash
for i in {1..105}; do curl http://localhost:8787/api/test; done
```

## Deployment

```bash
wrangler deploy
```

## License

MIT
