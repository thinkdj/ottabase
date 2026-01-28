# @ottabase/ottarenderer

Render EditorJS content to React components.

## Quick Start

```tsx
import Blocks from "@ottabase/ottarenderer";

<Blocks
  data={editorJsData}
  renderers={customRenderers}
  config={defaultEJSRConfigs}
/>
```

## HTML Renderer

Render EditorJS as HTML string (for SSR or emails):

```tsx
import { HtmlRenderer } from "@ottabase/ottarenderer";

<HtmlRenderer data={editorJsData} />
```

## Block Injector

Inject custom components between blocks:

```tsx
import { BlockInjector } from "@ottabase/ottarenderer";

<BlockInjector
  data={editorJsData}
  inject={(block, index) => {
    if (index === 2) {
      return <AdBanner />;
    }
    return null;
  }}
/>
```

## Custom Block Renderers

```tsx
import {
  customRenderers,
  defaultEJSRConfigs,
  AdvancedImageBlock,
  Checklist,
  List,
  Quote,
  Warning,
  Code,
  Table,
} from "@ottabase/ottarenderer";

// Use built-in renderers
<Blocks
  data={editorJsData}
  renderers={{
    ...customRenderers,
    myCustomBlock: MyCustomRenderer,
  }}
  config={defaultEJSRConfigs}
/>
```

## Available Renderers

| Block Type | Component |
|------------|-----------|
| `image` | `AdvancedImageBlock` |
| `checklist` | `Checklist` |
| `list` | `List` |
| `quote` | `Quote` |
| `warning` | `Warning` |
| `code` | `Code` |
| `table` | `Table` |

## Styling

Import base styles:

```tsx
import "@ottabase/ottarenderer/styles.css";
```

Or use the class utility:

```tsx
import { blockClass } from "@ottabase/ottarenderer";

// Returns consistent class names for blocks
const className = blockClass("paragraph");
```

## Check Content

```tsx
import { shouldRenderContentBlocks } from "@ottabase/ottarenderer";

if (shouldRenderContentBlocks(data)) {
  return <Blocks data={data} />;
}
return <EmptyState />;
```

## Exports

```typescript
// Main renderer
import Blocks from "@ottabase/ottarenderer";
import { HtmlRenderer, BlockInjector } from "@ottabase/ottarenderer";

// Block components
import {
  AdvancedImageBlock,
  Checklist,
  List,
  Quote,
  Warning,
  Code,
  Table,
} from "@ottabase/ottarenderer";

// Utilities
import {
  customRenderers,
  defaultEJSRConfigs,
  blockClass,
  shouldRenderContentBlocks,
} from "@ottabase/ottarenderer";

// Types
import type { AdvancedImageData, ChecklistItem, QuoteData } from "@ottabase/ottarenderer";
```
