# @ottabase/ui-code-highlight

A lightweight, standalone code highlighting component for React applications with automatic light/dark mode support.

## Features

- 🎨 **GitHub-style syntax highlighting** for light and dark modes
- 📋 **Copy to clipboard** with visual feedback
- 📝 **Filename display** in header
- 🔢 **Optional line numbers**
- 🌗 **Automatic theme detection** (light/dark mode)
- 🪶 **Lightweight** - no heavy UI framework dependencies
- 📦 **TypeScript** support out of the box

## Installation

This package is part of the Ottabase monorepo and uses workspace dependencies.

```bash
pnpm add @ottabase/ui-code-highlight
```

## Usage

### Basic Example

```tsx
import { CodeBlock } from '@ottabase/ui-code-highlight';

function MyComponent() {
    return (
        <CodeBlock
            code={`const hello = "world";
console.log(hello);`}
            language="javascript"
        />
    );
}
```

### With Filename

```tsx
<CodeBlock
    code={`function greet(name: string) {
  return \`Hello, \${name}!\`;
}`}
    language="typescript"
    filename="greet.ts"
/>
```

### With Line Numbers

```tsx
<CodeBlock
    code={`def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)`}
    language="python"
    filename="fibonacci.py"
    showLineNumbers={true}
/>
```

## Props

| Prop              | Type      | Default       | Description                                    |
| ----------------- | --------- | ------------- | ---------------------------------------------- |
| `code`            | `string`  | **required**  | The code to display                            |
| `language`        | `string`  | `'plaintext'` | Programming language for syntax highlighting   |
| `filename`        | `string`  | `undefined`   | Optional filename to display in header         |
| `showLineNumbers` | `boolean` | `false`       | Whether to show line numbers                   |
| `className`       | `string`  | `''`          | Additional CSS classes for the wrapper element |

## Supported Languages

The component includes syntax highlighting for the following languages:

- JavaScript/TypeScript (`.js`, `.ts`, `.jsx`, `.tsx`)
- HTML/XML
- CSS/SCSS
- JSON
- Bash/Shell
- SQL
- Python
- Markdown
- Plaintext

## Theming

The component automatically detects your application's theme using:

1. `data-theme` attribute on root element
2. `.dark` or `.light` class on root element
3. Falls back to light mode

### CSS Variables

You can customize the syntax highlighting colors by overriding these CSS variables:

```css
:root {
    --code-bg: #ffffff;
    --code-fg: #24292f;
    --code-comment: #6e7781;
    --code-keyword: #cf222e;
    --code-string: #0a3069;
    --code-number: #0550ae;
    --code-function: #8250df;
    --code-variable: #953800;
    --code-tag: #116329;
    --code-attribute: #0550ae;
    --code-meta: #6e7781;
}

.dark {
    --code-bg: #0d1117;
    --code-fg: #e6edf3;
    /* ... etc */
}
```

## Dependencies

- **`highlight.js`** - Lightweight (76KB minified core), battle-tested syntax highlighting engine with 190+ language
  support
- **`lucide-react`** - Beautiful, consistent icons for the copy button
- **`react`** - Peer dependency

## Technical Details

### Why highlight.js?

- **Lightweight**: Core library is only 76KB minified
- **Extensible**: 190+ languages supported (we bundle only the most common ones)
- **No runtime dependencies**: Pure JavaScript, no external services required
- **Well-maintained**: Active development since 2006, used by GitHub, StackOverflow, and millions of websites
- **Performance**: Optimized for fast rendering and minimal DOM manipulation

### Bundle Size

The component includes only the most commonly used languages to keep the bundle small:

- JavaScript/TypeScript
- HTML/XML
- CSS/SCSS
- JSON
- Bash/Shell
- SQL
- Python
- Markdown

If you need additional languages, you can extend the component by importing and registering them from
`highlight.js/lib/languages/`.

## License

MIT
