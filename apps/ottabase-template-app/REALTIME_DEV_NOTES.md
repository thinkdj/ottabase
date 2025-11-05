# Realtime Demo - Local Development Notes

## Important: Durable Objects in Local Development

The Realtime demo uses Cloudflare Durable Objects which have **limited support in `next dev` mode**.

### Development Options

#### Option 1: Use `wrangler dev` (Recommended for testing Durable Objects)

```bash
cd apps/ottabase-template-app
pnpm preview
# or
wrangler dev
```

This runs the app in Cloudflare's local development environment with full Durable Objects support.

#### Option 2: Use `next dev` (UI development only)

```bash
pnpm dev
```

⚠️ **Note**: The Realtime demo WebSocket connections will NOT work in this mode. You'll see warnings about Durable Objects not being available. This is expected and is a limitation of local Next.js development.

Use this mode for:
- UI/UX development
- Testing other demos (KV, D1, R2, etc.)
- Non-realtime features

### Production Deployment

In production (deployed to Cloudflare), the Realtime demo will work perfectly. The warnings you see in development are normal and expected.

### Testing the Realtime Demo

1. **For full functionality**: Use `wrangler dev`
2. **For UI-only testing**: Use `next dev` (WebSocket connections won't work)
3. **In production**: Everything works

### Why This Happens

Next.js dev server (`next dev`) doesn't fully emulate Cloudflare Workers runtime. Durable Objects require the Workers runtime to function. That's why we need `wrangler dev` for testing features that use Durable Objects.
