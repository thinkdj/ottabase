/**
 * @ottabase/ottablog - Theme System Types
 */

import type { ReactNode } from 'react';
import type { BlogPostData, BlogRendererProps } from '../components/BlogRenderer';

/**
 * Theme metadata
 */
export interface ThemeMetadata {
    /** Unique theme identifier */
    id: string;
    /** Theme name */
    name: string;
    /** Theme description */
    description?: string;
    /** Theme version */
    version?: string;
    /** Theme author */
    author?: string;
    /** Theme URL */
    url?: string;
    /** Theme screenshot URL */
    screenshot?: string;
    /** Theme tags */
    tags?: string[];
}

/**
 * Theme renderer functions
 */
export interface ThemeRenderers {
    /** Render post header */
    renderHeader?: (post: BlogPostData, props: BlogRendererProps) => ReactNode;
    /** Render hero image */
    renderHero?: (post: BlogPostData, props: BlogRendererProps) => ReactNode;
    /** Render title */
    renderTitle?: (post: BlogPostData, props: BlogRendererProps) => ReactNode;
    /** Render metadata (author, date, reading time) */
    renderMetadata?: (post: BlogPostData, props: BlogRendererProps) => ReactNode;
    /** Render excerpt */
    renderExcerpt?: (post: BlogPostData, props: BlogRendererProps) => ReactNode;
    /** Render main content */
    renderContent?: (post: BlogPostData, props: BlogRendererProps) => ReactNode;
    /** Render footnotes */
    renderFootnotes?: (post: BlogPostData, props: BlogRendererProps) => ReactNode;
    /** Render series navigation */
    renderSeries?: (post: BlogPostData, props: BlogRendererProps) => ReactNode;
    /** Render footer */
    renderFooter?: (post: BlogPostData, props: BlogRendererProps) => ReactNode;
    /** Render post card (for listings) */
    renderCard?: (post: BlogPostData, props: BlogRendererProps) => ReactNode;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
    /** CSS classes for various elements */
    classes?: {
        container?: string;
        header?: string;
        hero?: string;
        title?: string;
        metadata?: string;
        excerpt?: string;
        content?: string;
        footnotes?: string;
        series?: string;
        footer?: string;
        card?: string;
        /** Container class for archive/listing pages */
        archiveContainer?: string;
        /** Title class for archive page headers */
        archiveTitle?: string;
    };
}

/**
 * Complete theme definition
 */
export interface Theme {
    /** Theme metadata */
    metadata: ThemeMetadata;
    /** Theme renderers */
    renderers: ThemeRenderers;
    /** Theme configuration */
    config?: ThemeConfig;
}

/**
 * Theme registry interface
 */
export interface ThemeRegistry {
    /** Register a theme */
    register(theme: Theme): void;
    /** Get theme by ID */
    get(id: string): Theme | null;
    /** Get all themes */
    getAll(): Theme[];
    /** Set active theme */
    setActive(id: string): boolean;
    /** Get active theme */
    getActive(): Theme | null;
    /** Check if theme exists */
    has(id: string): boolean;
}
