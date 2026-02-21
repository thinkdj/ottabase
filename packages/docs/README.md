# @ottabase/docs

Minimal, reusable documentation viewer for Markdown files. Clean layout with left navigation, content area, and right
table of contents. Colors from Brand Kit; layout themes control spacing and density.

## Features

- 📄 Markdown rendering (headings, code blocks, tables, lists, links, images)
- 🗂️ Left sidebar with search and grouped navigation
- 📑 Right table of contents with scroll tracking
- 📱 Responsive with mobile drawer navigation
- 🌙 Dark mode via Brand Kit
- ⬅️➡️ Previous/Next page navigation
- 🎨 Three layout themes: `compact`, `standard`, `spacious` (colors from Brand Kit) with subtle sidebar switcher
- 📋 Enhanced code blocks with copy-to-clipboard
- 🔌 Extensible — CSS custom properties and composable config for easy customization
- 📦 Zero required runtime dependencies (only React peer dep)

## Installation

```bash
pnpm add @ottabase/docs
```

## Quick Start

```tsx
import { useState } from 'react';
import { DocsLayout } from '@ottabase/docs';
import '@ottabase/docs/styles.css';

const config = {
    title: 'My Docs',
    basePath: '/docs',
    theme: 'standard', // 'compact' | 'standard' | 'spacious'
    codeRenderMode: 'ui-code-highlight', // 'plain' | 'simple' | 'ui-code-highlight' (default)
    sources: [
        {
            label: 'Guides',
            basePath: 'guides',
            pages: [{ slug: 'getting-started', title: 'Getting Started', content: '# Getting Started\n...' }],
        },
    ],
};

function DocsPage() {
    const [activeSlug, setActiveSlug] = useState('guides/getting-started');
    return <DocsLayout config={config} activeSlug={activeSlug} onNavigate={setActiveSlug} />;
}
```

## Loading Markdown with Vite

Use `import.meta.glob` to load `.md` files at build time:

```typescript
import { createDocsSource, createPackageSource } from './docs.config';

// Load guides from a docs/ directory
const guidesModules = import.meta.glob('/../../docs/*.md', {
    eager: true,
    query: '?raw',
    import: 'default',
});
const guides = createDocsSource('Guides', guidesModules, { basePath: 'guides' });

// Load package READMEs (toggle on/off)
const packageModules = import.meta.glob('/../../packages/*/README.md', {
    eager: true,
    query: '?raw',
    import: 'default',
});
const packages = createPackageSource(packageModules, { prefix: '@ottabase/' });

const config = { sources: [guides, packages], theme: 'standard', codeRenderMode: 'ui-code-highlight' };
```

## Configuration

```typescript
interface DocsConfig {
    title?: string; // Docs site title
    logo?: React.ReactNode; // Logo element for sidebar
    basePath?: string; // Base URL path (e.g. "/docs")
    theme?: 'compact' | 'standard' | 'spacious'; // Layout theme
    codeRenderMode?: 'plain' | 'simple' | 'ui-code-highlight'; // Code block rendering
    sources: DocsSource[]; // Documentation sources
}
```

## Layout Themes

Three layout themes (colors come from Brand Kit):

| Theme      | Layout                                         |
| ---------- | ---------------------------------------------- |
| `compact`  | Narrow sidebar & content, tight spacing, dense |
| `standard` | Balanced widths, comfortable spacing (default) |
| `spacious` | Wide content, generous whitespace, larger type |

Set via config: `{ theme: 'standard' }` (default before user choice). A subtle switcher (− · +) at the bottom of the
sidebar lets users change layout at runtime; selection persists in `localStorage` under `ottabase.docs.theme`. Colors
use `--background`, `--primary`, `--muted`, etc. from Brand Kit.

## Code Render Modes

| Mode                          | Description                                                                |
| ----------------------------- | -------------------------------------------------------------------------- |
| `plain`                       | Inline HTML, no copy buttons or syntax highlighting                        |
| `simple`                      | Copy button + language label, no syntax highlighting                       |
| `ui-code-highlight` (default) | Uses @ottabase/ui-code-highlight for highlight.js + copy (install as peer) |

## CSS Custom Properties

Layout vars (override per theme):

```css
--otta-docs-sidebar-width: 240px;
--otta-docs-toc-width: 200px;
--otta-docs-content-max-width: 720px;
--otta-docs-radius: 3px;
```
