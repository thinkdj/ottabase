# @ottabase/brand-engine-react — agent notes

React bindings for Brand Engine: BrandProvider (fetch + theming), useBrand, LayoutResolver. Full docs: ./README.md

## Use when

- React apps needing brand config fetching, CSS-variable theming, or per-route layout shells driven by brand config.
- NOT for non-React consumers or core theme/token logic — use @ottabase/brand-engine directly.

## Imports

```ts
import { BrandProvider, useBrand, BrandPathSync, LayoutResolver } from '@ottabase/brand-engine-react';
import type { BrandConfig, FullBrandConfig, LayoutComponentProps, LayoutResolverProps, RouterAdapter } from '@ottabase/brand-engine-react';
import { tanstackRouterAdapter } from '@ottabase/brand-engine-react/routers';
```

## Canonical usage

```tsx
// App root — initialConfig (SSR) skips the client fetch; fallbackTheme degrades gracefully
<BrandProvider apiEndpoint='/api/brand' appId={appId} initialConfig={ssrConfig} fallbackTheme={theme}>
    {children}
</BrandProvider>;

// Router root layout (inside BrandProvider) — see apps/otta-web/src/router.tsx
const pathname = tanstackRouterAdapter.usePathname();
<>
    <BrandPathSync pathname={pathname} />
    <LayoutResolver router={tanstackRouterAdapter} layoutComponent={ConfigurableLayout}>
        <Outlet />
    </LayoutResolver>
</>;

// Anywhere below the provider:
const { config, isLoading, error, refresh } = useBrand(); // config: BrandConfig | null
```

## Gotchas

- LayoutResolver and useBrand must be inside BrandProvider (useBrand throws otherwise).
- @tanstack/react-router peer dep is optional; only needed for the /routers subpath.
- RouterAdapter is just { usePathname }; without one, LayoutResolver falls back to window.location + popstate. BrandPathSync syncs SPA navigations into BrandProvider. BrandProvider auto-retries transient 502/503/504 fetches (4 attempts, exponential backoff); 500 is not retried.
- Dark mode follows the `dark` class on <html> (MutationObserver); theme CSS variables are applied by the app, not this package — only customCss is injected here.
