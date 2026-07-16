# @ottabase/ui-shadcn

Shared [shadcn/ui](https://ui.shadcn.com/) components and helpers used across Ottabase applications. The package
provides:

- A ready-to-use theme provider built on top of <code>next-themes</code>
- Pre-configured Radix-based components aligned with shadcn defaults
- A Tailwind-compatible utility <code>cn</code> helper
- Optional Sonner toaster integration

## Usage

Install the dependency via the workspace catalog and add the package to any app:

```jsonc
// apps/<app>/package.json
{
    "dependencies": {
        "@ottabase/ui-shadcn": "workspace:*",
    },
}
```

Import the provider in your root layout to enable dark mode, tooltips, and toasts:

```tsx
// app/providers.tsx
import { ShadcnProviders } from '@ottabase/ui-shadcn/providers';

export function Providers({ children }: { children: React.ReactNode }) {
    return <ShadcnProviders enableToaster>{children}</ShadcnProviders>;
}
```

Use the components anywhere in your app:

```tsx
import { Button, Card, CardHeader, CardContent } from '@ottabase/ui-shadcn';

export function Example() {
    return (
        <Card>
            <CardHeader>Example</CardHeader>
            <CardContent>
                <Button>Click me</Button>
            </CardContent>
        </Card>
    );
}
```

Finally, ensure Tailwind scans the package and that the shared CSS variables are loaded:

1. Add "../../packages/ui-shadcn/components/\*_/_.{ts,tsx}" to the consuming app's <code>tailwind.config</code> content
   list.
2. Import the shared stylesheet in the app's global CSS file:

    ```css
    @import '@ottabase/ui-shadcn/styles.css';
    ```

## Theming hooks (BrandEngine)

Components are fully themeable by the brand engine without forking:

- **`data-slot` everywhere** — every primitive stamps `data-slot="button"`, `data-slot="dialog-content"`, …; CVA
  components also stamp `data-variant`/`data-size`. Because brand stylesheets are injected after the bundle, theme CSS
  restyles anything at equal specificity:

    ```css
    [data-slot='button'][data-variant='outline']:hover {
        border-color: var(--link);
    }
    ```

- **Global focus ring** — components carry no per-component `focus-visible:ring-*` recipes; one global rule in
  `styles/shadcn.css` reads `--focus-ring-{width,style,color,offset}` (defaults look identical to the old ring).
- **Interaction physics** — interactive elements use bare `transition`, so `--hover-transform` / `--press-transform` /
  `--press-shadow` tokens animate hover-lift and press states globally. Opt any custom element in with `data-press`.
- **Decor carriers** — `Button` and `Card` render an empty `aria-hidden` `[data-decor]` span (hidden by default) that
  theme CSS can enable for shine sweeps, ornaments or texture layers.
- **Scrims** — overlays use the `--overlay` color token (`bg-overlay/80`), not hardcoded black.
- **Token rooms** — wrap a subtree in `<BrandScope name="afterdark">…</BrandScope>` (or put `data-brand-scope` on any
  element) and every child re-reads the re-bound semantic vars for that room. No dark-mode props needed.
- **Tier-2 component overrides** — when a design system needs genuinely different DOM, register replacements:

    ```tsx
    import { BrandComponentsProvider } from '@ottabase/ui-shadcn';

    <BrandComponentsProvider overrides={{ button: UppButton }}>{children}</BrandComponentsProvider>;
    ```

    `button`, `badge`, `card` and `input` resolve overrides from context, receiving their original props. Prefer the CSS
    path — reserve overrides for DOM-level differences.

## Development

```bash
pnpm --filter @ottabase/ui-shadcn build
pnpm --filter @ottabase/ui-shadcn lint
pnpm --filter @ottabase/ui-shadcn type-check
```
