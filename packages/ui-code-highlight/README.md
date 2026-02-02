# @ottabase/ui-code-highlight

Syntax highlighting for code blocks in React applications. Wraps code in beautiful colored tokens with automatic
language detection and multiple theme options.

## Features

- **Automatic Language Detection** - Detects syntax from language hints
- **Multiple Languages** - Support for 180+ languages via `starry-night`
- **Light & Dark Themes** - Automatic theme switching
- **Line Numbers** - Optional line number display
- **Copy Button** - Built-in copy-to-clipboard functionality
- **Customizable** - Override styles and appearance
- **React 18+** - Compatible with concurrent features
- **No External CDN** - Everything bundled

## Installation

```bash
pnpm add @ottabase/ui-code-highlight
```

## Quick Start

Wrap your app with the provider:

```tsx
import { ProviderCodeHighlight } from '@ottabase/ui-code-highlight';

export default function App() {
    return (
        <ProviderCodeHighlight>
            <YourApp />
        </ProviderCodeHighlight>
    );
}
```

## Usage Examples

### Basic Code Block

```tsx
import { CodeBlock } from '@ottabase/ui-code-highlight';

function Example() {
    const code = `const greeting = "Hello, World!";
console.log(greeting);`;

    return <CodeBlock code={code} language="javascript" />;
}
```

### With Line Numbers

```tsx
<CodeBlock code={code} language="python" showLineNumbers={true} />
```

### With Copy Button

```tsx
<CodeBlock code={code} language="typescript" showCopyButton={true} onCopy={() => console.log('Copied!')} />
```

### Different Languages

Supports syntax highlighting for:

```tsx
// JavaScript/TypeScript
<CodeBlock code="const x = 42;" language="javascript" />

// Python
<CodeBlock code="x = 42" language="python" />

// HTML
<CodeBlock code="<div>Hello</div>" language="html" />

// CSS
<CodeBlock code=".button { color: blue; }" language="css" />

// SQL
<CodeBlock code="SELECT * FROM users;" language="sql" />

// JSON
<CodeBlock code='{"name": "John"}' language="json" />

// Markdown
<CodeBlock code="# Heading" language="markdown" />

// Bash
<CodeBlock code="npm install package" language="bash" />
```

### Auto-Language Detection

Let the highlighter detect the language from hints:

```tsx
<CodeBlock code={code} /> // Auto-detects from code structure
```

### Theme Switching

Automatically respects light/dark mode:

```tsx
<div className="dark">
    <CodeBlock code={code} language="javascript" />
    {/* Will use dark theme */}
</div>
```

### Custom Styling

Apply custom classes:

```tsx
<CodeBlock
    code={code}
    language="javascript"
    className="rounded-lg border border-gray-300"
    blockClassName="bg-gray-50"
/>
```

## Supported Languages

The package includes syntax highlighting for 180+ languages including:

- **Web**: HTML, CSS, JavaScript, TypeScript, JSX, TSX, Vue, Svelte
- **Scripting**: Python, Ruby, PHP, Bash, Shell, PowerShell
- **Systems**: Rust, Go, C, C++, Java, C#, Kotlin
- **Backend**: Node.js, Express, Django, Rails, Laravel
- **Data**: JSON, XML, YAML, TOML, CSV, SQL
- **Markup**: Markdown, AsciiDoc, ReStructuredText
- **Cloud**: Docker, Kubernetes, HCL, CloudFormation
- **And 100+ more**

## Advanced Usage

### With EditorJS Integration

```tsx
import { CodeBlock } from '@ottabase/ui-code-highlight';
import { Blocks } from '@ottabase/ottarenderer';

function EditorContent() {
    const content = {
        blocks: [
            {
                type: 'code',
                data: {
                    code: 'console.log("hello");',
                    language: 'javascript',
                },
            },
        ],
    };

    return <Blocks data={content} />;
}
```

### In Documentation Sites

```tsx
function DocPage() {
    return (
        <article className="prose dark:prose-invert">
            <h1>API Documentation</h1>

            <h2>Installation</h2>
            <CodeBlock code="pnpm add @ottabase/api" language="bash" showCopyButton />

            <h2>Usage</h2>
            <CodeBlock
                code={`const api = new OttabaseAPI({
  baseUrl: 'https://api.example.com'
});`}
                language="typescript"
                showLineNumbers
            />
        </article>
    );
}
```

### In Blog Posts

```tsx
function BlogPost({ content }: { content: EditorJSData }) {
    return (
        <article className="max-w-2xl mx-auto">
            <h1>{content.title}</h1>

            {content.blocks.map((block) => {
                if (block.type === 'code') {
                    return (
                        <CodeBlock
                            key={block.id}
                            code={block.data.code}
                            language={block.data.language}
                            showCopyButton
                            showLineNumbers
                        />
                    );
                }
                // ... handle other block types
            })}
        </article>
    );
}
```

## Props

```typescript
interface CodeBlockProps {
    // Content
    code: string;
    language?: string;

    // Display
    showLineNumbers?: boolean;
    showCopyButton?: boolean;
    maxHeight?: string | number;
    className?: string;
    blockClassName?: string;

    // Callbacks
    onCopy?: () => void;
    onLanguageDetect?: (language: string) => void;
}
```

## Performance Notes

- **Efficient Highlighting** - Syntax highlighting is computed once
- **No External APIs** - Everything works offline
- **Tree-Shakeable** - Only imported languages are bundled

## Themes

The provider includes:

- **Light Theme** - Optimized for light backgrounds
- **Dark Theme** - Optimized for dark backgrounds
- **Auto** - Respects system preference and `dark:` class

## Browser Support

Works in all modern browsers:

- Chrome 88+
- Firefox 87+
- Safari 14+
- Edge 88+

## License

MIT
