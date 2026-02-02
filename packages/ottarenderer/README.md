# @ottabase/ottarenderer

Content renderer for EditorJS and HTML content in Ottabase applications. Renders rich formatted content with
syntax-highlighted code blocks, custom block components, and responsive styling.

## Features

- **EditorJS Support** - Render EditorJS blocks with custom handlers
- **HTML Rendering** - Convert HTML strings to React components
- **Syntax Highlighting** - Beautiful code block highlighting with `starry-night`
- **Custom Blocks** - 10+ pre-built block renderers (checklist, quote, table, etc.)
- **Code Highlighting** - Automatic syntax highlighting for 180+ languages
- **Responsive** - Mobile-friendly rendering with semantic HTML
- **Extensible** - Override or extend any block renderer
- **TypeScript** - Full type support

## Installation

```bash
pnpm add @ottabase/ottarenderer
```

Also import the included styles:

```typescript
import '@ottabase/ottarenderer/styles';
```

## Quick Start

### Render EditorJS Blocks

```tsx
import { Blocks } from '@ottabase/ottarenderer';

const editorContent = {
    time: 1724770828000,
    blocks: [
        {
            id: 'heading',
            type: 'heading',
            data: { text: 'Welcome', level: 1 },
        },
        {
            id: 'paragraph',
            type: 'paragraph',
            data: { text: 'This is a paragraph.' },
        },
        {
            id: 'code',
            type: 'code',
            data: { code: 'console.log("hello");' },
        },
    ],
};

function Article() {
    return <Blocks data={editorContent} />;
}
```

### Render HTML Content

```tsx
import { HtmlRenderer } from '@ottabase/ottarenderer';

function HtmlPage() {
    const html = '<h1>Title</h1><p>Paragraph with <strong>bold</strong> text.</p>';

    return <HtmlRenderer html={html} />;
}
```

## Components

### Blocks

Main component for rendering EditorJS content:

```tsx
<Blocks
    data={editorContent}
    config={{
        // Optional custom renderers
        checklist: CustomChecklistRenderer,
        quote: CustomQuoteRenderer,
    }}
    className="prose dark:prose-invert"
/>
```

**Props:**

- `data` - EditorJS output object with `blocks` array
- `config` - Optional custom block renderers
- `className` - CSS classes for styling
- `enableCollapse` - Enable collapsible sections (default: true)

### HtmlRenderer

Render raw HTML strings:

```tsx
<HtmlRenderer html={htmlString} className="prose dark:prose-invert" sanitize={true} />
```

**Props:**

- `html` - HTML string to render
- `className` - CSS classes
- `sanitize` - Strip dangerous HTML (default: true)

### BlockInjector

Inject custom renderers for specific block types:

```tsx
import { BlockInjector } from '@ottabase/ottarenderer';

const customRenderers = {
    myCustomBlock: ({ data }) => <div>{data.content}</div>,
};

<BlockInjector blocks={editorContent.blocks} renderers={customRenderers} />;
```

## Built-in Block Renderers

Pre-built renderers for common EditorJS block types:

### Code Block

```tsx
import { Code } from '@ottabase/ottarenderer';

<Code
    data={{
        code: 'const x = 42;',
        language: 'javascript',
    }}
/>;
```

Automatic syntax highlighting with `starry-night`. Supports 180+ languages.

### Checklist

```tsx
import { Checklist } from '@ottabase/ottarenderer';

<Checklist
    data={{
        items: [
            { text: 'Task 1', checked: true },
            { text: 'Task 2', checked: false },
        ],
    }}
/>;
```

### Quote

```tsx
import { Quote } from '@ottabase/ottarenderer';

<Quote
    data={{
        text: 'A great quote',
        caption: 'Author Name',
        alignment: 'left',
    }}
/>;
```

### Table

```tsx
import { Table } from '@ottabase/ottarenderer';

<Table
    data={{
        content: [
            ['Header 1', 'Header 2'],
            ['Cell 1', 'Cell 2'],
        ],
    }}
/>;
```

### List

```tsx
import { List } from '@ottabase/ottarenderer';

<List
    data={{
        style: 'ordered',
        items: ['Item 1', 'Item 2', 'Item 3'],
    }}
/>;
```

### Warning

```tsx
import { Warning } from '@ottabase/ottarenderer';

<Warning
    data={{
        title: 'Important',
        message: 'This is a warning message',
    }}
/>;
```

### CTA (Call-to-Action)

```tsx
import { CTA } from '@ottabase/ottarenderer';

<CTA
    data={{
        text: 'Click me',
        link: 'https://example.com',
        alignment: 'center',
    }}
/>;
```

### Spoiler

```tsx
import { Spoiler } from '@ottabase/ottarenderer';

<Spoiler
    data={{
        title: 'Hidden Content',
    }}
>
    Content revealed when clicked
</Spoiler>;
```

### Advanced Image

```tsx
import { AdvancedImageBlock } from '@ottabase/ottarenderer';

<AdvancedImageBlock
    data={{
        url: 'https://example.com/image.jpg',
        caption: 'Image caption',
        withBorder: true,
        withBackground: false,
        stretched: false,
    }}
/>;
```

## Custom Renderers

Create custom block renderers:

```tsx
import { Blocks } from '@ottabase/ottarenderer';

const customRenderers = {
    myBlock: ({ data }) => (
        <div className="custom-block">
            <h3>{data.title}</h3>
            <p>{data.content}</p>
        </div>
    ),
    youtube: ({ data }) => <iframe width="100%" height="400" src={`https://www.youtube.com/embed/${data.videoId}`} />,
};

<Blocks data={editorContent} config={customRenderers} />;
```

## Example: Blog Post Renderer

```tsx
import { Blocks, defaultEJSRConfigs } from '@ottabase/ottarenderer';

interface BlogPost {
    title: string;
    content: EditorJSContent;
    author: string;
    publishedAt: Date;
}

function BlogPostPage({ post }: { post: BlogPost }) {
    return (
        <article className="max-w-2xl mx-auto px-4 py-8">
            <header className="mb-12">
                <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    By {post.author} on {post.publishedAt.toLocaleDateString()}
                </p>
            </header>

            <div className="prose dark:prose-invert max-w-none">
                <Blocks data={post.content} config={defaultEJSRConfigs} enableCollapse={true} />
            </div>
        </article>
    );
}
```

## Styling

Import the included stylesheet:

```typescript
import '@ottabase/ottarenderer/styles';
```

Or customize with Tailwind classes:

```tsx
<Blocks data={editorContent} className="prose dark:prose-invert max-w-4xl mx-auto" />
```

### Dark Mode

Full dark mode support:

```tsx
<div className="dark">
    <Blocks data={editorContent} className="dark:prose-invert" />
</div>
```

## Performance Notes

- **Lazy Code Highlighting** - Syntax highlighting is performed on-demand
- **Optimized Bundle** - Only load renderers you use
- **React 18+ Compatibility** - Concurrent features supported

## EditorJS Compatibility

Compatible with EditorJS 2.20+. For full block support, use with:

- `@editorjs/header`
- `@editorjs/paragraph`
- `@editorjs/code`
- `@editorjs/list`
- `@editorjs/table`
- Custom blocks

## License

MIT
