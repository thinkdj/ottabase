# @ottabase/ui-code-highlight — agent notes

Read-only React code block with highlight.js syntax coloring, copy button, line numbers, and light/dark theming. Full docs: ./README.md

## Use when

- Rendering read-only code snippets in React UIs (filename header, copy-to-clipboard, line numbers/highlighting, collapsible long blocks).
- NOT an editor — no editing or diffing. Only ~12 common languages are registered (js/ts/tsx, html/xml, css/scss, json, bash/sh, sql, python, markdown, ini/toml, plaintext); anything else falls back to escaped plaintext.

## Imports

```ts
import { CodeBlock, type CodeBlockProps } from '@ottabase/ui-code-highlight';
import '@ottabase/ui-code-highlight/styles.css'; // once, globally — required
```

## Canonical usage

```tsx
<CodeBlock code={snippet} language='typescript' filename='example.ts' />
```

```tsx
<CodeBlock
    code={sql}
    language='sql'
    showLineNumbers
    lineNumberStart={10}
    highlightLines='3,5-7'
    maxHeight='400px'
    collapsible
    collapsibleThreshold={20}
/>
```

## Gotchas

- styles.css must be imported once or the component renders unstyled; if PostCSS chokes on the package subpath, import the relative path to `src/styles.css` instead.
- Dark theme keys off a `.dark` class on a root element (repo theming convention), not `prefers-color-scheme`.
- Highlighted HTML is sanitized via `sanitizeBlockHtml` from `@ottabase/utils/sanitize` before `dangerouslySetInnerHTML` — keep that if touching render code.
- `highlightLines` accepts `'3,5-7'`, `[3, 5]`, or `[{ start: 5, end: 7 }]`; it only shows when `showLineNumbers` is on (highlight styling attaches to line numbers).
- Client component (`'use client'`); peer deps react/react-dom/lucide-react (catalog:), internal dep @ottabase/utils (workspace:*).
