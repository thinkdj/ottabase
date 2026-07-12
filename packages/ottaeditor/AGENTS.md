# @ottabase/ottaeditor — agent notes

React EditorJS wrapper: ~30 plugins (13 EditorJS + 17 custom blocks), undo/redo, JSON/Markdown export. Full docs: ./README.md

## Use when

- Building or rendering block-based rich-text content in React (layout, gallery, FAQ, steps, testimonial, hotspots, CTA, map...).
- NOT for server-side/edge code or plain-markdown editing — requires DOM + React; browser-only.

## Imports

```ts
import { useOttaEditor, OttaEditor, OttaEditorComponent } from '@ottabase/ottaeditor';
import { exportToJSON, exportToMarkdown, UndoRedoManager } from '@ottabase/ottaeditor';
import { defaultPlugins, defaultPluginsMap, getDefaultPlugins, DEFAULT_PLUGIN_NAMES } from '@ottabase/ottaeditor';
import { AdvancedImageTool, MediaEmbedTool, MediaGalleryTool, MediaLibraryTool, RawHtmlTool } from '@ottabase/ottaeditor';
import type { OttaEditorPlugin, OttaEditorConfig, DefaultPluginName, OutputData } from '@ottabase/ottaeditor';
```

## Canonical usage

Hook (preferred):

```tsx
const { editorRef, save, isReady, hasUnsavedChanges, undo, redo, canUndo, canRedo, exportJSON, exportMarkdown } =
    useOttaEditor({
        defaultPlugins: 'all', // or ['header', 'paragraph', 'list']
        placeholder: 'Start writing...',
        data: initialData, // OutputData
        additionalPlugins: [{ name: 'myTool', tool: MyTool, config: {} }],
    });

return <div ref={editorRef} />;
```

Drop-in component:

```tsx
<OttaEditorComponent defaultPlugins={['header', 'paragraph']} onEditorReady={(editor) => {}} />
```

Export saved data:

```ts
const data = await save(); // OutputData | null
const md = exportToMarkdown(data); // or exportToJSON(data)
```

## Gotchas

- README shows `convertInlineHTML` importable from the package — it exists in src/export.ts but is NOT re-exported from src/index.ts; don't import it.
- Raw HTML blocks are sanitized on save (strips `script`/`iframe`/`html`/`head`/`body`, unsafe attrs/protocols). Still sanitize any user HTML server-side via @ottabase/utils/sanitize before storing/rendering.
- Media-library tools (ImageHotspots etc.) integrate via window CustomEvents: dispatch `media-library-open` with `{ detail: { source: 'editor', field } }`, listen for `media-library-selected-item` and match `detail.field`.
- `react`/`react-dom` are peerDependencies (catalog:); package consumes `@ottabase/ottaupload` (workspace:*) and must be built (`pnpm build` -> dist) before consumption — exports map points at dist only.
- Undo/redo shortcuts built in: Ctrl/Cmd+Z, Ctrl+Shift+Z / Ctrl+Y; `hasUnsavedChanges` resets after `save()`.
- `defaultPlugins: 'all'` is the default; pass `plugins: []` to opt out entirely, or a `DefaultPluginName[]` to pick a subset.
