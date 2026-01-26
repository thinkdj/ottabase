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
 *   tagsTable,
 *   generateSlug,
 *   calculateReadingTime,
 *   CONTENT_TYPES,
 * } from "@ottabase/ottablog";
 * ```
 */

// Schema exports
export {
  seriesTable,
  categoriesTable,
  tagsTable,
  postsTable,
  postTagsTable,
  postVersionsTable,
} from "./schema";

// Type exports from schema
export type {
  Series,
  NewSeries,
  Category,
  NewCategory,
  Tag,
  NewTag,
  Post,
  NewPost,
  PostTag,
  NewPostTag,
  PostVersion,
  NewPostVersion,
} from "./schema";

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
