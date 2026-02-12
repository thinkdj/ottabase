# Ottabase Next.js Homepage Template

A barebone Next.js homepage template with OpenNext and Cloudflare Workers deployment. Perfect for creating beautiful,
dynamic homepages with modern web technologies.

## ✨ Features

- **Next.js 16** with App Router and React Server Components
- **OpenNext** for seamless Cloudflare Workers deployment
- **Brand Engine** - Configuration-driven theming with 8+ built-in presets
- **TypeScript** for type safety
- **Tailwind CSS** for rapid styling
- **Dark Mode** support out of the box
- **Fully Responsive** design
- **Production Ready** configuration

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Visit http://localhost:3000
```

## 📦 Project Structure

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

## 🎨 Brand Customization

This template includes Brand Engine integration for easy theming. Edit `config/brand.config.ts` to customize your brand:

```typescript
// config/brand.config.ts
export const brandConfig: Partial<BrandTheme> = {
    name: 'my-brand',
    // Customize colors, typography, spacing, etc.
};

// Choose from built-in presets
export const themePreset = 'default';
// Available: 'default', 'neo', 'crisp', 'funky', 'artisan', 'midnight', 'rose', 'verdant'
```

The Brand Engine is integrated at the worker level, so themes are automatically registered and available throughout your
app.

## 🛠️ Scripts

| Command           | Description                                    |
| ----------------- | ---------------------------------------------- |
| `pnpm dev`        | Start Next.js dev server (HMR)                 |
| `pnpm build`      | Build Next.js app for production               |
| `pnpm preview`    | Build + test with Cloudflare `workerd` runtime |
| `pnpm deploy`     | Build + deploy to Cloudflare Workers           |
| `pnpm type-check` | TypeScript type checking                       |
| `pnpm test`       | Run tests                                      |
| `pnpm lint`       | Run ESLint                                     |

## 🌐 Deployment

### Local Development

```bash
# No Cloudflare account needed for local development
pnpm dev
```

### Production Deployment

#### 1. Login to Cloudflare

```bash
pnpm wrangler login
```

#### 2. Deploy

```bash
# Build and deploy to Cloudflare Workers
pnpm deploy
```

Your app will be deployed to `https://ottabase-template-app-nextjs-homepage.your-subdomain.workers.dev`

### CI/CD Deployment

The template includes GitHub Actions workflow support. Configure the following secrets in your repository:

- `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

The app will be automatically deployed when changes are pushed to the main branch.

## 📝 Customization Guide

### 1. Update Content

Edit the following files to customize your homepage:

- `app/page.tsx` - Homepage content
- `app/about/page.tsx` - About page content
- `app/layout.tsx` - Site metadata (title, description, etc.)

### 2. Configure Brand

Edit `config/brand.config.ts` to set your brand theme:

```typescript
export const themePreset = 'neo'; // Choose your preset
```

### 3. Add New Pages

Create new pages in the `app/` directory:

```bash
# Create a new page
mkdir -p app/contact
echo "export default function Contact() { return <div>Contact</div> }" > app/contact/page.tsx
```

### 4. Update Metadata

Edit `app/layout.tsx` to update site metadata:

```typescript
export const metadata: Metadata = {
    title: 'Your Site Title',
    description: 'Your site description',
    // ... more metadata
};
```

## 🔧 Configuration

### Next.js Configuration

The template uses Next.js standalone output mode for optimal Cloudflare Workers deployment. See `next.config.js` for
configuration details.

### OpenNext Configuration

OpenNext converts Next.js apps to Cloudflare Workers format. The configuration is in `open-next.config.ts`.

### Wrangler Configuration

Cloudflare Workers configuration is in `wrangler.jsonc`. The template includes:

- Asset serving
- Environment variables
- Compatibility flags for Node.js APIs

## 🎯 Use Cases

This template is perfect for:

- Marketing homepages
- Product landing pages
- Portfolio websites
- Company websites
- Documentation homepages
- Project showcase pages

## 🧪 Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

## 📚 Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [OpenNext Documentation](https://opennext.js.org/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Brand Engine Documentation](../../packages/brand-engine/README.md)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🤝 Contributing

This template is part of the Ottabase monorepo. For contributions, please refer to the main repository guidelines.

## 📄 License

Open Source - See the main repository for license details.

## 🔗 Related Templates

- [Ottabase Template App (TanStack)](../ottabase-template-app-tanstack) - Full-featured SPA template
- [Ottabase Template App](../ottabase-template-app) - Legacy Next.js template (deprecated)

---

**Built with ❤️ by the Ottabase team**
