# Realtime Demo - Development Guide

## Quick Start

### For UI Development (Fast, but no Realtime WebSockets)

```bash
pnpm dev
```

This runs Next.js dev server. You'll see warnings about Durable Objects - this is expected and harmless. Use this for:

- UI/UX development
- Testing other Cloudflare demos (KV, D1, R2, etc.)
- Non-realtime features

⚠️ **Note**: WebSocket connections in the Realtime demo won't work in this mode.

---

### For Testing Realtime Features (Full functionality)

```bash
pnpm build    # Build the app first (required!)
pnpm preview  # Now run wrangler dev
```

Or in one command:

```bash
pnpm preview  # This now builds first, then runs wrangler dev
```

This runs in Cloudflare's local Workers runtime with full Durable Objects support.

⏱️ **Note**: First build takes ~30-60 seconds. Subsequent builds are faster.

---

## Understanding the Modes

| Mode             | Command        | Realtime Works?  | Hot Reload? | Build Time       |
| ---------------- | -------------- | ---------------- | ----------- | ---------------- |
| **Next.js Dev**  | `pnpm dev`     | ❌ No (warnings) | ✅ Yes      | 0s               |
| **Wrangler Dev** | `pnpm preview` | ✅ Yes           | ⚠️ Partial  | ~30s first build |
| **Production**   | `pnpm deploy`  | ✅ Yes           | N/A         | ~30s             |

---

## Why Two Modes?

**Next.js dev server** (`pnpm dev`):

- Fast hot-reload for UI development
- Doesn't support Cloudflare Durable Objects
- You'll see warnings about `RealtimeActor` - **this is normal**

**Wrangler dev** (`pnpm preview`):

- Full Cloudflare Workers runtime
- Supports Durable Objects (required for Realtime)
- Requires building the app first
- Slower to start but has full functionality

---

## Development Workflow

### 1. Working on UI/styling:

```bash
pnpm dev
```

Fast feedback loop, ignore Durable Objects warnings.

### 2. Testing Realtime functionality:

```bash
pnpm preview
```

Slower to start, but WebSockets and offline queuing work.

### 3. Before committing:

```bash
pnpm build      # Verify it builds
pnpm preview    # Test in Workers runtime
```

---

## Troubleshooting

### Error: "entry-point file at .worker-next\index.mjs was not found"

**Solution**: You need to build first!

```bash
pnpm build
```

The `.worker-next` folder is created during the build process.

### Warnings about Durable Objects in `next dev`

**This is expected!** These warnings appear because:

- Next.js dev server doesn't support Durable Objects
- They're harmless and won't affect other features
- Use `pnpm preview` to test Realtime features

### Build is slow

First build takes ~30-60 seconds. This is normal for OpenNext Cloudflare builds. Subsequent builds are faster due to
caching.

---

## Production Deployment

When you're ready to deploy:

```bash
pnpm deploy
```

This builds the app and deploys to Cloudflare. Everything works perfectly in production.

---

## Summary

- **`pnpm dev`** - Fast development, but Realtime won't work (warnings are OK)
- **`pnpm preview`** - Full Cloudflare runtime, Realtime works perfectly
- **`pnpm deploy`** - Deploy to production

The Realtime demo is fully functional - it just needs the Cloudflare Workers runtime which `wrangler dev` provides!
