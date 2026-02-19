// Components
export { DocsLayout } from './components/DocsLayout';
export type { DocsLayoutProps } from './components/DocsLayout';
export { DocsSidebar } from './components/DocsSidebar';
export { MarkdownRenderer, TableOfContents } from './components/MarkdownRenderer';

// Hooks
export { useDocs } from './hooks/useDocs';
export type { UseDocsOptions } from './hooks/useDocs';

// Types
export type { DocGroup, DocPage, DocsConfig, DocsSource, DocsTheme, DocsCodeRenderMode, TocItem } from './types';

// Utils
export {
    buildPageSlug,
    extractTitle,
    extractToc,
    fileNameToSlug,
    findPageBySlug,
    organizePages,
    slugToTitle,
} from './utils';
