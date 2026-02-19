# @ottabase/ottarenderer

React renderer for [Editor.js](https://editorjs.io/) content and generic HTML.

## Features

- **Editor.js Support**: Renders blocks from Editor.js (headers, paragraphs, lists, images, etc.).
- **Custom Blocks**: Includes renderers for `@ottabase/ottaeditor` custom blocks (AdvancedImage, Spoiler, CTA, etc.).
- **HTML Renderer**: Safe HTML rendering utility.
- **Tailwind Configured**: Styled with Tailwind CSS via `@ottabase/ui-base`.
- **Extensible**: Supports custom block injectors.

## Installation

```bash
pnpm add @ottabase/ottarenderer
```

Code blocks use `@ottabase/ui-code-highlight`. Import its styles in your app (e.g. in `globals.css`):

```css
@import '@ottabase/ui-code-highlight/styles.css';
```

## Usage

### Rendering Editor.js Data

The `EditorJsRenderer` component takes the raw output data from Editor.js and renders it as React components.

```tsx
import { default as Renderer } from 'editorjs-blocks-react-renderer';
import { blockClass, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';

function BlogPost({ content }) {
    // content is the JSON object from Editor.js
    return (
        <article className="prose dark:prose-invert max-w-none">
            <Renderer
                data={content}
                config={{
                    ...defaultEJSRConfigs, // Default block class mappings
                    ...customRenderers, // Custom renderers for advanced blocks
                }}
            />
        </article>
    );
}
```

### Rendering HTML

```tsx
import { HtmlRenderer } from '@ottabase/ottarenderer';

function SafeContent({ htmlString }) {
    return <HtmlRenderer html={htmlString} className="my-content" />;
}
```

## Supported Blocks

The package includes default renderers for standard Editor.js blocks and custom components:

- **Standard**: Header, Paragraph, List, Quote, Code, Table, Delimiter, Attaches
- **Custom**:
    - `AdvancedImageBlock`: Enhanced image with caption and layout options
    - `Checklist`: Interactive checklist
    - `CTA`: Call-to-action buttons
    - `Review`: Product/service review with image, star rating, pros/cons, and summary
    - `Spoiler`: Collapsible content
    - `Warning`: Callout/Alert boxes

## Customization

You can extend or override the renderers by passing a `config` object to the underlying renderer or customizing
`customRenderers`.

```typescript
import { customRenderers } from '@ottabase/ottarenderer';

const myConfig = {
    ...customRenderers,
    header: MyCustomHeaderComponent,
};
```
