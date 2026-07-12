# @ottabase/ottarenderer — agent notes

React renderers for saved Editor.js JSON and HTML strings (read-side of ottaeditor). Full docs: ./README.md

## Use when

- Displaying stored Editor.js content in a React frontend, incl. all ottaeditor custom blocks (CTA, Faq, BeforeAfter, Layout, Steps, MediaGallery, ...).
- Rendering trusted-ish HTML strings safely (`HtmlRenderer` sanitizes via `@ottabase/utils/sanitize`).
- NOT for authoring/editing content — that is `@ottabase/ottaeditor`. This package is display-only.

## Imports

    import { Blocks, customRenderers, defaultEJSRConfigs, HtmlRenderer } from '@ottabase/ottarenderer';
    import { BlockInjector, blockClass, shouldRenderContentBlocks } from '@ottabase/ottarenderer';
    import type { CTAData, FaqData, LayoutData, StepsData, MediaGalleryData } from '@ottabase/ottarenderer';
    import '@ottabase/ottarenderer/styles';

## Canonical usage

Render Editor.js data (always pass config + renderers explicitly):

    <Blocks data={entry.content} config={defaultEJSRConfigs} renderers={customRenderers} />

Render an HTML string (sanitized, prose-styled):

    <HtmlRenderer content={htmlString} className="my-4" />

Interleave ads/CTAs between blocks:

    <BlockInjector blocksData={data} injections={[{ index: 2, component: <MyAd /> }]} />

Guard before rendering: `shouldRenderContentBlocks(content)` — false for null/empty object.

## Gotchas

- `Blocks` is a re-export of `editorjs-blocks-react-renderer`'s default; it renders nothing custom unless you pass `renderers={customRenderers}`.
- `code` blocks use `@ottabase/ui-code-highlight` — import `@ottabase/ui-code-highlight/styles.css` once in the consuming app (otta-web does it in globals.css).
- Styling assumes Tailwind semantic tokens from `@ottabase/ui-base` (`text-foreground`, `bg-primary`, ...); also import `@ottabase/ottarenderer/styles`.
- `react`/`react-dom` are peerDependencies (catalog:); internal deps are workspace:*.
- Every rendered block gets class `cdc-content-block` (`blockClass`) plus a per-type `cdc-content-*` class — hook page-level CSS there.
