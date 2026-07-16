# @ottabase/ui-code-highlight

A lightweight, standalone code highlighting component for React applications with automatic light/dark mode support.

## Features

- **GitHub-style syntax highlighting** for light and dark modes
- **Copy to clipboard** with visual feedback
- **Filename display** in header
- **Optional line numbers**
- **Automatic theme detection** (light/dark mode)
- **Lightweight** - no heavy UI framework dependencies
- **TypeScript** support out of the box

## Installation

This package is part of the Ottabase monorepo and uses workspace dependencies.

```bash
pnpm add @ottabase/ui-code-highlight
```

## Usage

Import the styles once in your app (e.g. in root `globals.css`):

```css
@import '@ottabase/ui-code-highlight/styles.css';
```

Or via relative path (if package subpath fails with PostCSS):

```css
@import '../../packages/ui-code-highlight/src/styles.css';
```

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

| Prop                   | Type                        | Default       | Description                                                                                        |
| ---------------------- | --------------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| `code`                 | `string`                    | required      | The code to display                                                                                |
| `language`             | `string`                    | `'plaintext'` | Programming language for syntax highlighting                                                       |
| `filename`             | `string`                    | —             | Optional filename to display in header                                                             |
| `showLineNumbers`      | `boolean`                   | `false`       | Whether to show line numbers                                                                       |
| `lineNumberStart`      | `number`                    | `1`           | Starting line number (for code snippets). Invalid values (0, NaN, non-numeric) are sanitized to 1. |
| `maxHeight`            | `string`                    | —             | Max height with scroll (e.g. `'200px'`, `'20rem'`)                                                 |
| `wrapLongLines`        | `boolean`                   | `false`       | Wrap long lines instead of horizontal scroll                                                       |
| `hideHeader`           | `boolean`                   | `false`       | Hide header (filename/language + copy button)                                                      |
| `hideCopyButton`       | `boolean`                   | `false`       | Hide only the copy button                                                                          |
| `highlightLines`       | `string` \| `number[]` \| … | —             | Lines to highlight (e.g. `'3,5-7'` or `[3,5,6,7]`)                                                 |
| `tabSize`              | `number`                    | `4`           | Indentation width (CSS tab-size)                                                                   |
| `collapsible`          | `boolean`                   | `false`       | Allow expand/collapse when lines exceed threshold                                                  |
| `collapsibleThreshold` | `number`                    | `20`          | Line count above which block becomes collapsible                                                   |
| `className`            | `string`                    | `''`          | Additional CSS classes for the wrapper element                                                     |

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

1. `.dark` or `.light` class on root element
2. Falls back to light mode

The surface colors (`--code-bg`, `--code-fg`) follow the shadcn design tokens (`--card`, `--foreground`) when present,
with standalone fallbacks baked in.

### Syntax design tokens

The syntax palette is exposed as `--syntax-*` design tokens. The package defaults (GitHub Light/Dark) are declared at
zero specificity via `:where(:root)`, so any declaration in your app (a plain `:root`/`.dark` block, a brand theme) wins
without `!important`:

```css
:root {
    --syntax-keyword: #cf222e;
    --syntax-string: #0a3069;
    --syntax-comment: #6e7781;
    --syntax-number: #0550ae;
    --syntax-title: #8250df; /* function/class names */
    --syntax-attr: #953800; /* variables, properties, attribute keys */
    --syntax-literal: #cf222e;
    --syntax-meta: #6e7781;
    --syntax-tag: #116329;
    --syntax-attribute: #0550ae;
    --syntax-deletion: #ff7b72; /* diff colors, mode-invariant */
    --syntax-addition: #7ee787;
}

.dark {
    --syntax-keyword: #ff7b72;
    /* ... etc */
}
```

The surface tokens can be overridden the same way:

```css
:root {
    --code-bg: hsl(var(--card, 0 0% 100%));
    --code-fg: hsl(var(--foreground, 222.2 84% 4.9%));
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
