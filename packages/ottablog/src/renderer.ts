/**
 * @ottabase/ottablog/renderer — UI quarantine barrel
 *
 * Every RENDERED React surface of the blog engine lives behind this single subpath. Importing it
 * pulls in `@ottabase/ottarenderer` (a peer dependency) and CSS side effects, which is why the
 * pure package root (`@ottabase/ottablog`) never re-exports any of it.
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
export { BlogExcerptCard, BlogRenderer } from './components/BlogRenderer';
export { BlogRendererErrorBoundary } from './components/BlogRendererErrorBoundary';

// Built-in rendered themes (value-import @ottabase/ottarenderer)
export { defaultTheme } from './themes/default';
export { minimalTheme } from './themes/minimal';

// Initialization (registers + activates the rendered themes)
export { initOttablog } from './init';

// Blog-renderer prop/data types, re-exported here for convenience alongside the components.
export type { BlogExcerptCardProps, BlogPostData, BlogRendererProps } from './components/blog-renderer-types';
