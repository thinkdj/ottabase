// Rendered React (DocsLayout, DocsSidebar, MarkdownRenderer, TableOfContents) lives
// behind the isolated `@ottabase/docs/react` subpath so this `.` barrel stays UI-free.

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
