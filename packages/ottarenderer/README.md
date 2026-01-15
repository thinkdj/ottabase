# @ottabase/ottarenderer

Content renderer for EditorJS and HTML content in Ottabase applications with syntax highlighting support.

## Features

- Render EditorJS blocks to React components
- Parse and render HTML content
- Syntax highlighting with @wooorm/starry-night
- Customizable block renderers
- Type-safe rendering
- Styled output with included CSS

## Installation

```bash
pnpm add @ottabase/ottarenderer
```

## Quick Start

### Render EditorJS Content

```typescript
import { EditorJSRenderer } from "@ottabase/ottarenderer";
import "@ottabase/ottarenderer/styles";

export function Article({ content }) {
  // content is EditorJS data format
  return (
    <div className="prose">
      <EditorJSRenderer data={content} />
    </div>
  );
}
```

### Render HTML Content

```typescript
import { HTMLRenderer } from "@ottabase/ottarenderer";
import "@ottabase/ottarenderer/styles";

export function Article({ html }) {
  return (
    <div className="prose">
      <HTMLRenderer html={html} />
    </div>
  );
}
```

## Common Use Cases

### EditorJS with Syntax Highlighting

```typescript
import { EditorJSRenderer } from "@ottabase/ottarenderer";

const editorData = {
  time: 1550476186479,
  blocks: [
    {
      type: "header",
      data: {
        text: "Hello World",
        level: 1
      }
    },
    {
      type: "paragraph",
      data: {
        text: "This is a paragraph."
      }
    },
    {
      type: "code",
      data: {
        code: "const hello = 'world';",
        lang: "javascript"
      }
    }
  ],
  version: "2.22.2"
};

export function Post() {
  return (
    <EditorJSRenderer
      data={editorData}
      config={{
        enableCodeHighlight: true,
      }}
    />
  );
}
```

### Custom Block Renderers

```typescript
<EditorJSRenderer
  data={content}
  customRenderers={{
    header: ({ data }) => (
      <h1 className="custom-header">{data.text}</h1>
    ),
    paragraph: ({ data }) => (
      <p className="custom-paragraph">{data.text}</p>
    ),
  }}
/>
```

### HTML with Sanitization

```typescript
import { HTMLRenderer } from "@ottabase/ottarenderer";

<HTMLRenderer
  html={htmlContent}
  sanitize={true}
  allowedTags={['p', 'h1', 'h2', 'strong', 'em']}
/>
```

## Supported EditorJS Blocks

- Header (h1-h6)
- Paragraph
- List (ordered/unordered)
- Code (with syntax highlighting)
- Quote
- Delimiter
- Image
- Table
- Link
- Embed

## Styling

```css
/* Import base styles */
@import "@ottabase/ottarenderer/styles";

/* Or use with Tailwind prose */
<div className="prose dark:prose-invert">
  <EditorJSRenderer data={content} />
</div>
```

## API Reference

### `EditorJSRenderer`

**Props:**
- `data` - EditorJS data object
- `config?` - Renderer configuration
- `customRenderers?` - Custom block renderers
- `className?` - Additional CSS classes

### `HTMLRenderer`

**Props:**
- `html` - HTML string to render
- `sanitize?` - Enable HTML sanitization
- `allowedTags?` - Allowed HTML tags (when sanitize=true)
- `className?` - Additional CSS classes

## License

MIT
