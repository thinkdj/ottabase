/** A single documentation page entry */
export interface DocPage {
    /** URL-friendly slug (e.g. "getting-started") */
    slug: string;
    /** Display title */
    title: string;
    /** Raw markdown/MDX content, or a lazily evaluated async function that returns it */
    content: string | (() => Promise<string | { default: string }>);
    /** Optional group/category for sidebar organization */
    group?: string;
    /** Sort order within group (lower = first) */
    order?: number;
    /** Source path for reference */
    sourcePath?: string;
}

/** A group of doc pages in the sidebar */
export interface DocGroup {
    /** Group label */
    label: string;
    /** Sort order (lower = first) */
    order: number;
    /** Pages within this group */
    pages: DocPage[];
}

/** Table of contents heading */
export interface TocItem {
    /** Heading ID for anchor links */
    id: string;
    /** Heading text */
    text: string;
    /** Heading level (2 = h2, 3 = h3) */
    level: number;
}

/** Source definition for docs - a directory or explicit list */
export interface DocsSource {
    /** Label for this source in the sidebar */
    label: string;
    /** Base path prefix for URLs (e.g. "guides") */
    basePath?: string;
    /** Sort order for sources (lower = first) */
    order?: number;
    /** Pre-loaded pages for this source */
    pages: DocPage[];
}

/** Layout theme names (colors come from Brand Kit) */
export type DocsTheme = 'compact' | 'standard' | 'spacious';

/** Code block rendering mode */
export type DocsCodeRenderMode =
    | 'plain' // Inline HTML, no React code block components
    | 'simple' // Built-in: copy button + lang label, no syntax highlighting
    | 'ui-code-highlight'; // Uses @ottabase/ui-code-highlight for uniformity

/** Configuration for the docs viewer */
export interface DocsConfig {
    /** Application or docs site title */
    title?: string;
    /** Logo element to render in sidebar header */
    logo?: React.ReactNode;
    /** Documentation sources */
    sources: DocsSource[];
    /** Base URL path (e.g. "/docs") */
    basePath?: string;
    /** Layout theme — 'compact' | 'standard' | 'spacious' */
    theme?: DocsTheme;
    /** Code block rendering: 'simple' or 'ui-code-highlight' (default) */
    codeRenderMode?: DocsCodeRenderMode;
}
