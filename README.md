# Ottabase Monorepo

A modern monorepo setup with pnpm workspaces and Turborepo for Next.js 15+ applications and shared packages.

## 🏗️ Structure

```
ottabase/
├── apps/                       # Next.js applications
│   └── ottabase-template-app/  # Example Next.js 15 app that uses packages as sample
├── packages/                # Shared packages
│   ├── db/                  # Shared Prisma database client
│   ├── ui/                  # UI components and providers
│   └── hello-world/         # Example package
```
├── turbo.json              # Turborepo configuration
├── pnpm-workspace.yaml     # pnpm workspace configuration
└── package.json            # Root package.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

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

## 📦 Packages

### @ottabase/db

Shared Prisma database client for Ottabase applications.

**Features:**

- Global Prisma client with development-time singleton pattern
- Shared schema across the monorepo
- Simple setup and usage
- Type-safe database operations

**Usage:**

```tsx
import { prisma } from '@ottabase/db';

// Use the global Prisma client
const users = await prisma.user.findMany();
const user = await prisma.user.create({
  data: {
    email: 'user@example.com'
  }
});
```

**Setup:**

```bash
# Generate Prisma client
pnpm --filter @ottabase/db prisma:generate

# Push schema to database
pnpm --filter @ottabase/db prisma:push
```

### @ottabase/ui-base

Base UI styles and utilities for Ottabase applications.

**Features:**

- Generic CSS reset and base styles
- Animation utilities
- Framework-agnostic design system foundation

### @ottabase/ui-mantine

Mantine UI components and providers for Ottabase applications.

**Features:**

- ProviderUIMantine: Mantine-first provider with notifications, modals, and theme helpers
- Theme management with dark/light mode support
- FOUC (Flash of Unstyled Content) prevention utilities
- Pre-built themes (ShadCN, Vercel, Ant Design, Stripe)

> ℹ️ Next.js-specific providers (fonts, theme sync) live inside
> `apps/ottabase-template-app/ottabase/providers` so framework code
> stays out of reusable packages.

**Usage:**

```tsx
import { ProviderUIMantine } from '@ottabase/ui-mantine';

const fontFamilies = {
  primary: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  heading: "Work Sans, 'Segoe UI', sans-serif",
  monospace: "JetBrains Mono, 'Fira Code', monospace",
};

function App({ children }) {
  return (
    <ProviderUIMantine fontFamilies={fontFamilies}>
      {children}
    </ProviderUIMantine>
  );
}
```

## 🏗️ Creating New Apps

### Next.js App

```bash
# Create new Next.js app
mkdir apps/my-new-app
cd apps/my-new-app

# Copy from example-app or create manually
cp -r ../example-app/* .

# Update package.json name
# Update any app-specific configurations
```

### Package Structure

```json
{
  "name": "@ottabase/my-new-app",
  "dependencies": {
    "next": "^15.0.0",
    "react": "workspace:*",
    "react-dom": "workspace:*",
    "@ottabase/ui-base": "workspace:*",
    "@ottabase/ui-mantine": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "eslint": "workspace:*"
  }
}
```

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

---

[![Built on Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://cloudflare.com)
