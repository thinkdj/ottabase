/**
 * @ottabase/ottablog/renderer — UI quarantine barrel
 *
 * Every RENDERED React surface of the blog engine lives behind this single subpath. Importing it
 * pulls in `@ottabase/ottarenderer` AND `@ottabase/medialibrary` (both peer dependencies, the
 * latter via PhotoJournalGallery's lightbox registration) plus CSS side effects, which is why the
 * pure package root (`@ottabase/ottablog`) never re-exports any of it.
 *
 * Both peers are marked `optional` in package.json, and that optionality is scoped to THIS
 * boundary: a consumer of the headless root needs neither, a consumer of this subpath needs both.
 * They are hard value-imports here, not guarded requires — skipping the install and then importing
 * `@ottabase/ottablog/renderer` is a module-resolution failure, by design.
 *
 * @example
 * ```tsx
 * import { BlogRenderer, initOttablog } from '@ottabase/ottablog/renderer';
 *
 * initOttablog({ defaultThemeId: 'default' });
 * <BlogRenderer post={post} showHeroImage showMetadata />;
 * ```
 */

// Rendered components
export { BlurbRenderer, BlurbText, BlogExcerptCard, BlogRenderer } from './components/BlogRenderer';
export { BlurbCard } from './components/BlurbCard';
export type { BlurbCardProps } from './components/BlurbCard';
export { PhotoJournalGallery } from './components/PhotoJournalGallery';
export type { PhotoJournalGalleryProps } from './components/PhotoJournalGallery';
export { PhotoJournalRenderer } from './components/PhotoJournalRenderer';
export { BlogRendererErrorBoundary } from './components/BlogRendererErrorBoundary';

// Built-in rendered themes (value-import @ottabase/ottarenderer)
export { defaultTheme } from './themes/default';
export { minimalTheme } from './themes/minimal';

// Initialization (registers + activates the rendered themes)
export { initOttablog } from './init';

// Blog-renderer prop/data types, re-exported here for convenience alongside the components.
export type {
    BlurbRendererProps,
    BlogExcerptCardProps,
    BlogPostData,
    BlogRendererProps,
    PhotoJournalRendererProps,
} from './components/blog-renderer-types';
