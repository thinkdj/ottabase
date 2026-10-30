# @ottabase/ottaeditor

Editor.js, wired for Ottabase: one plugin list, undo/redo, JSON and Markdown export, and twenty custom blocks that edit
in a shared kit and preview through `@ottabase/ottarenderer`, so the editor shows exactly what the reader will get.

## Why it looks the way it does

- **The canvas is the page.** The editor loads the renderer's stylesheet and maps Editor.js's native blocks (heading,
  text, list, quote, callout, table, divider) onto the same typography, so a heading in the editor is the heading on the
  published post. No `prose` wrapper, no card around the editor.
- **Custom blocks edit in a kit and preview for real.** Every block sits in a `BlockShell`: a quiet header naming the
  block with a one-line summary and an **Edit / Preview** switch. Edit mode is fields built from one kit (same inputs,
  segments, switches, sortable rows and media pickers in all twenty blocks). Preview mounts the renderer on the block's
  own data: the exact published block, in the brand's colours. An empty block opens in Edit, a filled one in Preview,
  and clicking a preview enters Edit.
- **Edit mode has three surface levels.** The block is a card (`--card`, a step lighter than the page), the header and
  list rows are a muted tint, and inputs and chips sit on the card colour again with a firm edge. List numbers use the
  accent colour, and a focused block takes a ring-tinted border.
- **Blocks are organised, named and described once.** `BLOCKS` is the registry: title, description, group, icon. The
  toolbox order, the `BlockPalette`, the shell headers and the renamed Editor.js tools ("Warning" reads "Callout") all
  come from it.

## Quick start

```tsx
import { BlockPalette, useOttaEditor } from '@ottabase/ottaeditor';

function PostEditor() {
    const editor = useOttaEditor({ defaultPlugins: 'all', placeholder: 'Start writing…' });
    return (
        <>
            <div
                ref={editor.editorRef}
                className="min-h-[400px] rounded-xl border border-border/60 bg-background py-3"
            />
            <BlockPalette editor={editor.editor} />
        </>
    );
}
```

Mount the holder bare: the wrapper adds the `ottaeditor` class, which carries the typography and toolbar chrome. The
styles ship inside the package entry (`import '@ottabase/ottaeditor'` loads them); an app that resolves the package to
`dist` imports `@ottabase/ottaeditor/dist/index.css` once. Code blocks also want
`@ottabase/ui-code-highlight/styles.css`.

### `useOttaEditor(options)`

| Option                                                                             | Type                 | Description                                                      |
| ---------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------- |
| `defaultPlugins`                                                                   | `'all' \| string[]`  | Which built-in plugins to load (names in `DEFAULT_PLUGIN_NAMES`) |
| `additionalPlugins`                                                                | `OttaEditorPlugin[]` | Your own tools, appended                                         |
| `plugins`                                                                          | `OttaEditorPlugin[]` | Replace the whole list                                           |
| `data`                                                                             | `OutputData`         | Initial content                                                  |
| `placeholder`, `minHeight`, `readOnly`, `autofocus`, `i18n`, `onChange`, `onReady` |                      | Passed to Editor.js                                              |

Returns `editorRef`, `editor`, `isReady`, `hasUnsavedChanges`, `save()`, `render(data)`, `clear()`, `undo()`, `redo()`,
`canUndo`, `canRedo`, `exportJSON()`, `exportMarkdown()`, `toggleReadOnly()`. The `OttaEditor` instance also has
`insertBlock(type, data?)`, which the palette uses.

### `BlockPalette`

Every block, grouped and searchable, with a one-line description. Render it in a popover, sheet or sidebar; clicking an
entry inserts the block after the current one. Props: `editor`, `available` (restrict to these types), `hideGroups`,
`onInsert`, `searchable`.

## Blocks

Editor.js tools, renamed to the registry's names:

| Type        | Shown as     | Notes                                 |
| ----------- | ------------ | ------------------------------------- |
| `paragraph` | Text         |                                       |
| `header`    | Heading      | Levels 1 to 6                         |
| `list`      | List         | Bulleted or numbered, nests           |
| `checklist` | Checklist    |                                       |
| `quote`     | Quote        | Text and attribution                  |
| `warning`   | Callout      |                                       |
| `delimiter` | Divider      |                                       |
| `table`     | Table        | Optional header row                   |
| `embed`     | Embed        | YouTube, Vimeo, X, CodePen and others |
| `linkTool`  | Link preview | Needs a `/api/link-preview` endpoint  |

Ottabase blocks, each with a renderer in `@ottabase/ottarenderer`:

| Group      | Type            | Shown as       | What you edit                                                                                                     |
| ---------- | --------------- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Text       | `spoiler`       | Spoiler        | Text that stays blurred until clicked                                                                             |
| Media      | `image`         | Image          | Upload, paste a URL or pick from the library; caption, alt, link, border, background, stretched, featured, aspect |
| Media      | `mediaLibrary`  | From library   | Picks any upload and inserts the right block (image or video & files)                                             |
| Media      | `mediaGallery`  | Gallery        | Items from the library, five layouts, per-item caption and alt                                                    |
| Media      | `mediaEmbed`    | Video & files  | Video, audio, PDF or document with a player                                                                       |
| Media      | `beforeAfter`   | Before / after | Two images, orientation, start position, fit and focal points                                                     |
| Media      | `imageHotspots` | Hotspots       | Click the image to drop markers, drag them, write each note                                                       |
| Layout     | `layout`        | Columns        | Six presets; each column is its own editor                                                                        |
| Embeds     | `map`           | Map            | Google Maps or OpenStreetMap URL, theme, height, zoom                                                             |
| Embeds     | `code`          | Code           | Language, line numbers, wrapping, highlighted lines, collapsing                                                   |
| Embeds     | `raw`           | HTML           | Raw markup, sanitised on save                                                                                     |
| Engagement | `cta`           | Button         | Label, link, four styles, alignment, new tab                                                                      |
| Engagement | `steps`         | Steps          | Reorderable title + description rows                                                                              |
| Engagement | `faq`           | FAQ            | Reorderable question + answer rows, accordion or flat                                                             |
| Trust      | `testimonial`   | Testimonial    | Quote, author, avatar, logo, rating, five variants, verified, source                                              |
| Trust      | `review`        | Review         | Image, rating, pros and cons, verdict, link, compact                                                              |
| Trust      | `references`    | References     | Numbered or footnote sources                                                                                      |
| Trust      | `disclosure`    | Disclosure     | AI-use level and sponsorship notice                                                                               |

Inline tools: bold, italic, underline, marker, inline code, link, **annotation** (select text, add a title and a note;
the renderer shows it on hover) and **inline spoiler** (`inlineSpoiler`: select words and press the eye-off button or
Ctrl/Cmd+Shift+H; the editor keeps them readable on a hatched chip, readers see them blurred until they click). Both
inline tools wrap text in `<span>` and share one sanitize rule (`SHARED_SPAN_SANITIZE`), because Editor.js merges span
rules across inline tools and two different ones would overwrite each other. Markdown export writes spoilers as
`||text||`.

Saved data shapes are unchanged from earlier versions; the renderer reads them as they are.

## Writing your own block

```ts
import { BlockShell, kit, type BlockTool, type BlockToolConstructorOptions } from '@ottabase/ottaeditor';

export default class NoteTool implements BlockTool {
    private data: { text: string };
    private shell: BlockShell | null = null;

    static get toolbox() {
        return { title: 'Note', icon: kit.iconEl('callout').innerHTML };
    }

    constructor({ data }: BlockToolConstructorOptions<{ text: string }>) {
        this.data = { text: data?.text ?? '' };
    }

    render() {
        // previewable: false when there is no renderer for the block; otherwise call shell.preview(data)
        const shell = new BlockShell({ type: 'note', previewable: false, summary: `${this.data.text.length} chars` });
        this.shell = shell;
        shell.fields.append(
            kit.field({
                label: 'Note',
                control: kit.textarea({ value: this.data.text, onInput: (v) => (this.data.text = v) }),
            }),
        );
        return shell.element;
    }

    save() {
        return this.data;
    }

    destroy() {
        this.shell?.destroy();
    }
}
```

The kit (`kit.*`): `field`, `row`, `stack`, `sectionLabel`, `textInput`, `textarea`, `select`, `segment`, `toggle`,
`checkbox`, `range`, `stars`, `button`, `iconButton`, `addButton`, `positionGrid`, `confirmInline`, `mediaInput` (URL
input with a library button; the host answers `media-library-open` events, see `MediaLibraryPickerBridge` in otta-web),
`sortableList` (drag handle, arrows, remove with inline confirmation), plus `h` and `iconEl`. Register a block type in
your own `BLOCKS`-style metadata if you want it in the palette; `blockMeta(type)` is what the shell reads.

## Theming

Everything reads the design tokens (`--background`, `--primary`, `--radius`, `--duration-*`, the type scale) through
`hsl(var(--x))`; there are no fixed colours. Kit classes are `oe-*`, the canvas is `.ottaeditor`, the shell is
`.oe-block` with `data-block` and `data-mode`, the palette is `[data-slot="block-palette"]`. Editor.js's own chrome
(toolbars, popovers, selection, the table tool) is restyled in `src/styles/ottaeditor.css`.

## Export

`exportToJSON(data)` pretty-prints Editor.js output; `exportToMarkdown(data)` converts every block type it knows,
keeping inline bold, italic, links, code and marks.

## Testing

```bash
pnpm --filter @ottabase/ottaeditor test
```

Each block has a test that mounts it, drives the kit controls by role and label, and asserts `save()` and `validate()`;
the core suite covers the wrapper, undo/redo and export.
