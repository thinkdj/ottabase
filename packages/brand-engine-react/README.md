# @ottabase/brand-engine-react

React bindings for Ottabase Brand Engine — brand config provider, theme application, and layout resolution.

## Install

```bash
pnpm add @ottabase/brand-engine-react
```

## BrandProvider + useBrand

`BrandProvider` fetches brand config from your API, applies the theme as CSS custom properties, and exposes it via
context. Wrap your app root with it:

```tsx
import { BrandProvider, useBrand } from '@ottabase/brand-engine-react';

function App() {
    return (
        <BrandProvider apiEndpoint="/api/brand" appId="my-app">
            <MyContent />
        </BrandProvider>
    );
}

function MyContent() {
    const { config, isLoading, error } = useBrand();
    if (isLoading) return <div>Loading...</div>;
    return config ? <div>{config.brandName}</div> : null;
}
```

**`useBrand()` returns:**

| Field       | Type                 | Description                     |
| ----------- | -------------------- | ------------------------------- |
| `config`    | `BrandConfig\|null`  | Resolved brand config for route |
| `isLoading` | `boolean`            | True during initial fetch       |
| `error`     | `Error\|null`        | Fetch/parse error if any        |
| `refresh`   | `() => void`         | Manually re-fetch brand config  |

**`BrandProvider` props:**

- `apiEndpoint` — API path to fetch brand config from (e.g. `"/api/brand"`)
- `appId` — App identifier passed to the API
- `initialConfig` — Pre-fetched config for SSR/SSG (skips client fetch)
- `fallbackTheme` — Theme tokens used if the API fails (graceful degradation)
- `mode` — `'light'` | `'dark'` override (default: matches `prefers-color-scheme`)

## LayoutResolver

`LayoutResolver` reads route mappings from the brand config and renders the correct layout shell for the current path.
Must be inside `BrandProvider`.

```tsx
import { LayoutResolver } from '@ottabase/brand-engine-react';
import { tanstackRouterAdapter } from '@ottabase/brand-engine-react/routers';
import type { LayoutComponentProps } from '@ottabase/brand-engine-react';

// Your layout shell — receives the resolved LayoutConfig
function AppShell({ config, children }: LayoutComponentProps) {
    return (
        <div className={config.navigation === 'sidebar' ? 'with-sidebar' : ''}>
            <header>...</header>
            <main>{children}</main>
        </div>
    );
}

function App() {
    return (
        <BrandProvider apiEndpoint="/api/brand" appId="my-app">
            <LayoutResolver layoutComponent={AppShell} router={tanstackRouterAdapter}>
                <RouterOutlet />
            </LayoutResolver>
        </BrandProvider>
    );
}
```

**Router adapters:**

```typescript
// TanStack Router (built-in adapter)
import { tanstackRouterAdapter } from '@ottabase/brand-engine-react/routers';

// Custom adapter — any object with a usePathname hook
const myAdapter = { usePathname: () => useMyRouter().pathname };
```

## BrandPathSync

For SSR/server-driven pathname sync (e.g. Next.js App Router where router hooks aren't available in Server
Components), render `BrandPathSync` to push the current path into the brand context:

```tsx
import { BrandPathSync } from '@ottabase/brand-engine-react';

// Render in your layout (client boundary):
<BrandPathSync pathname={serverSidePathname} />
```

## Architecture

```
@ottabase/brand-engine        ← design tokens, CSS injection, API handlers (no React)
@ottabase/brand-engine-react  ← BrandProvider, LayoutResolver, useBrand()
@ottabase/ottalayout          ← LayoutConfig types, presets, route resolver, React slots
```

`BrandProvider` fetches one `GET /api/brand` and resolves the per-route config client-side using the route mappings
in the response. See [`@ottabase/brand-engine`](../brand-engine/README.md) for server-side API handlers and token
architecture.
