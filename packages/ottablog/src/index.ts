/**
 * @ottabase/ottablog
 *
 * Blog and content management system for Ottabase apps.
 * Supports blog posts, changelogs, documentation, and more.
 *
 * Features:
 * - Multiple content types (blog, changelog, docs, news, announcement)
 * - EditorJS integration via OttaEditor
 * - SEO metadata support
 * - Hero images with Cloudflare Images integration
 * - Categories with hierarchy support
 * - Tags with many-to-many relationships
 * - Multi-app database sharing via appId
 * - Reading time calculation
 * - Slug generation
 *
 * @example
 * ```typescript
 * import {
 *   postsTable,
 *   categoriesTable,
 *   blogTagsTable,
 *   generateSlug,
 *   calculateReadingTime,
 *   CONTENT_TYPES,
 * } from "@ottabase/ottablog";
 * ```
 */

// Models + schema exports (fat models)
export {
  PostSeries,
  seriesTable,
  PostCategory,
  categoriesTable,
  BlogTag,
  blogTagsTable,
  Post,
  postsTable,
  PostTag,
  postTagsTable,
  PostVersion,
  postVersionsTable,
} from "./models";

// Type exports from models
export type {
  Series,
  NewSeries,
  Category,
  NewCategory,
  BlogTag,
  NewBlogTag,
  Post,
  NewPost,
  PostTag,
  NewPostTag,
  PostVersion,
  NewPostVersion,
  PostSeriesType,
  NewPostSeriesType,
  PostCategoryType,
  NewPostCategoryType,
  BlogTagType,
  NewBlogTagType,
  PostType,
  NewPostType,
  PostVersionType,
  NewPostVersionType,
} from "./models";

// Type exports
export type {
  ContentType,
  PostStatus,
  SeoMeta,
  HeroImage,
  Author,
  EditorJSData,
  ReadingTime,
} from "./types";

// Constants and helpers
export {
  CONTENT_TYPES,
  POST_STATUSES,
  DEFAULT_SEO_META,
  calculateReadingTime,
  generateSlug,
  extractExcerpt,
} from "./types";

// Components (React)
export { BlogRenderer, BlogExcerptCard } from "./components/BlogRenderer";
export type {
  BlogPostData,
  BlogRendererProps,
  BlogExcerptCardProps,
} from "./components/BlogRenderer";
