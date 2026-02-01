/**
 * Shared Blog Hooks
 *
 * Pre-configured model hooks for blog entities to avoid duplication across pages.
 */
import { createModelHooks } from '@ottabase/ottaorm/client';
import type { BlogCategory, BlogPost, BlogPostListItem, BlogPostVersion, BlogSeries, BlogTag } from '@/types/blog';

/**
 * Blog Post Hooks (full detail)
 */
export const blogPostHooks = createModelHooks<BlogPost>({ entityName: 'posts' });

/**
 * Blog Post Hooks (list view)
 */
export const blogPostListHooks = createModelHooks<BlogPostListItem>({ entityName: 'posts' });

/**
 * Blog Series Hooks
 */
export const blogSeriesHooks = createModelHooks<BlogSeries>({ entityName: 'series' });

/**
 * Blog Post Version Hooks
 */
export const blogPostVersionHooks = createModelHooks<BlogPostVersion>({ entityName: 'post_versions' });

/**
 * Blog Category Hooks
 */
export const blogCategoryHooks = createModelHooks<BlogCategory>({ entityName: 'categories' });

/**
 * Blog Tag Hooks
 */
export const blogTagHooks = createModelHooks<BlogTag>({ entityName: 'post_tags' });
