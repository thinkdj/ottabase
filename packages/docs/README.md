# @ottabase/docs

Minimal, reusable documentation viewer for Markdown files. Clean, Mantine-docs-inspired layout with left navigation,
content area, and right table of contents.

## Features

- 📄 Markdown rendering (headings, code blocks, tables, lists, links, images)
- 🗂️ Left sidebar with search and grouped navigation
- 📑 Right table of contents with scroll tracking
- 📱 Responsive with mobile drawer navigation
- 🌙 Dark mode support (system preference and `.dark` class)
- ⬅️➡️ Previous/Next page navigation
- 🎨 CSS custom properties for easy theming
- 📦 Zero runtime dependencies (only React peer dep)

## Installation

```bash
pnpm add @ottabase/docs
```

## Usage

```tsx
import { DocsLayout } from '@ottabase/docs';
import '@ottabase/docs/styles.css';

const config = {
    title: 'My Docs',
    basePath: '/docs',
    sources: [
        {
            label: 'Guides',
            basePath: 'guides',
            pages: [
                { slug: 'getting-started', title: 'Getting Started', content: '# Getting Started\n...' },
                { slug: 'configuration', title: 'Configuration', content: '# Configuration\n...' },
            ],
        },
    ],
};

function DocsPage() {
    const [activeSlug, setActiveSlug] = useState('guides/getting-started');

    return <DocsLayout config={config} activeSlug={activeSlug} onNavigate={setActiveSlug} />;
}
```

## Configuration

```typescript
interface DocsConfig {
    title?: string; // Docs site title
    logo?: React.ReactNode; // Logo element
    basePath?: string; // Base URL path (e.g. "/docs")
    sources: DocsSource[]; // Documentation sources
}

interface DocsSource {
    label: string; // Sidebar group label
    basePath?: string; // URL prefix for pages
    order?: number; // Sort order
    pages: DocPage[]; // Pre-loaded pages
}

interface DocPage {
    slug: string; // URL-friendly identifier
    title: string; // Display title
    content: string; // Raw markdown content
    group?: string; // Optional sub-group
    order?: number; // Sort order within group
}
```

## Theming

Override CSS custom properties to match your app's design:

```css
:root {
    --otta-docs-color-primary: #228be6;
    --otta-docs-color-bg: #ffffff;
    --otta-docs-color-text: #212529;
    --otta-docs-sidebar-width: 260px;
    --otta-docs-toc-width: 220px;
}
```
