# Ottabase TanStack Template App

Minimal React template using **TanStack Router** + **TanStack Query**, with Ottabase shared UI/state packages, and **first-class Cloudflare Workers deployment** via `wrangler`.

## Scripts

- `pnpm dev` - Vite dev server (fast local DX)
- `pnpm preview` - Build + run on `workerd` via Wrangler (Cloudflare-like)
- `pnpm deploy` - Build + deploy Worker + assets
- `pnpm type-check` - TypeScript checks

## Routes

- `/` Home
- `/demo` Demo
- `/api/health` Worker JSON health endpoint
