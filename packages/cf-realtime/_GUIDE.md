# cf-realtime Setup Guide

This guide will help you deploy and use cf-realtime in your application.

## Prerequisites

1. **Cloudflare Account** - Sign up at [cloudflare.com](https://dash.cloudflare.com/sign-up)
2. **Workers Paid Plan** - Required for Durable Objects ($5/month minimum)
3. **Wrangler CLI** - Install globally: `pnpm add -g wrangler`

## Step 1: Create Your Worker Project

```bash
# Create a new directory for your worker
mkdir my-realtime-worker
cd my-realtime-worker

# Initialize npm project
pnpm init

# Install dependencies
pnpm add @ottabase/cf-realtime @cloudflare/actors

# Install dev dependencies
pnpm add -D wrangler @cloudflare/workers-types typescript
```

## Step 2: Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

## Step 3: Create Your Worker

Create `src/worker.ts`:

```typescript
import { RealtimeActor, RealtimeBroadcaster } from "@ottabase/cf-realtime/server";
import { handler } from "@cloudflare/actors";

// Export Actor
export { RealtimeActor };

// Export default handler
export default handler(RealtimeActor);

export interface Env {
  REALTIME: DurableObjectNamespace;
}

// Main worker
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket connection
    if (url.pathname === "/realtime" && request.headers.get("Upgrade") === "websocket") {
      const id = env.REALTIME.idFromName("global");
      const stub = env.REALTIME.get(id);
      return stub.fetch(request);
    }

    // Broadcast API
    if (url.pathname === "/api/broadcast" && request.method === "POST") {
      const broadcaster = new RealtimeBroadcaster(env.REALTIME);
      const body = await request.json();

      const result = await broadcaster.broadcast({
        channels: body.channels,
        event: body.event,
        data: body.data,
        persistForOffline: body.persistForOffline,
      });

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
```

## Step 4: Configure Wrangler

Create `wrangler.toml`:

```toml
name = "my-realtime-worker"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[[durable_objects.bindings]]
name = "REALTIME"
class_name = "RealtimeActor"

[[migrations]]
tag = "v1"
new_classes = ["RealtimeActor"]
```

## Step 5: Login and Deploy

```bash
# Login to Cloudflare
wrangler login

# Deploy to Cloudflare
wrangler deploy
```

You'll get a URL like: `https://my-realtime-worker.your-subdomain.workers.dev`

## Step 6: Use in Your Client Application

Install the client package:

```bash
pnpm add @ottabase/cf-realtime
```

Use in your app:

```typescript
import { RealtimeClient } from "@ottabase/cf-realtime";

const client = new RealtimeClient({
  url: "wss://my-realtime-worker.your-subdomain.workers.dev/realtime",
  debug: true,
});

await client.connect();

// Subscribe to channels
client.subscribe("org-1201", (event, data) => {
  console.log("Received:", event, data);
});
```

## Step 7: Send Messages from Your Backend

In your backend API (Node.js, Next.js API routes, etc.):

```typescript
// Send a broadcast to all subscribers
await fetch("https://my-realtime-worker.your-subdomain.workers.dev/api/broadcast", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    channels: ["org-1201"],
    event: "notification",
    data: { message: "Hello!" },
    persistForOffline: true,
  }),
});
```

## Advanced: Custom Routing

You can extend the worker to add authentication, custom routing, etc.:

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Add authentication
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Validate token
    const isValid = await validateToken(authHeader);
    if (!isValid) {
      return new Response("Forbidden", { status: 403 });
    }

    // Continue with normal routing...
  },
};
```

## Testing Locally

Use Wrangler dev mode:

```bash
wrangler dev
```

This starts a local server at `http://localhost:8787`

Connect your client:

```typescript
const client = new RealtimeClient({
  url: "ws://localhost:8787/realtime",
  debug: true,
});
```

## Monitoring

View logs:

```bash
wrangler tail
```

View metrics in Cloudflare Dashboard:
- Workers & Pages → Your Worker → Metrics

## Cost Estimation

Based on Cloudflare pricing:

- **Free Tier**: 100,000 requests/day (not sufficient for realtime)
- **Paid Plan**: $5/month + usage

Example costs for 1M messages/day:
- Requests: ~$0.15
- Duration: ~$1-5 (depending on connection time)
- **Total**: ~$6-10/month

## Troubleshooting

### "Class not found" error

Make sure you've added the migration in wrangler.toml:

```toml
[[migrations]]
tag = "v1"
new_classes = ["RealtimeActor"]
```

### WebSocket upgrade fails

Check that you're using the correct protocol:
- Production: `wss://` (secure WebSocket)
- Local dev: `ws://` (non-secure)

### Messages not delivered

1. Check that client is subscribed to the channel
2. Verify the channel name matches exactly
3. Check Wrangler logs: `wrangler tail`

## Next Steps

- Add authentication
- Implement presence (who's online)
- Add typing indicators
- Build a chat app
- Create notification system

## Resources

- [Cloudflare Durable Objects Docs](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Actors GitHub](https://github.com/cloudflare/actors)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
