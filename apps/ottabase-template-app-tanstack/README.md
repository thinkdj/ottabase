# Ottabase Template App (TanStack)

A modern React application template built with TanStack Start, optimized for Cloudflare Workers deployment.

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start/latest) (built on TanStack Router)
- **Styling**: Tailwind CSS + Mantine + shadcn/ui
- **State Management**: Jotai
- **Deployment**: Cloudflare Pages/Workers
- **Build Tool**: Vinxi/Vite

## Features

- 🚀 Optimized for Cloudflare Workers edge deployment
- 🎨 Multi-UI library support (Mantine, shadcn/ui)
- 🌙 Dark mode with persistent state
- 📦 Monorepo-ready with shared packages
- 🔄 Type-safe routing with TanStack Router
- ⚡ Fast development with Vite

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

# Deploy to Cloudflare
pnpm deploy
```

## Directory Structure

```
ottabase-template-app-tanstack/
├── app/                    # TanStack Start application
│   ├── routes/            # File-based routing
│   ├── styles/            # Global styles
│   ├── client.tsx         # Client entry
│   ├── ssr.tsx            # Server entry
│   ├── router.tsx         # Router configuration
│   └── providers.tsx      # React context providers
├── ottabase/              # App configuration
│   ├── config/            # App config, theme
│   ├── state/             # Jotai atoms
│   ├── hooks/             # Custom hooks
│   └── providers/         # Provider components
├── app.config.ts          # TanStack Start config
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
| Framework | Next.js 16+ | TanStack Start |
| Routing | App Router | TanStack Router |
| SSR | Next.js built-in | Vinxi/Nitro |
| Deployment | OpenNext for CF | Native CF Pages |
| Theme Provider | next-themes | Custom Jotai-based |
| Font Loading | next/font/google | CSS @import |

## Cloudflare Bindings

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
