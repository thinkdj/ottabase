# Smart Breadcrumbs Component

A full-featured, automatic breadcrumb navigation component for TanStack Router applications.

## Features

✅ **Automatic Generation** - No manual configuration needed, breadcrumbs are built from the current route  
✅ **Smart Labeling** - Uses route metadata and custom labels instead of raw URLs  
✅ **Human-Readable** - Converts kebab-case paths to Title Case (e.g., `rate-limiting` → "Rate Limiting")  
✅ **Fully Configurable** - Home icons, custom separators, ellipsis for long paths  
✅ **Accessible** - Proper ARIA attributes and semantic HTML  
✅ **TanStack Router Native** - Uses router context, no extra state management needed

## Quick Start

### Basic Usage

```tsx
import { Breadcrumbs } from '@/components/Breadcrumbs';

function MyPage() {
    return (
        <div>
            <Breadcrumbs />
            {/* Your page content */}
        </div>
    );
}
```

### With Home Icon

```tsx
<Breadcrumbs homeIcon />
```

### Limited Items (Ellipsis)

Shows ellipsis for long paths, useful for deep navigation:

```tsx
<Breadcrumbs maxItems={3} />
```

### Custom Separator

```tsx
import { Slash } from 'lucide-react';

<Breadcrumbs separator={<Slash className="h-3.5 w-3.5" />} />;
```

## How It Works

### Automatic Route Detection

The component uses `useRouterState()` from TanStack Router to detect the current path and automatically generates
breadcrumbs:

- `/` → Home
- `/demo` → Home > Demos
- `/demo/cloudflare/d1` → Home > Demos > Cloudflare Services > D1 Database

### Custom Route Labels

Configure display names in the `ROUTE_LABELS` object inside the component:

```tsx
const ROUTE_LABELS: Record<string, string> = {
    '/': 'Home',
    '/demo': 'Demos',
    '/demo/ottaorm': 'OttaORM',
    '/demo/cloudflare': 'Cloudflare Services',
    '/demo/cloudflare/d1': 'D1 Database',
    // ... add your custom labels
};
```

### Smart Label Generation

If no custom label exists, the component automatically generates one from the path segment:

- `kebab-case` → Title Case
- `ottaorm` → Ottaorm (special cases like `d1`, `kv`, `r2`, `i18n` are handled)

## API

### Props

| Prop        | Type        | Default            | Description                                                        |
| ----------- | ----------- | ------------------ | ------------------------------------------------------------------ |
| `className` | `string`    | -                  | Custom className for nav element                                   |
| `homeIcon`  | `boolean`   | `false`            | Show home icon instead of "Home" text                              |
| `maxItems`  | `number`    | `0`                | Max segments to show (0 = unlimited). Shows ellipsis when exceeded |
| `separator` | `ReactNode` | `<ChevronRight />` | Custom separator between items                                     |

## Example Usage in Layout

```tsx
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Outlet } from '@tanstack/react-router';

function Layout() {
    return (
        <div>
            <header>
                <Breadcrumbs homeIcon />
            </header>
            <main>
                <Outlet />
            </main>
        </div>
    );
}
```

## Demo

Visit `/demo/breadcrumbs` to see all variants and features in action.

## Customization

To add custom labels for your routes:

1. Open `src/components/Breadcrumbs.tsx`
2. Update the `ROUTE_LABELS` object
3. Add your path → label mappings

Example:

```tsx
const ROUTE_LABELS: Record<string, string> = {
    // ... existing labels
    '/my-custom-route': 'My Custom Route',
    '/my-custom-route/nested': 'Nested Page',
};
```

## Dependencies

- `@tanstack/react-router` - For routing context
- `@ottabase/ui-shadcn` - For breadcrumb UI components
- `lucide-react` - For icons

## File Location

- **Component**: `src/components/Breadcrumbs.tsx`
- **Demo Page**: `src/pages/demo/breadcrumbs/BreadcrumbsDemoPage.tsx`
