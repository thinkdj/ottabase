# @ottabase/ottaeditor

EditorJS wrapper with 30 plugins (13 EditorJS + 17 custom blocks), type-safe plugin selection, undo/redo, and
JSON/Markdown export.

## Installation

```bash
pnpm add @ottabase/ottaeditor
```

## Quick Start

```tsx
import { useOttaEditor } from '@ottabase/ottaeditor';

const { editorRef, save, hasUnsavedChanges, undo, redo, canUndo, canRedo } = useOttaEditor({
    defaultPlugins: 'all', // or ['header', 'paragraph', 'list']
    placeholder: 'Start writing...',
});
```

## Plugins

### EditorJS (13)

`header`, `paragraph`, `list`, `checklist`, `code`, `quote`, `table`, `warning`, `delimiter`, `linkTool`, `embed`,
`raw`, `Marker`, `underline`, `inlineCode`

Raw HTML blocks are sanitized on save to remove wrapper/executable tags (`html`, `head`, `body`, `script`, `iframe`) and
unsafe inline attributes/protocols.

### Custom Blocks (17)

| Plugin          | Description                                                                            |
| --------------- | -------------------------------------------------------------------------------------- |
| `annotation`    | Callout/admonition block with type presets (info, warning, tip, etc.)                  |
| `beforeAfter`   | Image comparison slider with horizontal/vertical orientation, height + imageFit config |
| `cta`           | Call-to-action button with 4 styles (primary/secondary/outline/ghost) and alignment    |
| `disclosure`    | AI usage disclosure (slight/mid/high/custom %) and sponsored-content disclaimer        |
| `faq`           | Q&A accordion or flat list; emits `FAQPage` schema.org structured data                 |
| `imageHotspots` | Annotated image with clickable hotspot markers, height + imageFit config               |
| `layout`        | Multi-column layout (6 presets: 1-1, 1-2, 2-1, 1-3, 3-1, 1-1-1) with nested editors    |
| `map`           | Embeddable map (OpenStreetMap, Google Maps)                                            |
| `mediaEmbed`    | Video/audio/PDF/document player; auto-inserted for non-image media                     |
| `mediaGallery`  | Gallery with 5 layouts (grid-balanced, grid-featured, masonry, filmstrip, mosaic)      |
| `references`    | Citation/bibliography block with numbered references                                   |
| `review`        | Product review with image, rating, pros/cons                                           |
| `spoiler`       | Collapsible content                                                                    |
| `steps`         | Step-by-step timeline with reorder/delete                                              |
| `testimonial`   | Quote card with 5 variants; emits `Review` schema.org when rating is set               |

## API

### `useOttaEditor` Options

| Option              | Type                   | Description           |
| ------------------- | ---------------------- | --------------------- |
| `defaultPlugins`    | `'all' \| string[]`    | Which plugins to load |
| `additionalPlugins` | `OttaEditorPlugin[]`   | Custom plugins to add |
| `placeholder`       | `string`               | Placeholder text      |
| `data`              | `OutputData`           | Initial content       |
| `readOnly`          | `boolean`              | Read-only mode        |
| `onChange`          | `(api, event) => void` | Change callback       |

### Returns

| Property              | Type                        | Description            |
| --------------------- | --------------------------- | ---------------------- |
| `editorRef`           | `RefObject<HTMLDivElement>` | Container ref          |
| `save`                | `() => Promise<OutputData>` | Save content           |
| `hasUnsavedChanges`   | `boolean`                   | Dirty state            |
| `undo` / `redo`       | `() => Promise<void>`       | Undo/redo actions      |
| `canUndo` / `canRedo` | `boolean`                   | Undo/redo availability |
| `exportJSON`          | `() => Promise<string>`     | Export as JSON         |
| `exportMarkdown`      | `() => Promise<string>`     | Export as Markdown     |

### Keyboard Shortcuts

- **Undo**: `Ctrl+Z` / `Cmd+Z`
- **Redo**: `Ctrl+Shift+Z` / `Ctrl+Y`

## Data Shapes

<details>
<summary>CTA</summary>

```typescript
interface CTAData {
    text: string;
    url: string;
    style: 'primary' | 'secondary' | 'outline' | 'ghost';
    alignment: 'left' | 'center' | 'right';
    openInNewTab: boolean;
}
```

</details>

<details>
<summary>Disclosure</summary>

```typescript
interface DisclosureData {
    aiEnabled: boolean;
    aiLevel: 'none' | 'slight' | 'mid' | 'high' | 'custom';
    aiPercent?: number; // 1–100 when custom
    sponsoredEnabled: boolean;
    sponsoredType: 'preset' | 'custom';
    sponsoredText?: string;
}
// AI presets: slight="AI assisted in light editing", mid="significantly used", high="primarily generated"
// Sponsored preset: "This content was created in partnership with a sponsor."
```

</details>

<details>
<summary>FAQ</summary>

```typescript
interface FaqData {
    style: 'accordion' | 'flat';
    items: Array<{ question: string; answer: string }>;
}
```

</details>

<details>
<summary>Image Hotspots</summary>

```typescript
interface ImageHotspotsData {
    imageUrl: string;
    alt: string;
    caption: string;
    height?: string; // e.g., '400px'
    imageFit?: 'contain' | 'cover';
    imagePosition?: ImagePosition; // Focus point when cover mode (default: 'center')
    hotspots: Array<{ id: string; x: number; y: number; title: string; content: string }>;
}

type ImagePosition =
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right';
```

</details>

<details>
<summary>Before / After</summary>

```typescript
interface BeforeAfterData {
    beforeUrl: string;
    afterUrl: string;
    beforeLabel: string;
    afterLabel: string;
    orientation: 'horizontal' | 'vertical';
    sliderPosition: number; // 0–100
    height?: string;
    imageFit?: 'contain' | 'cover';
    beforePosition?: ImagePosition; // Focus point when cover mode
    afterPosition?: ImagePosition;
    caption: string;
}

type ImagePosition =
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right';
```

</details>

<details>
<summary>Layout</summary>

```typescript
interface LayoutData {
    preset: '1-1' | '1-3' | '3-1' | '1-2' | '2-1' | '1-1-1';
    columns: Array<{ content: OutputData }>;
}
```

</details>

<details>
<summary>Media Gallery</summary>

```typescript
interface MediaGalleryData {
    title?: string;
    caption?: string;
    layout: 'grid-balanced' | 'grid-featured' | 'masonry' | 'filmstrip' | 'mosaic';
    items: Array<{ url: string; title?: string; caption?: string; altText?: string }>;
}
```

</details>

<details>
<summary>Steps</summary>

```typescript
interface StepsData {
    items: Array<{ title: string; content: string }>;
}
```

</details>

<details>
<summary>Testimonial</summary>

```typescript
interface TestimonialData {
    quote: string;
    authorName: string;
    authorRole?: string;
    authorCompany?: string;
    authorAvatar?: string;
    companyLogo?: string;
    rating?: number; // 0–5
    variant: 'card' | 'minimal' | 'featured' | 'quote-bubble' | 'side-by-side';
    sourceUrl?: string;
    verified?: boolean;
}
```

</details>

<details>
<summary>References</summary>

```typescript
interface ReferencesData {
    items: Array<{ id: string; citation: string; url?: string }>;
}
```

</details>

## Media Library Integration

Custom plugins can integrate with the app's media library via events:

```typescript
// Open picker
window.dispatchEvent(
    new CustomEvent('media-library-open', {
        detail: { source: 'editor', field: 'myPlugin:imageUrl' },
    }),
);

// Receive selection
window.addEventListener('media-library-selected-item', (e: CustomEvent) => {
    if (e.detail?.field === 'myPlugin:imageUrl') {
        this.data.imageUrl = e.detail.media.url;
    }
});
```

See `ImageHotspotsTool` and `BeforeAfterTool` for examples.

## Export

Standalone export functions:

```typescript
import { exportToJSON, exportToMarkdown, convertInlineHTML } from '@ottabase/ottaeditor';

const json = exportToJSON(outputData); // Pretty-print JSON
const md = exportToMarkdown(outputData); // Convert to Markdown
```

`convertInlineHTML` converts `<b>` → `**`, `<i>` → `*`, `<a>` → `[text](url)`, `<code>` → `` ` ``, `<mark>` → `==`.

## UndoRedoManager

For advanced usage:

```typescript
import { UndoRedoManager } from '@ottabase/ottaeditor';

const manager = new UndoRedoManager({
    maxHistory: 50, // max states (default 50)
    debounceMs: 500, // debounce delay (default 500)
    onChange: ({ canUndo, canRedo }) => {},
});

manager.pushState(data); // debounced
manager.pushStateImmediate(data); // immediate
manager.undo(); // returns previous state or null
manager.redo(); // returns next state or null
manager.clear(); // reset
manager.destroy(); // cleanup
```

## Types

```typescript
import type {
    DefaultPluginName,
    DisclosureData,
    LayoutData,
    MediaGalleryData,
    OttaEditorPlugin,
    OutputData,
} from '@ottabase/ottaeditor';
```
