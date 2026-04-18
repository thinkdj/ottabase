# Embed System

Lightweight, chromeless routes for embedding Ottabase content in external sites (e.g. marketing homepage iframes).

## How It Works

Routes under `/embed/*` boot a **separate React tree** in [main.tsx](../main.tsx) — completely bypassing the main app's
provider stack (no BrandProvider, session, blog state, or org fetches). Only `QueryClient` and `next-themes` are loaded.

```
main.tsx
  ├─ /embed/*  →  EmbedApp (minimal providers + embed router)
  └─ everything else  →  Providers + main router (full app)
```

## Available Embed Routes

| Route                | Description                        |
| -------------------- | ---------------------------------- |
| `/embed/docs/{slug}` | Package/guide documentation viewer |

### Query Parameters

| Param   | Values          | Description                      |
| ------- | --------------- | -------------------------------- |
| `theme` | `dark`, `light` | Override color scheme on the fly |

### Example

```html
<iframe src="https://demo.ottabase.com/embed/docs/packages/ottaorm?theme=dark" />
```

## Provider Stack (Embed vs Full App)

| Full App                             | Embed                                            |
| ------------------------------------ | ------------------------------------------------ |
| Jotai store                          | —                                                |
| I18nProvider                         | —                                                |
| BlogStudioProvider                   | —                                                |
| BrandProvider (fetches `/api/brand`) | —                                                |
| OttaQueryProvider                    | QueryClient (static config, no refetch on focus) |
| ProviderUIBase + ProviderFont        | —                                                |
| ProviderNextThemes                   | NextThemesProvider                               |
| ThemeProvider + BrandThemeApplicator | —                                                |
| SpotlightProvider                    | —                                                |

**API calls on embed routes: zero** (docs content is bundled via `import.meta.glob`).

## Adding a New Embed Route

1. Create a component in `src/embed/routes/MyEmbedPage.tsx`
2. Register the route in `src/embed/EmbedApp.tsx`:

```typescript
const myEmbedRoute = new Route({
    getParentRoute: () => embedRootRoute,
    path: '/embed/my-feature/$',
    component: lazyRouteComponent(() =>
        import('@/embed/routes/MyEmbedPage').then((m) => ({
            default: m.MyEmbedPage,
        })),
    ),
});

// Add to route tree:
const embedRouteTree = embedRootRoute.addChildren([
    embedIndexRoute,
    embedDocsRoute,
    myEmbedRoute, // ← add here
]);
```

3. Add a test in `src/__tests__/embed.test.ts`

## File Structure

```
src/embed/
├── EmbedApp.tsx              # Minimal provider stack + embed router
├── README.md                 # This file
└── routes/
    └── EmbedDocsPage.tsx     # Docs embed (first route)
```
