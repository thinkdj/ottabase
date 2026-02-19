# @ottabase/docs

Minimal, reusable documentation viewer for Markdown files. Clean layout with left navigation, content area, and right
table of contents. Three built-in themes inspired by GitHub, Notion, and Mantine.

## Features

- 📄 Markdown rendering (headings, code blocks, tables, lists, links, images)
- 🗂️ Left sidebar with search and grouped navigation
- 📑 Right table of contents with scroll tracking
- 📱 Responsive with mobile drawer navigation
- 🌙 Dark mode support (system preference and `.dark` class)
- ⬅️➡️ Previous/Next page navigation
- 🎨 Three built-in themes: `default`, `github`, `notion`
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
    theme: 'github', // 'default' | 'github' | 'notion'
    enableCodeHighlight: true, // Adds copy button to code blocks
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

const config = { sources: [guides, packages], theme: 'github' };
```

## Configuration

```typescript
interface DocsConfig {
    title?: string; // Docs site title
    logo?: React.ReactNode; // Logo element for sidebar
    basePath?: string; // Base URL path (e.g. "/docs")
    theme?: 'default' | 'github' | 'notion'; // Built-in theme
    enableCodeHighlight?: boolean; // Copy button on code blocks
    sources: DocsSource[]; // Documentation sources
}
```

## Themes

Three built-in themes, all with dark mode support:

| Theme     | Style                                           | Inspiration  |
| --------- | ----------------------------------------------- | ------------ |
| `default` | Soft borders, rounded corners, blue accents     | Mantine docs |
| `github`  | Utilitarian, clean lines, blue links            | GitHub docs  |
| `notion`  | Warm, readable, large headings, red inline code | Notion       |

Set via config: `{ theme: 'github' }`. Override any CSS custom property for further customization.

## CSS Custom Properties

```css
:root {
    --otta-docs-color-primary: #228be6;
    --otta-docs-color-bg: #ffffff;
    --otta-docs-color-text: #212529;
    --otta-docs-sidebar-width: 260px;
    --otta-docs-toc-width: 220px;
    --otta-docs-content-max-width: 780px;
}
```
