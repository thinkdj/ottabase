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
 * import { postsTable, categoriesTable, tagsTable } from "@ottabase/ottablog/schema";
 * import { generateSlug, calculateReadingTime, CONTENT_TYPES } from "@ottabase/ottablog";
 * ```
 */

// Schema exports
export {
  categoriesTable,
  tagsTable,
  postsTable,
  postTagsTable,
} from "./schema";

// Type exports from schema
export type {
  Category,
  NewCategory,
  Tag,
  NewTag,
  Post,
  NewPost,
  PostTag,
  NewPostTag,
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
