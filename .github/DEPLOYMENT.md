# Cloudflare Deployment - Complete Reference

Complete reference for the deployment system. See [README.md](README.md) for quick start.

## Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `deployable` | boolean | `true` | Whether to deploy this app |
| `appType` | string | `"tanstack"` | App framework (`tanstack`, `nextjs`, `react`, `remix`, `vite`, `custom`) |
| `workerName` | string | package name | Cloudflare Worker name |
| `buildCommand` | string | `"build"` | pnpm script to build app |
| `workerBuildCommand` | string | `null` | pnpm script to build Worker bundle (null for TanStack) |
| `outputDirectory` | string | `"dist"` | Worker output directory |
| `assetsDirectory` | string | - | Static assets directory |
| `verifyPaths` | string[] | `["dist", "cloudflare-worker.ts"]` | Paths to verify after build |
| `wranglerConfig` | string | `"wrangler.jsonc"` | Wrangler config file path |
| `wranglerEnv` | string | `"production"` | Wrangler environment |
| `healthCheckPath` | string | `"/"` | Path for health check |
| `requiresSecrets` | string[] | See below | Required GitHub secrets |

**Default Secrets:** `["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]`

## Framework Examples

### TanStack (Default)

**package.json:**
```json
{
  "scripts": {
    "build": "vite build"
  }
}
```

**cloudflare-config.json:**
```json
{
  "deployable": true,
  "appType": "tanstack",
  "workerName": "my-tanstack-app",
  "buildCommand": "build",
  "workerBuildCommand": null,
  "outputDirectory": "dist",
  "verifyPaths": ["dist", "cloudflare-worker.ts"],
  "requiresSecrets": ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "D1_DATABASE_ID", "KV_NAMESPACE_ID"]
}
```

### Next.js with OpenNext

**package.json:**
```json
{
  "scripts": {
    "build": "next build",
    "build:worker": "node ./scripts/ensure-opennext-dirs.mjs && opennextjs-cloudflare build --skipBuild"
  }
}
```

**cloudflare-config.json:**
```json
{
  "deployable": true,
  "appType": "nextjs",
  "buildCommand": "build",
  "workerBuildCommand": "build:worker",
  "outputDirectory": ".worker-next",
  "verifyPaths": [".worker-next", ".worker-next/assets"]
}
```

### React/Vite

**package.json:**
```json
{
  "scripts": {
    "build": "vite build"
  }
}
```

**cloudflare-config.json:**
```json
{
  "deployable": true,
  "appType": "vite",
  "outputDirectory": "dist",
  "verifyPaths": ["dist"],
  "workerBuildCommand": ""
}
```

### Remix

**package.json:**
```json
{
  "scripts": {
    "build": "remix build"
  }
}
```

**cloudflare-config.json:**
```json
{
  "deployable": true,
  "appType": "remix",
  "outputDirectory": "build/client",
  "verifyPaths": ["build/client", "build/server"]
}
```

## Discovery Script

**Location:** `.github/scripts/discover-deployable-apps.mjs`

**How it works:**
1. Scans all directories in `apps/`
2. Checks for `package.json`
3. Looks for `cloudflare-config.json`:
   - Found: Uses custom config merged with defaults
   - Not found: Uses defaults if `wrangler.jsonc` exists
4. Verifies required build scripts exist
5. Skips if `deployable: false`
6. Outputs GitHub Actions matrix JSON

**Run locally:**
```bash
node .github/scripts/discover-deployable-apps.mjs
```

**Output format:**
```json
{
  "include": [
    {
      "name": "@ottabase/my-app",
      "folder": "my-app",
      "config": { /* full config */ }
    }
  ]
}
```

## Deployment Workflow Steps

### Job 1: Discover (5 min timeout)
1. Checkout code
2. Setup Node.js
3. Run discovery script
4. Output matrix of deployable apps

### Job 2: Deploy (20 min timeout, per app)
1. **Load Configuration** - Parse app config from matrix
2. **Verify Secrets** - Check all required secrets exist
3. **Setup Environment** - Install pnpm, Node.js, dependencies
4. **Cache** - Restore Turborepo and framework caches
5. **Build Packages** - `pnpm --filter "./packages/**" run build`
6. **Build App** - `pnpm --filter=<app> run <buildCommand>`
7. **Verify App Build** - Check expected outputs exist
8. **Build Worker** - `pnpm run <workerBuildCommand>`
9. **Verify Worker Bundle** - Check all `verifyPaths` exist
10. **Generate Wrangler Config** - Substitute production secrets
11. **Deploy** - `wrangler deploy --env production`
12. **Health Check** - Verify deployment accessible (3 retries)
13. **Summary** - Report status

## Wrangler Configuration

The workflow generates `wrangler.production.jsonc` by substituting placeholders in your `wrangler.jsonc`:

**Source (wrangler.jsonc):**
```jsonc
{
  "d1_databases": [{
    "database_id": "PRODUCTION_D1_DATABASE_ID"
  }],
  "kv_namespaces": [{
    "id": "PRODUCTION_KV_NAMESPACE_ID"
  }]
}
```

**Generated (wrangler.production.jsonc):**
```jsonc
{
  "d1_databases": [{
    "database_id": "abc123..."  // ← From GitHub secret
  }],
  "kv_namespaces": [{
    "id": "xyz789..."  // ← From GitHub secret
  }]
}
```

**Supported placeholders:**
- `PRODUCTION_D1_DATABASE_ID` → `${{ secrets.D1_DATABASE_ID }}`
- `PRODUCTION_KV_NAMESPACE_ID` → `${{ secrets.KV_NAMESPACE_ID }}`

Add more by editing the workflow's "Generate production wrangler config" step.

## Error Messages Reference

### Missing Secrets
```
❌ ERROR: Missing required GitHub secrets for deployment

The following secrets are required but not configured:
  • CLOUDFLARE_API_TOKEN
  • D1_DATABASE_ID

To fix this, add the missing secrets in GitHub repository settings:
  Settings → Secrets and variables → Actions → New repository secret

Required secret locations:
  • CLOUDFLARE_API_TOKEN: Get from Cloudflare dashboard → My Profile → API Tokens
  • CLOUDFLARE_ACCOUNT_ID: Get from Cloudflare dashboard → Workers & Pages → Account ID
  • D1_DATABASE_ID: Run 'wrangler d1 create <name>' to create database
  • KV_NAMESPACE_ID: Run 'wrangler kv:namespace create <name>' to create namespace
```

### Build Failure
```
❌ ERROR: Application build failed

The 'build' command failed for @ottabase/my-app
Check the build output above for specific error messages.
```

### Next.js Build Missing
```
❌ ERROR: Next.js build output not found

Expected directory 'apps/my-app/.next' was not created.
This indicates the Next.js build did not complete successfully.
```

### Worker Build Failure
```
❌ ERROR: Cloudflare Worker build failed

The 'build:worker' command failed.
This command converts the Next.js build to a Cloudflare Worker using OpenNext.
Common issues:
  • Missing @opennextjs/cloudflare package
  • Invalid open-next.config.ts configuration
  • Missing .next directory (Next.js build must run first)
```

### Missing Worker Output
```
❌ ERROR: Required paths not found after Worker build

The following paths were expected but are missing:
  • .worker-next/
  • .worker-next/assets/

For Next.js apps using OpenNext, the expected structure is:
  • .worker-next/ - Main worker output directory
  • .worker-next/assets/ - Static assets directory

This error usually means:
  1. The 'build:worker' command didn't complete successfully
  2. OpenNext configuration (open-next.config.ts) is incorrect
  3. The Next.js build (.next directory) is missing

Current directory contents:
[listing shown]
```

### Wrangler Config Missing
```
❌ ERROR: Wrangler configuration file not found

Expected file: wrangler.jsonc
Current directory: /home/runner/work/ottabase/ottabase/apps/my-app

Wrangler config is required for Cloudflare Workers deployment.
Make sure your app has a wrangler.jsonc file in its root directory.
```

### Secret Substitution Failed
```
❌ ERROR: Secret substitution incomplete

The following placeholders were not replaced:
  PRODUCTION_D1_DATABASE_ID

This usually means the corresponding GitHub secrets are not set.
Check that all required secrets are configured in repository settings.
```

## Deployment Targets

- ✅ **Cloudflare Workers** - Uses `wrangler deploy`
- ❌ **Cloudflare Pages** - NOT supported

Worker deployment indicators:
- Uses `main` entry point in wrangler.jsonc
- Uses Worker bindings (D1, KV, Durable Objects, etc.)
- Deploys to `https://<worker>.<account>.workers.dev`
- NOT `wrangler pages deploy`

## File Structure

```
ottabase/
├── .github/
│   ├── workflows/
│   │   └── deploy.yml                 # Main workflow
│   ├── scripts/
│   │   └── discover-deployable-apps.mjs
│   ├── README.md                      # Quick start
│   └── DEPLOYMENT.md                  # This file
│
├── schemas/
│   └── cloudflare-config.schema.json  # JSON schema
│
└── apps/
    └── my-app/
        ├── cloudflare-config.json     # Deployment config
        ├── wrangler.jsonc             # Cloudflare config
        ├── package.json               # Build scripts
        └── open-next.config.ts        # OpenNext config (Next.js only)
```

## Extending the System

### Add Custom Secrets

**1. Add to app config:**
```json
{
  "requiresSecrets": [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "MY_CUSTOM_SECRET"
  ]
}
```

**2. Update workflow:** Add case in "Verify required secrets" step:
```yaml
"MY_CUSTOM_SECRET")
  if [ -z "${{ secrets.MY_CUSTOM_SECRET }}" ]; then
    MISSING_SECRETS+=("$SECRET_NAME")
  fi
  ;;
```

**3. Use in wrangler config:**
```jsonc
{
  "vars": {
    "MY_VAR": "PRODUCTION_MY_CUSTOM_SECRET"
  }
}
```

**4. Add substitution:**
```yaml
sed -e "s/PRODUCTION_MY_CUSTOM_SECRET/${{ secrets.MY_CUSTOM_SECRET }}/g"
```

### Add New App Type

**1. Create config:**
```json
{
  "appType": "svelte",
  "buildCommand": "build",
  "outputDirectory": "build",
  "verifyPaths": ["build"]
}
```

**2. Add framework-specific caching (optional):**

Edit workflow's cache step to add framework-specific cache paths.

### Disable Deployment Temporarily

```json
{
  "deployable": false,
  "appType": "nextjs"
}
```

App will be skipped during discovery.

## CI/CD Best Practices

1. **Test locally first** - Always test builds locally before pushing
2. **Use the schema** - Let VSCode validate your config
3. **Check the logs** - GitHub Actions logs show detailed error messages
4. **Verify secrets** - Ensure all required secrets are configured
5. **Health checks** - Deployment succeeds even if health check warns (allows propagation time)
6. **Small changes** - Test with small changes before big deployments
7. **Monitor first deploy** - Watch the full workflow run for new apps

## Comparison: Before vs After

| Feature | Before | After |
|---------|--------|-------|
| App discovery | Manual list in workflow | Automatic |
| Configuration | Hardcoded | Per-app with defaults |
| Adding apps | Edit workflow file | Add config file |
| Framework support | Next.js only | Multi-framework |
| Error messages | Generic | Detailed with fixes |
| Deployment target | Workers | Workers (explicit) |
