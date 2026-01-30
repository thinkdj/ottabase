# Cloudflare Workers Deployment

Dynamic CI/CD system for deploying apps to Cloudflare Workers with automatic discovery and per-app configuration.

## Quick Start

### Add a New Deployable App

1. Create `cloudflare-config.json` in your app:

    ```json
    {
        "deployable": true,
        "appType": "tanstack"
    }
    ```

2. Push to `main` - auto-deployed!

### Existing Apps

Already configured. Just push to `main`.

## Configuration

### Minimal TanStack (default)

```json
{
    "deployable": true,
    "appType": "tanstack"
}
```

### Minimal Next.js

```json
{
    "deployable": true,
    "appType": "nextjs"
}
```

### Full Configuration

```json
{
    "$schema": "../../schemas/cloudflare-config.schema.json",
    "deployable": true,
    "appType": "nextjs",
    "workerName": "my-app",
    "buildCommand": "build",
    "workerBuildCommand": "build:worker",
    "outputDirectory": ".worker-next",
    "verifyPaths": [".worker-next", ".worker-next/assets"],
    "wranglerConfig": "wrangler.jsonc",
    "requiresSecrets": ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]
}
```

**Schema:** [schemas/cloudflare-config.schema.json](../schemas/cloudflare-config.schema.json)

## Required GitHub Secrets

`Settings → Secrets and variables → Actions`

- `CLOUDFLARE_API_TOKEN` - From Cloudflare dashboard → My Profile → API Tokens
- `CLOUDFLARE_ACCOUNT_ID` - From Cloudflare dashboard → Workers & Pages
- `D1_DATABASE_ID` - (if using D1) From `wrangler d1 create <name>`
- `KV_NAMESPACE_ID` - (if using KV) From `wrangler kv:namespace create <name>`

## Build Flow

### TanStack (Default)

```bash
# Step 1: Vite build
vite build
# → Output: dist/

# Step 2: Deploy to Cloudflare Workers
wrangler deploy --env production
```

### Next.js

```bash
# Step 1: Next.js build
next build
# → Output: .next/

# Step 2: OpenNext Worker build
opennextjs-cloudflare build --skipBuild
# → Converts .next/ to .worker-next/

# Step 3: Deploy to Cloudflare Workers
wrangler deploy --env production
```

## Supported App Types

- `tanstack` - TanStack Router + Vite (default)
- `nextjs` - Next.js + OpenNext
- `react` - React + Vite
- `remix` - Remix
- `vite` - Vite apps
- `custom` - Custom build

## How It Works

### Workflow

1. **Discover** - Auto-detect apps with `cloudflare-config.json`
2. **Build** - Build packages → Build app → Build Worker
3. **Deploy** - Deploy to Cloudflare Workers (NOT Pages)
4. **Verify** - Health check

### Discovery Script

`node .github/scripts/discover-deployable-apps.mjs`

Scans `apps/` for deployable apps and outputs GitHub Actions matrix.

## Error Handling

All errors include:

- What went wrong
- Why it happened
- How to fix it

Example:

```
❌ ERROR: Missing required GitHub secrets

Required: CLOUDFLARE_API_TOKEN

Fix: Settings → Secrets and variables → Actions → New repository secret
Get token: Cloudflare dashboard → My Profile → API Tokens
```

## Local Testing

```bash
# Test discovery
node .github/scripts/discover-deployable-apps.mjs

# Test builds
cd apps/my-app
pnpm build          # App build
pnpm build:worker   # Worker build
pnpm preview        # Test locally
```

## Troubleshooting

**App not discovered?**

- Check `deployable: true` in `cloudflare-config.json`
- Verify build scripts exist in `package.json`

**Build fails?**

- Check GitHub Actions logs
- Test locally: `pnpm --filter=@ottabase/my-app run build`

**Deployment fails?**

- Verify GitHub secrets are set
- Check `wrangler.jsonc` is valid

## Files

```
.github/
├── workflows/deploy.yml       # Main deployment workflow
├── scripts/
│   └── discover-deployable-apps.mjs
└── README.md                  # This file

apps/my-app/
├── cloudflare-config.json     # Deployment config
├── wrangler.jsonc             # Cloudflare config
└── package.json               # Build scripts

schemas/
└── cloudflare-config.schema.json
```

## Details

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete guide.
