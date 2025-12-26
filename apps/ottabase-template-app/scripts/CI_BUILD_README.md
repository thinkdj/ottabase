# CI Build Solution for Google Fonts

## Problem
Next.js 16 with Turbopack tries to fetch Google Fonts during the build process. In CI environments or sandboxed environments without internet access to `fonts.googleapis.com`, this causes build failures.

## Solution
We've implemented a CI-aware build system that automatically detects CI environments and temporarily replaces Google Font imports with system fonts during the build.

### How It Works

1. **Build Wrapper** (`scripts/ci-build-wrapper.mjs`):
   - Detects CI environment via `process.env.CI` or `process.env.GITHUB_ACTIONS`
   - Automatically routes to `build:ci` in CI or `build:prod` locally

2. **CI Build Script** (`scripts/ci-build.js`):
   - `replace` command: Creates a backup and replaces `ProviderFont.tsx` with a system font version
   - `restore` command: Restores the original Google Fonts version after build

3. **Package Scripts**:
   - `build`: Auto-detects environment and runs appropriate build
   - `build:ci`: Replaces fonts → builds → restores fonts
   - `build:prod`: Standard Next.js build with Google Fonts

### Usage

```bash
# Automatically uses CI build in CI environments
pnpm build

# Force CI build (useful for testing)
CI=true pnpm build

# Force production build with Google Fonts
pnpm build:prod

# Build Cloudflare worker (after successful build)
pnpm build:worker
```

### Why This Approach?

We tried several alternatives:
- ❌ `skipFontOptimization` in next.config.js - not a valid option
- ❌ Webpack/Turbopack module aliasing - processed too late
- ❌ Conditional imports - Next.js font loader runs at import time
- ✅ **Pre-build file replacement** - works reliably

### For Developers

When developing locally with internet access, Google Fonts will load normally. The CI build system only activates when:
- `CI=true` environment variable is set
- `GITHUB_ACTIONS=true` environment variable is set

The backup file (`ProviderFont.tsx.backup`) is automatically cleaned up and is gitignored to prevent accidental commits.
