# @ottabase/cli

Ottabase monorepo CLI tool for scaffolding, developing, building, and testing apps.

## Installation

The CLI is available as part of the Ottabase monorepo. After installing dependencies:

```bash
pnpm install
```

The root workspace install now builds the CLI automatically. If you change CLI source files directly, rebuild it with:

```bash
pnpm --filter @ottabase/cli build
```

## Usage

### Scaffolding New Apps

```bash
# Create a new web app (Vite + TanStack Router + Cloudflare Workers)
otta new web my-app

# Create a new landing page (Next.js + Cloudflare Workers)
otta new landing my-site

# Show available templates
otta templates
```

### Development

```bash
# Start dev server for an app
otta dev my-app

# Start with custom port
otta dev my-app --port 3005
```

### Building

```bash
# Build an app for production
otta build my-app
```

### Testing

```bash
# Run tests
otta test my-app

# Run tests in watch mode
otta test my-app --watch

# Run tests with coverage
otta test my-app --coverage
```

### Linting

```bash
# Lint an app
otta lint my-app

# Lint and auto-fix
otta lint my-app --fix
```

### Type Checking

```bash
# Type check an app
otta type-check my-app
# or
otta types my-app
```

### Cleaning

```bash
# Clean build artifacts
otta clean my-app
```

### Listing Apps

```bash
# List all apps in the monorepo
otta list
# or
otta ls
```

### App Information

```bash
# Show detailed info about an app
otta info my-app
```

## Available Commands

| Command                      | Description                      |
| ---------------------------- | -------------------------------- |
| `otta new <template> <name>` | Create a new app from a template |
| `otta dev <app>`             | Start the dev server for an app  |
| `otta build <app>`           | Build an app for production      |
| `otta test <app>`            | Run tests for an app             |
| `otta lint <app>`            | Lint an app                      |
| `otta type-check <app>`      | Type check an app                |
| `otta clean <app>`           | Clean build artifacts            |
| `otta list`                  | List all apps in the monorepo    |
| `otta info <app>`            | Show detailed info about an app  |
| `otta templates`             | Show available templates         |

## Templates

### `web`

Full-featured Vite + TanStack Router + Cloudflare Workers app. Includes:

- Vite for fast development
- TanStack Router for routing
- Cloudflare Workers for backend
- OttaORM for database
- Authentication, RBAC, and more

### `landing`

Next.js landing page with Cloudflare Workers deployment. Includes:

- Next.js for SSR/SSG
- OpenNext for Cloudflare deployment
- Tailwind CSS
- shadcn/ui components

## Programmatic Usage

The CLI can also be used programmatically:

```typescript
import { listApps, getAppInfo, newApp, buildApp } from '@ottabase/cli';

// List all apps
const apps = listApps();
console.log(apps);

// Get info about a specific app
const app = getAppInfo('my-app');
console.log(app);

// Create a new app
await newApp('web', 'my-new-app');

// Build an app
await buildApp('my-app');
```

## CLI Development

```bash
# Build the CLI
pnpm --filter @ottabase/cli build

# Watch mode
pnpm --filter @ottabase/cli dev

# Run tests
pnpm --filter @ottabase/cli test

# Type check
pnpm --filter @ottabase/cli type-check
```

If `otta` reports that the dist entry is missing, rebuild the package with `pnpm --filter @ottabase/cli build`.
