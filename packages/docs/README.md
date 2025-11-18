# @ottabase/docs

A minimal, clean documentation package for ottabase and your apps. Built with Mantine UI and designed to look like Notion.

## Features

- 🎨 Clean, Notion-like design
- 📱 Responsive layout with mobile support
- 🎯 Built-in code highlighting using `@ottabase/ui-code-highlight`
- 📖 Markdown support with GitHub Flavored Markdown (GFM)
- 🔍 Automatic table of contents generation
- 🎭 Dark/light mode support (via Mantine)
- 🔧 Easy to configure and customize
- 📦 TypeScript support out of the box

## Installation

```bash
pnpm add @ottabase/docs
```

Make sure you have the peer dependencies installed:

```bash
pnpm add @mantine/core @mantine/hooks react react-dom
```

## Quick Start

### Basic Usage

```tsx
import { DocsProvider, DocsLayout } from '@ottabase/docs';
import { MantineProvider } from '@mantine/core';

const config = {
  title: 'My Documentation',
  docsDir: './docs',
  sidebarConfig: {
    groups: [
      {
        title: 'Getting Started',
        items: [
          { title: 'Introduction', slug: 'introduction', path: '/docs/introduction.md' },
          { title: 'Installation', slug: 'installation', path: '/docs/installation.md' },
        ],
      },
      {
        title: 'Guides',
        items: [
          { title: 'Quick Start', slug: 'quick-start', path: '/docs/quick-start.md' },
          { title: 'Advanced Usage', slug: 'advanced', path: '/docs/advanced.md' },
        ],
      },
    ],
  },
};

function App() {
  return (
    <MantineProvider>
      <DocsProvider config={config}>
        <DocsLayout />
      </DocsProvider>
    </MantineProvider>
  );
}
```

### With Initial Document

```tsx
import { parseMarkdown } from '@ottabase/docs';

const markdownContent = `---
title: Introduction
description: Get started with our documentation
---

# Introduction

Welcome to the documentation!
`;

const initialDoc = parseMarkdown(markdownContent, 'introduction');

<DocsProvider config={config} initialDoc={initialDoc}>
  <DocsLayout />
</DocsProvider>
```

### Custom Header

```tsx
import { DocsLayout } from '@ottabase/docs';
import { Group, Image, Text } from '@mantine/core';

const customHeader = (
  <Group>
    <Image src="/logo.png" h={30} w={30} />
    <Text size="lg" fw={700}>My Docs</Text>
  </Group>
);

<DocsLayout header={customHeader} />
```

## API Reference

### DocsProvider

The main provider component that manages documentation state.

**Props:**

- `config: DocsConfig` - Configuration object for the docs
- `initialDoc?: DocContent` - Optional initial document to display
- `children: ReactNode` - Child components

### DocsLayout

The main layout component that renders the documentation UI.

**Props:**

- `header?: ReactNode` - Custom header content (default: shows logo and title from config)
- `showTableOfContents?: boolean` - Show/hide table of contents (default: `true`)
- `maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'` - Maximum width of content area (default: `'lg'`)

### DocsConfig

Configuration object for the documentation.

```typescript
interface DocsConfig {
  docsDir: string;              // Directory containing markdown files
  sidebarConfig?: SidebarConfig; // Sidebar navigation configuration
  title?: string;                // Documentation title
  logo?: React.ReactNode;        // Logo component
  defaultTheme?: 'light' | 'dark'; // Default theme
  showTableOfContents?: boolean; // Show table of contents
}
```

### SidebarConfig

Configuration for the sidebar navigation.

```typescript
interface SidebarConfig {
  groups?: DocGroup[];  // Grouped navigation items
  items?: DocItem[];    // Flat list of navigation items
}

interface DocGroup {
  title: string;
  items: DocItem[];
  collapsed?: boolean;  // Initially collapsed?
}

interface DocItem {
  title: string;
  slug: string;
  path: string;
  order?: number;
}
```

### Utilities

#### parseMarkdown

Parse markdown content with frontmatter.

```typescript
function parseMarkdown(markdown: string, slug: string): DocContent
```

#### extractHeadings

Extract headings from markdown for table of contents.

```typescript
function extractHeadings(markdown: string): Heading[]
```

#### generateSlug

Generate a URL-friendly slug from a file path.

```typescript
function generateSlug(filePath: string): string
```

#### formatTitle

Format a file name into a readable title.

```typescript
function formatTitle(fileName: string): string
```

## Markdown Features

The package supports:

- **Headings** (H1-H6)
- **Paragraphs** and **Text**
- **Links** (internal and external)
- **Lists** (ordered and unordered)
- **Code blocks** with syntax highlighting
- **Inline code**
- **Blockquotes**
- **Tables**
- **Images**
- **Horizontal rules**
- **GitHub Flavored Markdown** (GFM)

### Frontmatter

Add metadata to your markdown files:

```markdown
---
title: My Document
description: A brief description
order: 1
---

# Content starts here
```

## Styling

The package uses Mantine components and respects your Mantine theme. You can customize the appearance by:

1. **Mantine Theme**: Customize via `MantineProvider`
2. **CSS Variables**: Override Mantine CSS variables
3. **Custom Components**: Pass custom header, logo, etc.

## Examples

### Next.js App Router

```tsx
// app/docs/layout.tsx
import { DocsProvider } from '@ottabase/docs';
import { MantineProvider } from '@mantine/core';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const config = {
    title: 'Documentation',
    docsDir: './docs',
    // ... sidebar config
  };

  return (
    <MantineProvider>
      <DocsProvider config={config}>
        {children}
      </DocsProvider>
    </MantineProvider>
  );
}

// app/docs/page.tsx
import { DocsLayout } from '@ottabase/docs';

export default function DocsPage() {
  return <DocsLayout />;
}
```

### Dynamic Markdown Loading

```tsx
import { useState, useEffect } from 'react';
import { DocsProvider, DocsLayout, parseMarkdown } from '@ottabase/docs';

function DocsApp() {
  const [currentDoc, setCurrentDoc] = useState(null);

  useEffect(() => {
    // Load markdown from API or file system
    fetch('/api/docs/introduction')
      .then(res => res.text())
      .then(markdown => {
        const doc = parseMarkdown(markdown, 'introduction');
        setCurrentDoc(doc);
      });
  }, []);

  return (
    <DocsProvider config={config} initialDoc={currentDoc}>
      <DocsLayout />
    </DocsProvider>
  );
}
```

## License

MIT
