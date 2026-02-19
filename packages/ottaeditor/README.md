# @ottabase/ottaeditor

A flexible EditorJS wrapper with typesafe plugin management for React applications.

## Features

- 🔌 **15 pre-installed EditorJS plugins**
- ✨ **Typesafe plugin selection** with autocomplete
- 📦 Full TypeScript support
- 🎯 Easy custom plugin integration
- 🎁 Zero configuration required

## Installation

```bash
pnpm add @ottabase/ottaeditor
```

## Default Plugins

15 EditorJS plugins included: Header, Paragraph, List, Checklist, Code, Quote, Table, Warning, Delimiter, Link, Embed,
Raw HTML, Marker, Underline, Inline Code.

### Custom Block Plugins

- **Spoiler** - Collapsible spoiler content
- **CTA** - Call-to-action button with style variants
- **Review** - Product/service review block with image, rating, pros/cons, and summary

## Quick Start

### Load All Plugins

```tsx
import { useOttaEditor } from '@ottabase/ottaeditor';

const { editorRef, save, hasUnsavedChanges } = useOttaEditor({
    defaultPlugins: 'all',
    placeholder: 'Start writing...',
});

// Use hasUnsavedChanges to control save button state
<button onClick={save} disabled={!hasUnsavedChanges}>
    Save
</button>;
```

### Select Specific Plugins

```tsx
const { editorRef } = useOttaEditor({
    defaultPlugins: ['header', 'paragraph', 'list', 'code'],
});
```

### Add Custom Plugins

```tsx
import MyCustomPlugin from './MyCustomPlugin';

const { editorRef } = useOttaEditor({
    defaultPlugins: 'all',
    additionalPlugins: [{ name: 'custom', tool: MyCustomPlugin }],
});
```

### Use Constants (Type-safe)

```tsx
import { DEFAULT_PLUGIN_NAMES } from '@ottabase/ottaeditor';

const { editorRef } = useOttaEditor({
    defaultPlugins: [DEFAULT_PLUGIN_NAMES.HEADER, DEFAULT_PLUGIN_NAMES.PARAGRAPH],
});
```

## Available Plugin Names

Use these names with `defaultPlugins`:

`'header'`, `'paragraph'`, `'list'`, `'checklist'`, `'code'`, `'quote'`, `'table'`, `'warning'`, `'delimiter'`,
`'linkTool'`, `'embed'`, `'raw'`, `'Marker'`, `'underline'`, `'inlineCode'`, `'spoiler'`, `'cta'`, `'review'`

## API

### `useOttaEditor` Options

```typescript
{
  defaultPlugins?: 'all' | string[];  // Which default plugins to load
  additionalPlugins?: OttaEditorPlugin[];  // Custom plugins to add
  placeholder?: string;
  data?: OutputData;
  minHeight?: number;
  readOnly?: boolean;
  autofocus?: boolean;
  onReady?: () => void;
  onChange?: (api, event) => void;
}
```

### `useOttaEditor` Returns

```typescript
{
    editorRef: React.RefObject<HTMLDivElement>;
    editor: OttaEditor | null;
    save: () => Promise<OutputData | null>;
    clear: () => Promise<void>;
    render: (data: OutputData) => Promise<void>;
    toggleReadOnly: (state?: boolean) => Promise<void>;
    isReady: boolean;
    hasUnsavedChanges: boolean; // True when content changes, false after save
}
```

## Types

```typescript
import type { DefaultPluginName, OttaEditorPlugin, OutputData } from '@ottabase/ottaeditor';
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
