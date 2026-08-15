/**
 * @ottabase/ottablog - Blog Renderer Types (pure)
 *
 * Prop/data contracts for the blog renderer and excerpt card. These are consumed as type-only
 * shapes by pure modules (theme types, plugin types, the plugin content injector) as well as by
 * the rendered `BlogRenderer.tsx`. Keeping them here — free of any `@ottabase/ottarenderer` or
 * React runtime import — lets the pure package root reference them without pulling in rendered UI.
 */

import type React from 'react';
import type {
    ContentType,
    EditorJSData,
    HeroImage,
    PhotoJournalItem,
    PostAuthor,
    PostCrosspost,
    SeoMeta,
} from '../types';

export interface BlogPostData {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    /** First-class plain-text body for short-form thoughts. */
    blurbText?: string | null;
    /** The same post elsewhere — Instagram, X, Facebook. See `PostCrosspost`. */
    crossposts?: PostCrosspost[] | null;
    /** Optional short introduction for a photo-first post. */
    photoNote?: string | null;
    /** Ordered photographs for a photo journal. */
    photoAlbum?: PhotoJournalItem[] | null;
    content?: EditorJSData | null;
    contentType?: ContentType;
    status?: string;
    heroImage?: HeroImage | null;
    seoMeta?: SeoMeta | null;
    footnotes?: EditorJSData | null;
    authorId?: string | null;
    /** Author from User relationship */
    author?: PostAuthor | null;
    readingTimeMinutes?: number | null;
    wordCount?: number | null;
    isFeatured?: boolean;
    publishedAt?: Date | string | number | null;
    createdAt?: Date | string | number | null;
    // Series info
    seriesId?: string | null;
    seriesOrder?: number | null;
    seriesTitle?: string | null;
    seriesTotalParts?: number | null;
    /** Password protection: when true, full content is hidden until unlocked */
    isProtected?: boolean;
    /** Optional hint shown on the lock screen (never expose passwordHash) */
    passwordHint?: string | null;
}

export interface BlogRendererProps {
    /** The blog post data to render */
    post: BlogPostData;
    /** Whether to show the hero image */
    showHeroImage?: boolean;
    /** Whether to show the title */
    showTitle?: boolean;
    /** Whether to show metadata (author, date, reading time) */
    showMetadata?: boolean;
    /** Whether to show the excerpt */
    showExcerpt?: boolean;
    /** Whether to show footnotes */
    showFootnotes?: boolean;
    /** Whether to show series navigation */
    showSeries?: boolean;
    /** Custom class name for the container */
    className?: string;
    /** Custom class name for the content area */
    contentClassName?: string;
    /** Custom date formatter */
    formatDate?: (date: Date | string | number) => string;
    /** Render custom header above the title */
    renderHeader?: () => React.ReactNode;
    /** Render custom footer below the content */
    renderFooter?: () => React.ReactNode;
    /** Render series navigation */
    renderSeriesNav?: (post: BlogPostData) => React.ReactNode;
    /** On author click */
    onAuthorClick?: (authorId: string) => void;
    /** Theme ID to use (defaults to active theme) */
    themeId?: string;
    /** Disable hooks (for testing) */
    disableHooks?: boolean;
}

export interface BlogExcerptCardProps {
    post: BlogPostData;
    showHeroImage?: boolean;
    showExcerpt?: boolean;
    showMetadata?: boolean;
    className?: string;
    formatDate?: (date: Date | string | number) => string;
    onClick?: () => void;
    href?: string;
    LinkComponent?: React.ComponentType<{
        href: string;
        className?: string;
        children: React.ReactNode;
    }>;
    /** Theme ID override (defaults to active theme) */
    themeId?: string;
}

export interface BlurbRendererProps extends BlogRendererProps {
    /** Detail renders a permalink; timeline renders the compact interleaved form. */
    variant?: 'detail' | 'timeline';
}

export interface PhotoJournalRendererProps extends BlogRendererProps {
    /** Detail renders the full contact sheet; timeline renders a compact cover collage. */
    variant?: 'detail' | 'timeline';
}
