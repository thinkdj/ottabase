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

## Development

```bash
pnpm --filter @ottabase/ui-shadcn build
pnpm --filter @ottabase/ui-shadcn lint
pnpm --filter @ottabase/ui-shadcn type-check
```
