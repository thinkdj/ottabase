# Ottabase Homepage (`homepage.ob`)

Marketing site for Ottabase, built with **Next.js** (App Router). The default look matches the original `homepage.ob`
design system (`app/globals.css`). You can switch the entire site to the **Signal Horizon** theme (from `homepage.ob.1`)
by setting `THEME` in `config.ts` to `'signalHorizon'` and rebuilding — that loads `app/themes/signal-horizon.css` via
`app/signal-root.tsx` and uses the `ob-hp-*` shell, nav, and page variants.

Light/dark uses `next-themes`; the storage key comes from `siteConfig` (`hp-ob-theme` for classic, `hp-theme` for Signal
Horizon).

## Scripts

```bash
pnpm --filter @ottabase/homepage-ob dev
pnpm --filter @ottabase/homepage-ob build
pnpm --filter @ottabase/homepage-ob lint
pnpm --filter @ottabase/homepage-ob type-check
```

The `lint` script runs TypeScript checking (`tsc --noEmit`). `.eslintrc.json` is kept for editors that still read legacy
ESLint config.

Dev server defaults to port **3010**.

## Routes

| Path          | Purpose                                       |
| ------------- | --------------------------------------------- |
| `/`           | Landing — hero, ecosystem, code showcase, CTA |
| `/packages`   | All 47 packages with category filter          |
| `/philosophy` | Fat models manifesto + architecture           |
| `/docs`       | Get started + docs sidebar                    |

## Project layout

| Area                                | Role                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `app/`                              | Routes, `layout.tsx`, `globals.css`, providers                                                      |
| `components/core/`                  | `MarketingLayout`, `SiteNav`, `SiteFooter`, `AnimateOnView`, `LegacyAnimateScope`, `ThemeColorMeta` |
| `components/home/`                  | Home page sections, shared `code-showcase-panels.ts`                                                |
| `components/themes/signal-horizon/` | Signal theme shell, nav, footer, home, code tabs, packages                                          |
| `config.ts`                         | `THEME`: `'classic'` \| `'signalHorizon'`                                                           |
| `components/packages/`              | `PackagesView`, `PackageCard`                                                                       |
| `components/philosophy/`            | `PhilosophyArticle`                                                                                 |
| `components/docs/`                  | `DocsSidebar`, `DocsMain`                                                                           |
| `data/package-sections.ts`          | Package list + filter metadata                                                                      |

## Content updates

- **Packages** — edit `data/package-sections.ts` (and copy in `PackageCard` / home ecosystem if needed).
- **Philosophy** — `components/philosophy/PhilosophyArticle.tsx`.
- **Docs** — `components/docs/DocsMain.tsx` (and sidebar links in `DocsSidebar.tsx`).
- **Design tokens** — `app/globals.css`.
- **Home copy** — under `components/home/`.

## Deploying

Static export is not configured; deploy as a Node server (`pnpm build` → `pnpm start`) or adapt hosting to your
platform. For Cloudflare, consider OpenNext or similar in line with other Next apps in the monorepo.
