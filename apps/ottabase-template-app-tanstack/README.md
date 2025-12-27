# Ottabase Template App (TanStack)

A modern React application template built with Vite + TanStack Router, optimized for Cloudflare Pages deployment.

## Tech Stack

- **Framework**: [TanStack Router](https://tanstack.com/router/latest) (type-safe file-based routing)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Mantine + shadcn/ui
- **State Management**: Jotai
- **Deployment**: Cloudflare Pages

## Features

- 🚀 SPA architecture optimized for Cloudflare Pages edge deployment
- 🎨 Multi-UI library support (Mantine, shadcn/ui)
- 🌙 Dark mode with persistent state (no next-themes dependency)
- 📦 Monorepo-ready with shared packages
- 🔄 Type-safe routing with TanStack Router
- ⚡ Fast development with Vite + HMR
- 🔍 Router devtools in development

## Getting Started

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Deploy to Cloudflare Pages
pnpm cf-deploy
```

## Directory Structure

```
ottabase-template-app-tanstack/
├── app/                    # Application code
│   ├── routes/            # File-based routing
│   ├── styles/            # Global styles
│   ├── main.tsx           # Entry point
│   ├── router.tsx         # Router configuration
│   ├── providers.tsx      # React context providers
│   └── routeTree.gen.ts   # Auto-generated route tree
├── ottabase/              # App configuration
│   ├── config/            # App config, theme
│   ├── state/             # Jotai atoms
│   ├── hooks/             # Custom hooks
│   └── providers/         # Provider components
├── src/                   # App-specific components
│   └── components/        # TanStack-compatible components
├── vite.config.ts         # Vite configuration
├── tailwind.config.cjs    # Tailwind configuration
├── postcss.config.cjs     # PostCSS configuration
└── wrangler.jsonc         # Cloudflare Workers config
```

## Demo Pages

- `/` - Home page
- `/demo` - Demo gallery
- `/demo/mantine` - Mantine UI components
- `/demo/shadcn` - shadcn/ui components
- `/demo/ottaeditor` - Rich text editor
- `/demo/cloudflare` - Cloudflare services demos
- `/demo/timezone` - Timezone utilities
- `/demo/ottaorm` - ORM demo

## Key Differences from Next.js Template

| Feature | Next.js Template | TanStack Template |
|---------|-----------------|-------------------|
| Framework | Next.js 16+ | Vite + TanStack Router |
| Routing | App Router | TanStack Router (file-based) |
| SSR | Next.js built-in | SPA (CSR only) |
| Deployment | OpenNext for CF | Cloudflare Pages (static) |
| Theme Provider | next-themes | Custom Jotai-based |
| Font Loading | next/font/google | CSS @import |
| Build Tool | Next.js (Turbopack) | Vite |

## Why SPA Instead of SSR?

This template uses a Single Page Application (SPA) approach because:

1. **Cloudflare Pages Native**: Static sites deploy instantly to Cloudflare Pages global network
2. **Simpler Architecture**: No server runtime means less complexity
3. **Edge Caching**: Static assets are automatically cached at the edge
4. **API Routes**: Use Cloudflare Workers (Functions) for server-side logic
5. **Fast Development**: Vite provides instant HMR without SSR complexity

For SSR requirements, consider using Cloudflare Workers directly or the Next.js template.

## Cloudflare Bindings

For API routes and server-side logic, use Cloudflare Pages Functions in the `functions/` directory.
Configure your Cloudflare resources in `wrangler.jsonc`:

- **D1**: SQLite database
- **KV**: Key-value storage
- **R2**: Object storage
- **Queues**: Message queues
- **Rate Limiting**: Request throttling

## Creating a New App

1. Copy this template to a new directory
2. Update `ottabase/config/app.config.ts` with your app settings
3. Delete the `/demo` routes (optional)
4. Customize the home page

## Development

```bash
# Type checking
pnpm type-check

# Linting
pnpm lint

# Generate Cloudflare types
pnpm cf-typegen
```

## License

MIT
