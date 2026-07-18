# @ottabase/ui-components

Shared UI components for Ottabase applications.

## Components

### ConfirmDialog

A shared confirmation dialog wrapper built on top of `@ottabase/ui-shadcn`'s alert dialog primitives.

#### Props

- `open?: boolean` - Controlled open state
- `onOpenChange?: (open: boolean) => void` - Controlled state callback
- `title?: React.ReactNode` - Dialog title (optional; defaults to a screen-reader-only title)
- `hideTitle?: boolean` - Hide the title visually while keeping it for accessibility
- `a11yTitle?: React.ReactNode` - Accessible fallback title when `title` is omitted (default: `Confirm action`)
- `description?: React.ReactNode` - Optional supporting copy
- `trigger?: React.ReactElement` - Optional trigger element for uncontrolled usage
- `tone?: 'default' | 'destructive' | 'unsaved-changes'` - Confirmation behavior and styling
- `primaryActionText?: React.ReactNode` - Semantic alias for the primary action button text
- `secondaryActionText?: React.ReactNode` - Semantic alias for the secondary action button text
- `confirmLabel?: React.ReactNode` - Confirm button label override
- `cancelLabel?: React.ReactNode` - Cancel button label override
- `onConfirm?: MouseEventHandler<HTMLButtonElement>` - Confirm action
- `onCancel?: MouseEventHandler<HTMLButtonElement>` - Cancel action

`primaryActionText` and `secondaryActionText` take precedence over `confirmLabel` and `cancelLabel` when both are
provided.

#### Usage

```tsx
import { ConfirmDialog } from '@ottabase/ui-components';

<ConfirmDialog
    open={open}
    onOpenChange={setOpen}
    title="Delete post?"
    description="This action cannot be undone."
    tone="destructive"
    confirmLabel="Delete"
    onConfirm={handleDelete}
/>;
```

### JsonEditor

A clean, minimal, dual-mode JSON editor with a Tree view (inline key/value editing, type switching, add/remove nodes)
and a Raw mode (live validation, format/minify). No external JSON editor dependencies; Tailwind-only styling with
dark-mode support.

#### Props

- `value: JsonValue` - Current JSON value (object, array, or primitive)
- `onChange?: (value: JsonValue) => void` - Fires when the user edits
- `readOnly?: boolean` - Disable editing (expand/collapse still works)
- `defaultMode?: 'tree' | 'raw'` - Starting mode (default: `'tree'`)
- `collapseAtDepth?: number` - Auto-collapse nodes at or beyond this depth
- `rootLabel?: string` - Label shown next to the root node (e.g. `"meta"`)
- `className?: string` - Extra className on the outer wrapper

#### Usage

```tsx
import { JsonEditor } from '@ottabase/ui-components';

const [value, setValue] = useState({ hello: 'world', count: 1 });

<JsonEditor value={value} onChange={setValue} rootLabel="meta" collapseAtDepth={3} />;
```

Keyboard: `Enter` commits an inline edit, `Escape` cancels. In Raw mode, `Ctrl/Cmd+S` formats.

This is the canonical JSON editor in the monorepo. `@ottabase/forms` uses it internally for `fieldType: 'json'` fields
and the admin blog editor uses it for the Custom Meta tab — reach for this component instead of adding a third-party
JSON editor dependency.

### DarkModeToggle

A versatile component that provides both toggle switch and button interfaces for switching between light and dark
themes. It integrates with both Mantine's color scheme and next-themes for Tailwind CSS.

#### Props

- `type`: `'toggle-switch' | 'button'` - The visual type of the toggle
- `title?: string` - Tooltip text for the button type (default: "Toggle color scheme")

#### Usage

```tsx
// Import from main entry (all components)
import { DarkModeToggle } from '@ottabase/ui-components';

// Import atomically (better for tree shaking)
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';

// Toggle switch variant
<DarkModeToggle type="toggle-switch" />

// Button variant
<DarkModeToggle type="button" title="Switch theme" />
```

#### Dependencies

This component requires:

- `@mantine/core` - For UI components and color scheme management
- `@tabler/icons-react` - For sun and moon icons
- `next-themes` - For Tailwind CSS theme synchronization

### Logo

A flexible logo component that can display app name, logo image, optional dark mode toggle, and can be wrapped with a
link. Uses the @ottabase/config package for default values.

#### Props

- `size?: number` - Logo image size in pixels (default: 32)
- `darkModeSwitcher?: boolean` - Whether to show dark mode toggle (default: false)
- `logoUrl?: string` - URL/path to logo image (falls back to config.meta.logoUrl)
- `appName?: string` - Application name to display (falls back to config.meta.appName)
- `linkUrl?: string` - Optional URL to wrap logo as link
- `appConfig?: AppConfig` - Optional app config object (creates default if not provided)

#### Usage

```tsx
import { Logo } from '@ottabase/ui-components/logo';
import { createAppConfig } from '@ottabase/config';

// Simple logo with app name (uses default config)
<Logo appName="My App" />

// Logo with image and dark mode toggle
<Logo
  logoUrl="/logo.png"
  appName="My App"
  darkModeSwitcher={true}
  size={40}
/>

// Logo as link
<Logo
  appName="My App"
  linkUrl="/"
/>

// Logo with custom config
const config = createAppConfig({
  appName: 'My Custom App',
  defaults: {
    meta: {
      logoUrl: '/custom-logo.png'
    }
  }
});

<Logo appConfig={config} darkModeSwitcher={true} />
```

#### Dependencies

This component requires:

- `@mantine/core` - For UI components and layout
- `@ottabase/config` - For configuration management
- `next/link` - For optional link functionality (**Next.js only**; if using TanStack Router or another framework, wrap
  the Logo in your router's `<Link>` component instead and omit `linkUrl`)
- Internal DarkModeToggle component (if darkModeSwitcher is true)

### MessageBox

A status/placeholder display component for loading, empty, and info/error states. Shows an icon plus message content
based on `messageType`, or a loading indicator (spinner or skeleton) when `isLoading` is set. `message` accepts a
string, a React node, an `Error` (which automatically switches the display to the `error` type), or a plain object
(pretty-printed as JSON).

#### Props

- `isLoading?: boolean` - Show the loading state instead of a message
- `loadingType?: 'spinner' | 'skeleton'` - Loading visual variant (default: `'spinner'`)
- `message?: React.ReactNode | Error | Record<string, unknown> | string` - Message content
- `messageType?: MessageTypes` - One of `'info' | 'error' | 'warning' | 'success' | 'help' | 'loginRequired' |
  'disconnected' | 'loading'` (default: `'info'`)
- `width?: string | number` - Width of the loading skeleton container

#### Usage

```tsx
import { MessageBox } from '@ottabase/ui-components';

<MessageBox message="Operation completed!" messageType="success" />

<MessageBox isLoading />

<MessageBox isLoading loadingType="skeleton" />
```

### BlogPagination

A simple pagination control for blog post listings, with Previous/Next buttons and ellipsis-collapsed page numbers
for large page counts.

#### Props

- `page: number | undefined` - Current page (default: 1)
- `lastPage: number | undefined` - Total number of pages (default: 1)
- `perPage: number | undefined` - Items per page (default: 30)
- `isLoading?: boolean` - Disable page buttons while true
- `showNextPrev?: boolean` - Show the Previous/Next buttons (default: `true`)
- `showPageNumbers?: boolean` - Show the numbered page buttons (default: `true`)
- `onPageChange: (page: number) => void` - Fires when the user selects a page

#### Usage

```tsx
import { BlogPagination } from '@ottabase/ui-components';

<BlogPagination page={page} lastPage={12} perPage={10} onPageChange={setPage} />;
```

### HistoryGoBackButton

A minimal "Go Back" button that navigates with `window.history.back()`. It's a client component (`'use client'`) and
no-ops if there's no browser history to go back to. Takes no props.

#### Usage

```tsx
import { HistoryGoBackButton } from '@ottabase/ui-components';

<HistoryGoBackButton />;
```

## Tree Shaking

This package supports atomic imports for optimal tree shaking. Each component can be imported individually:

```tsx
// ✅ Tree-shakeable - only bundles DarkModeToggle
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';

// ❌ Imports all components (less optimal)
import { DarkModeToggle } from '@ottabase/ui-components';
```

## Available Atomic Imports

- `@ottabase/ui-components/blog-pagination` - BlogPagination component
- `@ottabase/ui-components/confirm-dialog` - ConfirmDialog component
- `@ottabase/ui-components/dark-mode-toggle` - DarkModeToggle component
- `@ottabase/ui-components/history-go-back-button` - HistoryGoBackButton component
- `@ottabase/ui-components/logo` - Logo component
- `@ottabase/ui-components/message-box` - MessageBox component

## Installation

```bash
pnpm add @ottabase/ui-components
```

For monorepo workspaces, use `workspace:*`:

```json
{ "dependencies": { "@ottabase/ui-components": "workspace:*" } }
```
