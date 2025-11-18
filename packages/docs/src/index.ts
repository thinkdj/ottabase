// Main exports
export { DocsProvider, useDocsContext } from './DocsContext';
export type { DocsProviderProps } from './DocsContext';

// Components
export { DocsLayout } from './components/DocsLayout';
export type { DocsLayoutProps } from './components/DocsLayout';
export { Sidebar } from './components/Sidebar';
export { MarkdownContent } from './components/MarkdownContent';
export { TableOfContents } from './components/TableOfContents';

// Types
export type {
  DocItem,
  DocGroup,
  DocFrontmatter,
  DocContent,
  SidebarConfig,
  DocsConfig,
  Heading,
} from './types';

// Utilities
export { parseMarkdown, extractHeadings, generateSlug, formatTitle } from './utils/markdown';
