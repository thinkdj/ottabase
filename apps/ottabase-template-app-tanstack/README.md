# Ottabase TanStack Template App

Minimal React template using **TanStack Router** + **TanStack Query**, with Ottabase shared UI/state packages, and **first-class Cloudflare Workers deployment** via `wrangler`.

## Features

- **TanStack Router** - Type-safe routing with file-based structure
- **TanStack Query** - Powerful async state management
- **Vite** - Fast development server and optimized builds
- **Cloudflare Workers** - Edge deployment with D1, KV, R2, Queues, Rate Limiting, and Durable Objects
- **Mantine + shadcn/ui** - Flexible UI component libraries
- **Jotai** - Global state management
- **OttaORM** - Class-based Drizzle ORM with D1 support

## Directory Structure

```
├── cloudflare-worker.ts    # Cloudflare Worker entry point (API routes)
├── ottabase/               # Server-side code
│   ├── migrations/         # Database migrations
│   └── models/             # OttaORM models (Todo, etc.)
├── src/                    # React application
│   ├── main.tsx           # App entry point
│   ├── router.tsx         # TanStack Router configuration
│   ├── ottabase/          # Client-side Ottabase config
│   │   ├── config/        # App configuration
│   │   ├── hooks/         # Custom hooks
│   │   ├── providers/     # React providers
│   │   └── state/         # Jotai atoms
│   ├── pages/             # Page components
│   │   └── demo/          # Demo pages showcasing features
│   ├── providers/         # App providers wrapper
│   └── styles/            # Global CSS
├── index.html             # HTML template
├── vite.config.ts         # Vite configuration
├── wrangler.jsonc         # Cloudflare Workers configuration
└── tailwind.config.cjs    # Tailwind CSS configuration
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Vite dev server (fast local DX) |
| `pnpm build` | Build for production |
| `pnpm preview` | Build + run on `workerd` via Wrangler (Cloudflare-like) |
| `pnpm deploy` | Build + deploy Worker + assets to Cloudflare |
| `pnpm type-check` | TypeScript type checking |
| `pnpm cf-typegen` | Generate Cloudflare types from wrangler.jsonc |

## Routes

### Pages
- `/` - Home page
- `/demo` - Demo gallery index
- `/demo/mantine` - Mantine UI components demo
- `/demo/shadcn` - shadcn/ui components demo
- `/demo/ottaeditor` - Rich text editor demo
- `/demo/ottaorm` - OttaORM (User/Post CRUD) demo
- `/demo/timezone` - Timezone utilities demo
- `/demo/cloudflare` - Cloudflare services index
- `/demo/cloudflare/d1` - D1 SQLite database demo
- `/demo/cloudflare/kv` - KV namespace demo
- `/demo/cloudflare/r2` - R2 object storage demo
- `/demo/cloudflare/queues` - Queues demo
- `/demo/cloudflare/rate-limiting` - Rate limiting demo
- `/demo/cloudflare/realtime` - Durable Objects realtime demo

### API Endpoints
- `/api/health` - Worker health check
- `/api/cloudflare/*` - Cloudflare service demos
- `/api/ottaorm/*` - OttaORM CRUD endpoints

## Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run with Cloudflare Workers locally (requires wrangler)
pnpm preview
```

## Deployment

```bash
# Deploy to Cloudflare Workers
pnpm deploy
```

Before deploying, update `wrangler.jsonc` with your actual:
- D1 database ID
- KV namespace ID
- R2 bucket name
- Queue name

## Deleting Demo Content

In production apps, you can safely delete:
- `src/pages/demo/` - All demo pages
- Related routes in `src/router.tsx`
- Demo API handlers in `cloudflare-worker.ts`
