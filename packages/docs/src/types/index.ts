/** A single documentation page entry */
export interface DocPage {
    /** URL-friendly slug (e.g. "getting-started") */
    slug: string;
    /** Display title */
    title: string;
    /** Raw markdown/MDX content */
    content: string;
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

/** Built-in theme names */
export type DocsTheme = 'default' | 'github' | 'notion';

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
    /** Theme name — 'default' | 'github' | 'notion' */
    theme?: DocsTheme;
    /** Whether to enable built-in code highlighting with copy buttons */
    enableCodeHighlight?: boolean;
}
