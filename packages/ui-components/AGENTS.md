# @ottabase/ui-components — agent notes

Shared React components (ConfirmDialog, JsonEditor, MessageBox, DarkModeToggle, BlogPagination, Logo, HistoryGoBackButton) for Ottabase apps. Full docs: ./README.md

## Use when

- App UI needs a shared confirm dialog, JSON tree/raw editor, status/loading message box, dark-mode toggle, blog pagination, logo, or back button.
- NOT for low-level primitives (buttons, inputs, alerts) — use @ottabase/ui-shadcn.

## Imports

```ts
import {
    BlogPagination,
    ConfirmDialog,
    DarkModeToggle,
    HistoryGoBackButton,
    JsonEditor,
    Logo,
    MessageBox,
} from '@ottabase/ui-components';
import type { ConfirmDialogProps, JsonValue, MessageTypes } from '@ottabase/ui-components';
// Subpaths (smaller bundles): ./confirm-dialog, ./message-box, ./dark-mode-toggle,
// ./blog-pagination, ./logo, ./history-go-back-button — no ./json-editor subpath.
```

## Canonical usage

```tsx
<ConfirmDialog
    trigger={<Button variant='destructive'>Delete</Button>}
    title='Clear Stored Referral?'
    description='This action cannot be undone.'
    tone='destructive'
    onConfirm={handleDelete}
/>

<MessageBox isLoading={loading} message={error} messageType='error' />

<JsonEditor value={meta} onChange={(v: JsonValue) => setMeta(v)} defaultMode='tree' rootLabel='meta' />
```

## Gotchas

- JsonEditor is root-entry only; every other component also has a subpath export.
- Peer deps: react, react-dom, @mantine/core, next-themes, @tabler/icons-react (catalog:).
- ConfirmDialog labels: primaryActionText ?? confirmLabel; secondaryActionText ?? cancelLabel. tone='unsaved-changes' changes the defaults.
- Exports resolve from dist/ — build with tsup (`pnpm build`) before consuming.
- DarkModeToggle requires a next-themes ThemeProvider; DarkModeToggle/ConfirmDialog/JsonEditor/HistoryGoBackButton are 'use client' (MessageBox, Logo, BlogPagination are not).
