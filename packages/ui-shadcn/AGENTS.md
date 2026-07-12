# @ottabase/ui-shadcn — agent notes

Shared shadcn/ui React components, theme provider, and `cn` helper for Ottabase apps. Full docs: ./README.md

## Use when

- Building React UI in any Ottabase app: buttons, dialogs, forms, tables, sidebar, toasts, dark mode.
- NOT for non-React contexts (workers, CLIs) or non-UI logic.

## Imports

```ts
import { Button, Card, CardContent, Dialog, Input, Badge, cn, toast, ThemeProvider, ShadcnProviders } from '@ottabase/ui-shadcn';
import { ThemeProvider, ShadcnProviders, type ThemeProviderProps, type ShadcnThemeProviderProps } from '@ottabase/ui-shadcn/providers';
import { cn } from '@ottabase/ui-shadcn/lib/utils';
import { Button } from '@ottabase/ui-shadcn/button'; // per-component subpaths: ./dialog, ./sidebar, ./form, ./toaster, ...
```

```css
@import '@ottabase/ui-shadcn/styles.css';
```

## Canonical usage

```tsx
// Root layout / providers (Toaster off by default to avoid duplicates)
<ShadcnProviders enableToaster>{children}</ShadcnProviders>
// or when the app already has its own next-themes provider:
<ShadcnProviders enableThemeProvider={false} enableToaster>{children}</ShadcnProviders>
```

```tsx
import { Button, cn, toast } from '@ottabase/ui-shadcn';

<Button className={cn('w-full', isBusy && 'opacity-50')} onClick={() => toast('Saved')}>
    Save
</Button>;
```

## Gotchas

- Consuming app must add `'../../packages/ui-shadcn/components/**/*.{js,ts,jsx,tsx}'` to its Tailwind `content` globs.
- Must `@import '@ottabase/ui-shadcn/styles.css'` in the app's global CSS (CSS variables live there).
- Subpath exports resolve to `dist/` — run the package's tsup build first (`pnpm --filter @ottabase/ui-shadcn build`).
- `ThemeProvider` enforces unified theming: `attribute: 'class'`, `storageKey: 'ottabase.theme'`, `defaultTheme: 'light'`, `enableSystem: false` (props can override).
- `toast` is re-exported from sonner; it only renders if a `<Toaster />` is mounted (`enableToaster` or import from `@ottabase/ui-shadcn/toaster`).
- Depend on it with `workspace:*`; shared externals use `catalog:`.
