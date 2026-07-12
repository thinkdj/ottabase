# @ottabase/docs — agent notes

React Markdown docs-site viewer (sidebar nav, search, TOC, prev/next, layout themes). Full docs: ./README.md

## Use when

- Rendering a docs section inside a React app from Markdown strings (e.g. Vite `import.meta.glob` of `.md` files).
- NOT a static-site generator or standalone Markdown parser; requires React and content supplied as strings (or async loaders).

## Imports

```tsx
import { DocsLayout, DocsSidebar, MarkdownRenderer, TableOfContents, useDocs } from '@ottabase/docs';
import { buildPageSlug, extractTitle, extractToc, fileNameToSlug, findPageBySlug, organizePages, slugToTitle } from '@ottabase/docs'; // utils
import type { DocsConfig, DocsSource, DocPage, DocGroup, DocsTheme, DocsCodeRenderMode, TocItem } from '@ottabase/docs';
import '@ottabase/docs/styles.css'; // required — components are unstyled without it
```

## Canonical usage

```tsx
const config: DocsConfig = {
    title: 'My Docs',
    basePath: '/docs',
    theme: 'standard', // 'compact' | 'standard' | 'spacious'
    codeRenderMode: 'ui-code-highlight', // 'plain' | 'simple' | 'ui-code-highlight'
    sources: [
        {
            label: 'Guides',
            basePath: 'guides',
            pages: [{ slug: 'getting-started', title: 'Getting Started', content: '# Getting Started\n...' }],
        },
    ],
};

const [activeSlug, setActiveSlug] = useState('guides/getting-started');
<DocsLayout config={config} activeSlug={activeSlug} onNavigate={setActiveSlug} />;
```

## Gotchas

- `@ottabase/ui-code-highlight` is an optional peer (`workspace:*`); required only for `codeRenderMode: 'ui-code-highlight'`.
- Colors come from Brand Kit CSS vars; themes control layout density only.
- User theme switch persists to localStorage key `'ottabase.docs.theme'` and overrides `config.theme` afterwards.
- `DocPage.content` can be a string or async `() => Promise<string | { default: string }>` for lazy loading.
