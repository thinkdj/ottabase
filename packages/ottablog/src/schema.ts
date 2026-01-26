import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Series table - group related posts into a series
 *
 * Perfect for multi-part tutorials, article series, or themed collections
 */
export const seriesTable = sqliteTable(
  "blog_series",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Series title
    title: text("title").notNull(),

    // URL-friendly slug
    slug: text("slug").notNull(),

    // Series description
    description: text("description"),

    // Cover image for the series
    coverImage: text("cover_image", { mode: "json" }).$type<{
      url: string;
      alt?: string;
    }>(),

    // Whether the series is complete or ongoing
    isComplete: integer("is_complete", { mode: "boolean" }).notNull().default(false),

    // Display order in series listings
    sortOrder: integer("sort_order").notNull().default(0),

    // App identifier for multi-app database sharing
    appId: text("app_id"),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),

    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("blog_series_slug_idx").on(table.slug),
    index("blog_series_app_id_idx").on(table.appId),
  ]
);

/**
 * Categories table - hierarchical content organization
 *
 * Supports nested categories via parentId for docs/guides structure
 */
export const categoriesTable = sqliteTable(
  "blog_categories",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Category name
    name: text("name").notNull(),

    // URL-friendly slug
    slug: text("slug").notNull(),

    // Optional description
    description: text("description"),

    // Parent category for hierarchy (null = root category)
    parentId: text("parent_id"),

    // Display order within parent
    sortOrder: integer("sort_order").notNull().default(0),

    // App identifier for multi-app database sharing
    appId: text("app_id"),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),

    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("blog_categories_slug_idx").on(table.slug),
    index("blog_categories_app_id_idx").on(table.appId),
    index("blog_categories_parent_id_idx").on(table.parentId),
  ]
);

/**
 * Tags table - flexible content labeling
 */
export const tagsTable = sqliteTable(
  "blog_tags",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Tag name
    name: text("name").notNull(),

    // URL-friendly slug
    slug: text("slug").notNull(),

    // Optional color for UI display (hex)
    color: text("color"),

    // App identifier for multi-app database sharing
    appId: text("app_id"),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("blog_tags_slug_idx").on(table.slug),
    index("blog_tags_app_id_idx").on(table.appId),
  ]
);

/**
 * Posts table - main content storage
 *
 * Supports multiple content types: blog, changelog, docs, news, announcement
 * Uses EditorJS format for rich content via OttaEditor
 */
export const postsTable = sqliteTable(
  "blog_posts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Post title
    title: text("title").notNull(),

    // URL-friendly slug (unique per appId)
    slug: text("slug").notNull(),

    // Short excerpt/summary (auto-generated or manual)
    excerpt: text("excerpt"),

    // Main content as EditorJS JSON
    content: text("content", { mode: "json" }).$type<{
      time?: number;
      blocks: Array<{ id?: string; type: string; data: Record<string, unknown> }>;
      version?: string;
    }>(),

    // Content type: blog, changelog, docs, news, announcement
    contentType: text("content_type").notNull().default("blog"),

    // Publication status: draft, published, archived, scheduled
    status: text("status").notNull().default("draft"),

    // Category reference
    categoryId: text("category_id"),

    // Series reference (for multi-part content)
    seriesId: text("series_id"),

    // Order within the series (1, 2, 3, etc.)
    seriesOrder: integer("series_order"),

    // Hero/featured image as JSON
    heroImage: text("hero_image", { mode: "json" }).$type<{
      url: string;
      alt?: string;
      caption?: string;
      cfImageId?: string;
      width?: number;
      height?: number;
      focalPoint?: { x: number; y: number };
    }>(),

    // SEO metadata as JSON
    seoMeta: text("seo_meta", { mode: "json" }).$type<{
      title?: string;
      description?: string;
      keywords?: string[];
      canonicalUrl?: string;
      ogImage?: string;
      ogType?: string;
      twitterCard?: string;
      noIndex?: boolean;
      noFollow?: boolean;
    }>(),

    // Private notes (author-only, not shown publicly) - EditorJS JSON format
    privateNotes: text("private_notes", { mode: "json" }).$type<{
      time?: number;
      blocks: Array<{ id?: string; type: string; data: Record<string, unknown> }>;
      version?: string;
    }>(),

    // Public footnotes/endnotes - EditorJS JSON format
    footnotes: text("footnotes", { mode: "json" }).$type<{
      time?: number;
      blocks: Array<{ id?: string; type: string; data: Record<string, unknown> }>;
      version?: string;
    }>(),

    // Author information
    authorId: text("author_id"),
    authorName: text("author_name"),
    authorEmail: text("author_email"),
    authorAvatar: text("author_avatar"),

    // Reading time estimate (stored for performance)
    readingTimeMinutes: integer("reading_time_minutes"),
    wordCount: integer("word_count"),

    // Featured/pinned post
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),

    // Allow comments
    allowComments: integer("allow_comments", { mode: "boolean" }).notNull().default(true),

    // View count
    viewCount: integer("view_count").notNull().default(0),

    // Scheduled publish date (for scheduled posts)
    publishAt: integer("publish_at", { mode: "timestamp" }),

    // Actual publish date (editorial/display date)
    publishedAt: integer("published_at", { mode: "timestamp" }),

    // When post was actually made live (system timestamp)
    postedAt: integer("posted_at", { mode: "timestamp" }),

    // App identifier for multi-app database sharing
    appId: text("app_id"),

    // Version retention setting (null = keep all, 1-10 = keep last N versions)
    maxVersionsToKeep: integer("max_versions_to_keep"),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),

    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("blog_posts_slug_idx").on(table.slug),
    index("blog_posts_status_idx").on(table.status),
    index("blog_posts_content_type_idx").on(table.contentType),
    index("blog_posts_category_id_idx").on(table.categoryId),
    index("blog_posts_series_id_idx").on(table.seriesId),
    index("blog_posts_author_id_idx").on(table.authorId),
    index("blog_posts_app_id_idx").on(table.appId),
    index("blog_posts_published_at_idx").on(table.publishedAt),
    index("blog_posts_is_featured_idx").on(table.isFeatured),
  ]
);

/**
 * Post-Tags junction table for many-to-many relationship
 */
export const postTagsTable = sqliteTable(
  "blog_post_tags",
  {
    postId: text("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),

    tagId: text("tag_id")
      .notNull()
      .references(() => tagsTable.id, { onDelete: "cascade" }),

    // When the tag was added
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index("blog_post_tags_post_id_idx").on(table.postId),
    index("blog_post_tags_tag_id_idx").on(table.tagId),
  ]
);

/**
 * Post Versions table - content versioning history
 *
 * Stores a snapshot of post content on each save for version history
 */
export const postVersionsTable = sqliteTable(
  "blog_post_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Reference to the post
    postId: text("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),

    // Version number (auto-incremented per post)
    versionNumber: integer("version_number").notNull(),

    // Snapshot of content at this version
    title: text("title").notNull(),
    content: text("content", { mode: "json" }).$type<{
      time?: number;
      blocks: Array<{ id?: string; type: string; data: Record<string, unknown> }>;
      version?: string;
    }>(),
    excerpt: text("excerpt"),
    privateNotes: text("private_notes", { mode: "json" }).$type<{
      time?: number;
      blocks: Array<{ id?: string; type: string; data: Record<string, unknown> }>;
      version?: string;
    }>(),
    footnotes: text("footnotes", { mode: "json" }).$type<{
      time?: number;
      blocks: Array<{ id?: string; type: string; data: Record<string, unknown> }>;
      version?: string;
    }>(),

    // Word count at this version
    wordCount: integer("word_count"),

    // Who made this change (optional)
    changedBy: text("changed_by"),

    // Optional change note/reason
    changeNote: text("change_note"),

    // When this version was created
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("blog_post_versions_post_id_idx").on(table.postId),
    index("blog_post_versions_version_number_idx").on(table.postId, table.versionNumber),
    index("blog_post_versions_created_at_idx").on(table.createdAt),
  ]
);

// Type exports
export type Series = typeof seriesTable.$inferSelect;
export type NewSeries = typeof seriesTable.$inferInsert;

export type Category = typeof categoriesTable.$inferSelect;
export type NewCategory = typeof categoriesTable.$inferInsert;

export type Tag = typeof tagsTable.$inferSelect;
export type NewTag = typeof tagsTable.$inferInsert;

export type Post = typeof postsTable.$inferSelect;
export type NewPost = typeof postsTable.$inferInsert;

export type PostTag = typeof postTagsTable.$inferSelect;
export type NewPostTag = typeof postTagsTable.$inferInsert;

export type PostVersion = typeof postVersionsTable.$inferSelect;
export type NewPostVersion = typeof postVersionsTable.$inferInsert;
