# Ottabase Next.js Homepage Template

A barebone Next.js homepage template with OpenNext and Cloudflare Workers deployment. Perfect for marketing homepages,
landing pages, and company websites.

## Features

- **Next.js App Router** with React Server Components
- **OpenNext** for seamless Cloudflare Workers deployment
- **Brand Engine** — Configuration-driven theming with 8+ built-in presets
- **TypeScript** for type safety
- **Tailwind CSS** for rapid styling
- **Dark Mode** support out of the box
- **Fully Responsive** design

## Quick Start

```bash
pnpm install
pnpm dev
# Visit http://localhost:3000
```

## Project Structure

```
apps/ottabase-template-app-nextjs-homepage/
├── app/
│   ├── page.tsx              # Homepage
│   ├── about/                # About page
│   │   └── page.tsx
│   ├── layout.tsx            # Root layout
│   ├── providers.tsx         # React providers
│   └── globals.css           # Global styles
├── config/
│   └── brand.config.ts       # Brand configuration
├── cloudflare-worker.ts      # Worker entry point
├── wrangler.jsonc            # Cloudflare config
├── open-next.config.ts       # OpenNext configuration
└── next.config.js            # Next.js configuration
```

## Brand Customization

Edit `config/brand.config.ts` to set your theme preset and color overrides:

```typescript
import type { BrandTheme } from '@ottabase/brand-engine';

// config/brand.config.ts
export const brandConfig: Partial<BrandTheme> = {
    name: 'my-brand',
    // Customize colors, typography, spacing, etc.
};

// Choose from 8 built-in presets:
// 'default', 'neo', 'crisp', 'funky', 'artisan', 'midnight', 'rose', 'verdant'
export const themePreset = 'default';
```

The Brand Engine registers and applies the theme at the worker level via CSS custom properties.

## Scripts

| Command           | Description                                    |
| ----------------- | ---------------------------------------------- |
| `pnpm dev`        | Start Next.js dev server (HMR)                 |
| `pnpm build`      | Build Next.js app for production               |
| `pnpm preview`    | Build + test with Cloudflare `workerd` runtime |
| `pnpm deploy`     | Build + deploy to Cloudflare Workers           |
| `pnpm type-check` | TypeScript type checking                       |
| `pnpm test`       | Run tests                                      |
| `pnpm lint`       | Run ESLint                                     |

## Deployment

### Local Development

No Cloudflare account needed for local development:

```bash
pnpm dev
```

### Production Deployment

```bash
pnpm wrangler login
pnpm deploy
```

Your app will be deployed to `https://ottabase-template-app-nextjs-homepage.your-subdomain.workers.dev`

### CI/CD

Configure these secrets in your GitHub repository for automatic deployments on push to main:

- `CLOUDFLARE_API_TOKEN` — API token with Edit Workers permissions
- `CLOUDFLARE_ACCOUNT_ID` — Your Cloudflare account ID

## Customization

### Update Content

- `app/page.tsx` — Homepage content
- `app/about/page.tsx` — About page content
- `app/layout.tsx` — Site metadata (title, description, etc.)

### Add New Pages

```bash
mkdir -p app/contact
echo "export default function Contact() { return <div>Contact</div> }" > app/contact/page.tsx
```

### Update Metadata

```typescript
// app/layout.tsx
export const metadata: Metadata = {
    title: 'Your Site Title',
    description: 'Your site description',
};
```

## Configuration Notes

- **Next.js standalone output** — Used for optimal Cloudflare Workers deployment (see `next.config.js`)
- **OpenNext** — Converts Next.js output to Cloudflare Workers format (see `open-next.config.ts`)
- **wrangler.jsonc** — Cloudflare Workers config with asset serving and compatibility flags

## Related Templates

- [Ottabase Template App (TanStack)](../ottabase-template-app-tanstack) — Full-featured SPA with OttaORM, Auth, RBAC, and
  all Cloudflare bindings

## Documentation

- [Brand Engine](../../packages/brand-engine/README.md)
- [OpenNext Documentation](https://opennext.js.org/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
