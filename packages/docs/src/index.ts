// Main exports
export { DocsProvider, useDocsContext } from './DocsContext';
export type { DocsProviderProps } from './DocsContext';

// Components
export { DocsLayout } from './components/DocsLayout';
export type { DocsLayoutProps } from './components/DocsLayout';
export { Sidebar } from './components/Sidebar';
export { MarkdownContent } from './components/MarkdownContent';
export { TableOfContents } from './components/TableOfContents';
export { DocsSearch } from './components/DocsSearch';
export { Breadcrumbs } from './components/Breadcrumbs';
export { DocNavigation } from './components/DocNavigation';
export { CodeBlock } from './components/CodeBlock';
export { Callout } from './components/Callout';
export type { CalloutType } from './components/Callout';

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
export {
  parseMarkdown,
  extractHeadings,
  generateSlug,
  formatTitle,
} from './utils/markdown';

export {
  fileTreeToSidebarConfig,
  sortDocsByOrder,
  findAdjacentDocs,
  flattenSidebarConfig,
  generateBreadcrumbs,
} from './utils/files';

export type { FileNode } from './utils/files';

// Theme system
export { DocsThemeProvider, useDocsTheme } from './theme/ThemeProvider';
export type { DocsThemeProviderProps } from './theme/ThemeProvider';
export type {
  DocsTheme,
  DocsThemeTypography,
  DocsThemeSpacing,
  DocsThemeColors,
  DocsThemeRadius,
  DocsThemeShadows,
} from './theme/types';

// Theme presets
export { notionTheme } from './theme/presets/notion';
export { technicalTheme } from './theme/presets/technical';
