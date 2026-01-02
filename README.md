# Ottabase Monorepo

Modern full-stack monorepo with pnpm workspaces and Turborepo for building production-ready applications with Cloudflare Workers deployment.

## 🏗️ Structure

```text
ottabase/
├── apps/                              # Applications
│   ├── ottabase-template-app-tanstack/ # TanStack Router + Vite (recommended)
│   └── ottabase-template-app/          # Next.js 15 + App Router (alternative)
├── packages/                          # Shared packages
│   ├── db/                            # Database layer (Drizzle, Prisma)
│   ├── ottaorm/                       # Type-safe ORM for D1/SQLite
│   ├── cf/                            # Cloudflare bindings (D1, KV, R2, Queues)
│   ├── auth/                          # Auth.js integration
│   ├── ui-*/                          # UI packages (Mantine, shadcn, components)
│   ├── state/                         # Global state management (Jotai)
│   └── utils/                         # Utility functions
├── turbo.json                         # Turborepo configuration
├── pnpm-workspace.yaml                # pnpm workspace configuration
└── package.json                       # Root package.json
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `>=24.0.0` (LTS)
- **pnpm**: `>=10.0.0` (specified: `10.15.1`)
- **Windows Users**: Ensure [Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170#latest-supported-redistributable-version) is installed for builds to work correctly.

### Installation

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Start development mode for all apps
pnpm dev
```

### Commands

```bash
# Development
pnpm dev                    # Start all apps in dev mode
pnpm dev --filter=example-app  # Start specific app

# Building
pnpm build                  # Build all packages and apps
pnpm build --filter=@ottabase/ui-mantine  # Build specific package

# Linting & Type Checking
pnpm lint                   # Lint all packages
pnpm type-check            # Type check all packages

# Testing
pnpm test                   # Run tests for all packages

# Cleaning
pnpm clean                  # Clean all build artifacts
```

## 📦 Key Packages

### Database & ORM

- **@ottabase/db** - Multi-ORM support (Drizzle, Prisma) with D1 adapters
- **@ottabase/ottaorm** - Type-safe ORM with migrations for D1/SQLite
- **@ottabase/cf** - Cloudflare bindings (D1, KV, R2, Queues, Rate Limiting)
- **@ottabase/auth** - Auth.js v5 integration with D1 adapter

### UI Components

- **@ottabase/ui-base** - Framework-agnostic CSS reset and base styles
- **@ottabase/ui-mantine** - Mantine provider with pre-built themes
- **@ottabase/ui-shadcn** - shadcn/ui components with Tailwind
- **@ottabase/ui-components** - Shared UI components (DarkModeToggle, Logo)
- **@ottabase/ottaeditor** - EditorJS wrapper with plugins
- **@ottabase/ottaselect** - Flexible select component

### State & Utilities

- **@ottabase/state** - Global state management with Jotai
- **@ottabase/utils** - Utility functions (files, strings, timezone, etc.)
- **@ottabase/config** - Shared configuration utilities

### Realtime & Advanced

- **@ottabase/cf-realtime** - Pusher alternative using Durable Objects

**Quick Example:**

```tsx
import { createPrismaD1Client } from '@ottabase/cf/d1-prisma';
import { ProviderUIMantine } from '@ottabase/ui-mantine';

// Use D1 database
const prisma = createPrismaD1Client(env.OBCF_D1);
const users = await prisma.user.findMany();

// UI Provider
<ProviderUIMantine colorScheme="dark">
  {children}
</ProviderUIMantine>
```

## 🏗️ Creating New Apps

Choose your framework:

### Option 1: TanStack App (Recommended)

Lightweight, fast, with first-class Cloudflare Workers support.

```bash
# Copy TanStack template
cp -r apps/ottabase-template-app-tanstack apps/my-app
cd apps/my-app

# Update package.json name to @ottabase/my-app
# Delete demo content in src/pages/demo/
```

**Stack**: TanStack Router, TanStack Query, Vite, Cloudflare Workers

### Option 2: Next.js App

Full-featured Next.js with App Router.

```bash
# Copy Next.js template
cp -r apps/ottabase-template-app apps/my-app
cd apps/my-app

# Update package.json name to @ottabase/my-app
# Delete demo content in app/demo/
```

**Stack**: Next.js 15, App Router, OpenNext for Cloudflare

## 🔧 Creating New Packages

```bash
# Create new package
mkdir packages/my-package
cd packages/my-package

# Create package.json
{
  "name": "@ottabase/my-package",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "tsup": "workspace:*"
  }
}
```

## 🎯 Key Features

- **Zero Duplication**: Shared dependencies via pnpm workspaces
- **Fast Builds**: Turborepo with intelligent caching
- **Type Safety**: Full TypeScript support across packages
- **Modern Stack**: Next.js 15+, React 18+, TypeScript 5+
- **Developer Experience**: Hot reload, linting, type checking
- **Scalable**: Easy to add new apps and packages

## 🔄 Dependency Management

### Adding Dependencies

```bash
# Add to root (shared across all packages)
pnpm add -w some-package

# Add to specific package
pnpm add --filter @ottabase/ui-mantine some-package

# Add dev dependency to root
pnpm add -wD some-dev-package
```

### Workspace Protocol

Use `workspace:*` to reference internal packages:

```json
{
  "dependencies": {
    "@ottabase/ui-base": "workspace:*",
    "@ottabase/ui-mantine": "workspace:*",
    "react": "workspace:*"
  }
}
```

## 🏃‍♂️ Performance

- **Turborepo**: Intelligent build caching and parallelization
- **pnpm**: Content-addressable storage, faster installs
- **Workspace Dependencies**: No duplication, consistent versions
- **Incremental Builds**: Only rebuild what changed

## 🛠️ Configuration Files

- `turbo.json`: Turborepo pipeline configuration
- `pnpm-workspace.yaml`: pnpm workspace and catalog configuration
- `tsconfig.json`: Root TypeScript configuration
- `.eslintrc.js`: ESLint configuration for all packages

## Storybook

```bash
pnpm storybook
```

- Stories appear under `packages/` and `apps/` hierarchies based on their source folder
- Set `STORYBOOK_PACKAGES=ui-components,hello-world` to include specific package directories (defaults to all)
- Set `STORYBOOK_APPS=ottabase-template-app` to filter stories to selected apps (defaults to all)
- Set `STORYBOOK_PRIMARY_APP=ottabase-template-app` to choose which app drives the `@/` alias
- Add `.stories.tsx` or `.stories.mdx` files inside package `src/` or app `app/` folders to populate the catalog

## 🚀 Deployment to Cloudflare Workers

Deploy your apps to Cloudflare Workers with automated CI/CD:

```bash
# 1. Setup Cloudflare resources (one-time)
pnpm cloudflare:setup

# 2. Verify configuration
pnpm cloudflare:validate

# 3. Deploy (or push to main for automatic deployment)
cd apps/ottabase-template-app-tanstack
pnpm deploy
```

**📖 Complete Guides:**
- [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md) - Step-by-step deployment
- [CLOUDFLARE_CONFIGURATION_GUIDE.md](CLOUDFLARE_CONFIGURATION_GUIDE.md) - Bindings and configuration
- [docs/cloudflare-features.md](docs/cloudflare-features.md) - Feature usage examples

---

[![Built on Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://cloudflare.com)
