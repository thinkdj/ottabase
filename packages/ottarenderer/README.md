# @ottabase/ottarenderer

Renders content written in `@ottabase/ottaeditor` (Editor.js) and sanitized HTML, in the Ottabase visual language. Every
block and every inline tag is handled in this package against the design tokens: no third-party block renderer, no HTML
parser dependency.

## Why in-house

The renderer is the reading surface of the blog, the changelog and the landing page. Owning it end to end means:

- **One typography contract.** The root (`.ottarenderer`) sets body text, heading scale, rhythm and inline marks from
  the Brand Engine tokens (`--text-*`, `--font-body`, `--font-heading`, `--radius`, `--duration-*`). No `prose` wrapper,
  no second system to keep in sync.
- **Sanitised by construction.** Inline HTML from the editor is parsed by an allowlist tokenizer that knows exactly the
  tags the inline tools emit. Unknown tags lose their markup and keep their text, scripts vanish, every URL goes through
  `sanitizeUrl`. It touches no DOM API, so it runs in Workers too.
- **Every block addressable.** The root is `data-slot="renderer"`; each block sits in `.otta-block.otta-block--<type>`
  with `data-slot="block" data-block="<type>"`; block parts are `.otta-<block>__<part>`. Theme CSS targets those, never
  a Tailwind class.
- **Nothing silently dropped.** Link previews (`linkTool`), annotations, list payloads from three Editor.js versions,
  embeds with their aspect ratio: all render.

## Usage

```tsx
import { OttaRenderer } from '@ottabase/ottarenderer';
import '@ottabase/ottarenderer/styles';

<OttaRenderer data={post.content} />;
```

Mount it bare. It owns its typography and spacing; do not wrap it in `prose`, a card or padding. The host decides the
measure (column width). Code blocks use `@ottabase/ui-code-highlight`; import its stylesheet once in the app. Images,
galleries and media embeds open in a lightbox when the tree sits inside `MediaLightboxProvider` from
`@ottabase/medialibrary/react`.

### Props

| Prop         | Type                                     | Description                                                                 |
| ------------ | ---------------------------------------- | --------------------------------------------------------------------------- |
| `data`       | `{ blocks: Block[] }` (Editor.js output) | `time` and `version` are optional. `null` renders an empty root.            |
| `renderers`  | `Record<type, BlockRenderer>`            | Defaults to `blockRenderers`. Spread it to add or replace a block.          |
| `injections` | `{ index, component }[]`                 | Rendered before the block at `index`; an index past the end renders last.   |
| `className`  | `string`                                 | Added to the root. `ottarenderer--sm` / `ottarenderer--lg` change the size. |
| `as`         | `'div' \| 'article' \| 'section'`        | Root element. Default `div`.                                                |

`hasBlocks(data)` tells you whether there is anything to render.

### Custom blocks

```tsx
import { blockRenderers, OttaRenderer, type BlockRenderer } from '@ottabase/ottarenderer';

const Callout: BlockRenderer<{ text: string }> = ({ data }) => <aside className="my-callout">{data.text}</aside>;

<OttaRenderer data={content} renderers={{ ...blockRenderers, callout: Callout }} />;
```

A renderer receives `{ data, block }`. Inside it, `Inline` renders the editor's rich text safely (`useInline` +
`renderNodes` when you also need the plain text), `safeUrl` turns an outside URL into something fit for `src` or null,
and `useHeadingId(block, text)` returns the document-unique id a heading was given. Heading ids are computed once from
the block tree, including Layout columns, so they never depend on what React chooses to re-render. `BlockList` renders a
block array with the built-in renderers when used outside an `OttaRenderer`.

### Injections

```tsx
<OttaRenderer data={post.content} injections={[{ index: 3, component: <NewsletterBox /> }]} />
```

### HTML

```tsx
import { HtmlRenderer } from '@ottabase/ottarenderer';

<HtmlRenderer content={importedHtml} />;
```

The string passes through `sanitizeBlockHtml` and the bare tags get the same typography as the blocks.

### User-generated content

```tsx
<OttaRenderer data={post.content} ugc={Boolean(post.organizationId)} />
<HtmlRenderer content={comment.html} ugc />
```

`ugc` marks content written by people the site does not vouch for (a tenant's posts, community content): every link it
renders, inline or in a block, gets `rel="ugc nofollow noopener"` (plus `noreferrer` when it opens a new tab).
`useLinkRel()` gives a custom block the same rule. The ottablog themes turn it on for organization posts.

### Images

An image field in block data is a `FileSource` from `@ottabase/utils/media`: a `StoredFile`
(`{ key, width?, height?, variants? }`, what an upload or a library pick stores) or an outside address kept as a string.
Content never stores a stored file's URL: URLs are built at render time from the base set once with
`configureMedia({ publicUrl })`, so moving the files bucket moves every image.

```tsx
import { OttaRenderer } from '@ottabase/ottarenderer';
import { configureMedia } from '@ottabase/utils/media';

configureMedia({ publicUrl: 'https://files.example.com' }); // once, before the first render

const image = {
    key: 'app/media/0123456789abcdef0123456789abcdef.jpg',
    width: 2400,
    height: 1600,
    variants: ['thumb', 'card', 'full'],
};

<OttaRenderer data={{ blocks: [{ type: 'image', data: { image, alt: 'The harbour at dawn' } }] }} />;
```

A stored image renders with `srcSet` over its renditions, its intrinsic `width`/`height`, and a `sizes` that follows its
CSS width: 34rem for a plain image, the 48rem reading column when featured (and for before/after, hotspots and the
review header), `100vw` when stretched. Avatars take the `thumb` rendition, logos `sizes="7.5rem"`. An outside address
is a lone `src` through `sanitizeUrl`; an object that is not a valid `StoredFile` renders nothing. The lightbox gets the
original as `url`, the `thumb` and `card` renditions and the `srcSet`.

| Block           | Image fields                                                    |
| --------------- | --------------------------------------------------------------- |
| `advancedImage` | `image`                                                         |
| `beforeAfter`   | `before`, `after`                                               |
| `imageHotspots` | `image`                                                         |
| `mediaEmbed`    | `media`, with `mimeType` / `mediaKind` to tell video from image |
| `mediaGallery`  | `items[].media`, with `alt`, `mimeType` / `mediaKind` per item  |
| `review`        | `image`                                                         |
| `testimonial`   | `authorAvatar`, `companyLogo`                                   |

## Blocks

### Editor.js core and official tools

| Type        | Renders                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `paragraph` | Rich text. An empty paragraph keeps its line so authored spacing survives.                                                        |
| `header`    | `h1`–`h6` with a slug `id` (deep links, tables of contents) and a hover anchor.                                                   |
| `list`      | All three payloads: nested-list, list v1 (strings), list v2 (`checklist` style, `start`, counter type).                           |
| `checklist` | Read-only checklist; done items read as done, with a screen-reader prefix.                                                        |
| `quote`     | Pull quote on a hairline rule with a micro-label attribution; left, centre or right.                                              |
| `delimiter` | Three quiet dots, or the 2.x tool's `dash` / `line` styles with their width.                                                      |
| `table`     | Cells keep inline formatting, short rows are padded, the wrapper scrolls on narrow screens; `stretched` breaks out of the column. |
| `code`      | Syntax highlighting via `@ottabase/ui-code-highlight`.                                                                            |
| `warning`   | Status callout: tint, icon well, title and message.                                                                               |
| `embed`     | Lazy iframe that reserves the stored aspect ratio, capped at 80vh.                                                                |
| `linkTool`  | Link preview card: image, title, description, host.                                                                               |
| `raw`       | Sanitised HTML with the HtmlRenderer typography.                                                                                  |
| `image`     | Same renderer as `advancedImage`.                                                                                                 |

### `@ottabase/ottaeditor` tools

| Type            | Renders                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `advancedImage` | Caption, border, background, featured, aspect ratio, stretched (breaks out of the column symmetrically), link; renditions in `srcSet`, intrinsic size reserved, lazy-loaded |
| `beforeAfter`   | Drag-to-compare slider, horizontal or vertical, cover or contain                                                                                                            |
| `cta`           | Button with four styles and alignment, plus `Action` structured data                                                                                                        |
| `disclosure`    | AI-use and sponsored-content notices                                                                                                                                        |
| `faq`           | Accordion or flat Q&A with `FAQPage` structured data                                                                                                                        |
| `imageHotspots` | Numbered markers with notes                                                                                                                                                 |
| `layout`        | Two or three columns in six presets; nested blocks share the document's renderers and ids                                                                                   |
| `map`           | OpenStreetMap or Google Maps embed                                                                                                                                          |
| `mediaEmbed`    | Video, audio, PDF, document via `MediaPreview`                                                                                                                              |
| `mediaGallery`  | Five layouts: balanced, featured, masonry, filmstrip, mosaic                                                                                                                |
| `references`    | Numbered or footnote bibliography                                                                                                                                           |
| `review`        | Rating, pros and cons, verdict, `Review` structured data                                                                                                                    |
| `spoiler`       | Blurred until clicked, still indexable                                                                                                                                      |
| `steps`         | Numbered vertical timeline                                                                                                                                                  |
| `testimonial`   | Five variants with avatar, stars and `Review` structured data                                                                                                               |

Unknown block types render nothing.

## Inline tools

Paragraphs, headings, list items, table cells, captions and quotes carry the editor's inline HTML. `Inline` turns it
into React:

| Stored markup                                                 | Rendered as                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `<b>`, `<i>`                                                  | `<strong>`, `<em>`                                                   |
| `<u class="cdx-underline">`, `<s>`, `<sub>`, `<sup>`, `<kbd>` | the same element, with the renderer's class where it styles          |
| `<a href target>`                                             | `.otta-link`; `_blank` gets `rel="noopener noreferrer"`              |
| `<code class="inline-code">`                                  | `.otta-inline-code`                                                  |
| `<mark class="cdx-marker">`                                   | `.otta-mark`                                                         |
| `<span class="cdx-annotation" data-title data-annotation>`    | `.otta-annotation`: dotted underline, note on hover, focus or tap    |
| `<span class="cdx-spoiler">`                                  | `.otta-spoiler`: blurred chip; click, tap or Enter reveals and hides |
| `<br>`                                                        | line break                                                           |

Anything else is dropped as markup and kept as text; `script`, `style`, `iframe`, `object`, `svg` and `math` are dropped
with their contents. Entities (`&amp;`, `&nbsp;`, `&#x263A;`…) are decoded. `parseInline`, `renderInline`,
`inlineToText` and `decodeEntities` are exported for custom blocks.

## Theming

The stylesheet reads the Ottabase tokens and falls back to a themeless default at zero specificity. The renderer's own
knobs live on `.ottarenderer` and can be overridden per surface:

```css
.ottarenderer {
    --otta-text: var(--text-base, 1rem); /* body size */
    --otta-leading: 1.75;
    --otta-flow: 1.25rem; /* gap between blocks */
    --otta-flow-section: 2.5rem; /* gap above a heading */
    --otta-radius: calc(var(--radius) + 4px); /* outer surfaces */
    --otta-tint: hsl(var(--muted) / 0.4); /* resting fills */
    --otta-hairline: hsl(var(--border) / 0.6);
    --otta-label-size: 0.6875rem; /* captions and labels */
}
```

Vertical rhythm is the block wrapper's job (`.otta-block + .otta-block`): headings open a section with more air,
paragraph after paragraph reads tighter, media breathes more. Blocks never set outer margins. Heading letter-spacing and
transform honour the Brand Engine's `--typography-heading-*` tokens. Reduced-motion preferences disable every
transition.

## Testing

```bash
pnpm --filter @ottabase/ottarenderer test
```

The suite covers the inline parser (allowlist, XSS vectors, entities, recovery from broken markup, annotations), the
dispatcher (keys, unknown types, injections, renderer override), every standard block, and each custom block.
