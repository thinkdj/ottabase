/**
 * BlogPost Model
 *
 * OttaORM model for blog posts using @ottabase/ottablog schema.
 * Supports multiple content types, SEO, hero images, and OttaEditor content.
 */
import { BaseModel, ModelFields } from "@ottabase/ottaorm";
import {
  calculateReadingTime,
  CONTENT_TYPES,
  extractExcerpt,
  generateSlug,
  POST_STATUSES,
  type ContentType,
  type EditorJSData,
  type PostStatus,
} from "../types";
import { PostTag } from "./PostTag";
import { postTagLinksTable } from "./PostTagLink";

/**
 * Posts table - main content storage
 */
/**
 * Posts table definition moved to PostTable.ts to avoid circular connection
 */
import { postsTable } from "./tables/PostTable";
export { postsTable };

export type NewPost = typeof postsTable.$inferInsert;

export type PostType = typeof postsTable.$inferSelect;
export type NewPostType = typeof postsTable.$inferInsert;

/**
 * Post Model - Fat Model Pattern
 */
export class Post extends BaseModel {
  static entity = "posts";
  static table = postsTable;
  static primaryKey = "id";

  static casts = {
    content: "json" as const,
    heroImage: "json" as const,
    seoMeta: "json" as const,
    privateNotes: "json" as const,
    footnotes: "json" as const,
    isFeatured: "boolean" as const,
    allowComments: "boolean" as const,
    viewCount: "number" as const,
    readingTimeMinutes: "number" as const,
    wordCount: "number" as const,
    seriesOrder: "number" as const,
    maxVersionsToKeep: "number" as const,
    createdAt: "date" as const,
    updatedAt: "date" as const,
    publishAt: "date" as const,
    publishedAt: "date" as const,
    postedAt: "date" as const,
  };

  protected static defaults = {
    status: "draft",
    contentType: "blog",
    isFeatured: false,
    allowComments: true,
    viewCount: 0,
  };

  protected static fields: ModelFields = {
    id: {
      type: "id",
      primaryKey: true,
      editable: false,
      uiConfig: {
        label: "ID",
      },
    },
    title: {
      type: "string",
      editable: true,
      searchable: true,
      sortable: true,
      uiConfig: {
        label: "Title",
        description: "Post title",
        placeholder: "Enter post title...",
      },
      formConfig: {
        visible: true,
        fieldType: "input",
      },
      tableConfig: {
        visible: true,
        colWidth: "auto",
      },
      validation: {
        rules: "required|min:3|max:200",
        messages: {
          required: "Title is required",
          min: "Title must be at least 3 characters",
          max: "Title must be less than 200 characters",
        },
      },
    },
    slug: {
      type: "string",
      editable: true,
      searchable: true,
      sortable: true,
      uiConfig: {
        label: "Slug",
        description: "URL-friendly identifier",
        placeholder: "auto-generated-from-title",
      },
      formConfig: {
        visible: true,
        fieldType: "input",
      },
      tableConfig: {
        visible: true,
        colWidth: 200,
      },
    },
    excerpt: {
      type: "string",
      editable: true,
      searchable: true,
      uiConfig: {
        label: "Excerpt",
        description: "Short summary (auto-generated if empty)",
        placeholder: "Brief description of the post...",
      },
      formConfig: {
        visible: true,
        fieldType: "textarea",
      },
      tableConfig: {
        visible: false,
      },
    },
    content: {
      type: "json",
      editable: true,
      uiConfig: {
        label: "Content",
        description: "Main post content (EditorJS format)",
      },
      formConfig: {
        visible: true,
        fieldType: "editor" as any,
      },
      tableConfig: {
        visible: false,
      },
    },
    contentType: {
      type: "string",
      editable: true,
      filterable: true,
      sortable: true,
      uiConfig: {
        label: "Content Type",
        description: "Type of content",
        defaultValue: "blog",
      },
      formConfig: {
        visible: true,
        fieldType: "select",
        options: Object.entries(CONTENT_TYPES).map(([value, { label }]) => ({
          label,
          value,
        })) as any,
      },
      tableConfig: {
        visible: true,
        colWidth: 120,
      },
    },
    status: {
      type: "string",
      editable: true,
      filterable: true,
      sortable: true,
      uiConfig: {
        label: "Status",
        description: "Publication status",
        defaultValue: "draft",
      },
      formConfig: {
        visible: true,
        fieldType: "select",
        options: Object.entries(POST_STATUSES).map(([value, { label }]) => ({
          label,
          value,
        })) as any,
      },
      tableConfig: {
        visible: true,
        colWidth: 100,
      },
    },
    categoryId: {
      type: "string",
      editable: true,
      filterable: true,
      uiConfig: {
        label: "Category",
        description: "Post category",
      },
      formConfig: {
        visible: true,
        fieldType: "select",
      },
      tableConfig: {
        visible: true,
        colWidth: 150,
      },
    },
    seriesId: {
      type: "string",
      editable: true,
      filterable: true,
      uiConfig: {
        label: "Series",
        description: "Part of a series",
      },
      formConfig: {
        visible: true,
        fieldType: "select",
      },
      tableConfig: {
        visible: true,
        colWidth: 150,
      },
    },
    seriesOrder: {
      type: "number",
      editable: true,
      sortable: true,
      uiConfig: {
        label: "Series Order",
        description: "Position within the series (1, 2, 3...)",
      },
      formConfig: {
        visible: true,
        fieldType: "number",
      },
      tableConfig: {
        visible: true,
        colWidth: 120,
      },
    },
    heroImage: {
      type: "json",
      editable: true,
      uiConfig: {
        label: "Hero Image",
        description: "Featured image",
      },
      formConfig: {
        visible: true,
        fieldType: "image",
      },
      tableConfig: {
        visible: false,
      },
    },
    seoMeta: {
      type: "json",
      editable: true,
      uiConfig: {
        label: "SEO Metadata",
        description: "SEO and social media metadata",
      },
      formConfig: {
        visible: true,
        fieldType: "json",
      },
      tableConfig: {
        visible: false,
      },
    },
    privateNotes: {
      type: "json",
      editable: true,
      uiConfig: {
        label: "Private Notes",
      },
      formConfig: {
        visible: true,
        fieldType: "editor" as any,
      },
      tableConfig: {
        visible: false,
      },
    },
    footnotes: {
      type: "json",
      editable: true,
      uiConfig: {
        label: "Footnotes",
      },
      formConfig: {
        visible: true,
        fieldType: "editor" as any,
      },
      tableConfig: {
        visible: false,
      },
    },
    authorId: {
      type: "string",
      editable: true,
      filterable: true,
      uiConfig: {
        label: "Author ID",
      },
      formConfig: {
        visible: true,
        fieldType: "select",
      },
      tableConfig: {
        visible: false,
      },
    },
    authorName: {
      type: "string",
      editable: true,
      uiConfig: {
        label: "Author Name",
      },
      formConfig: {
        visible: true,
        fieldType: "input",
      },
      tableConfig: {
        visible: false,
      },
    },
    authorEmail: {
      type: "string",
      editable: true,
      uiConfig: {
        label: "Author Email",
      },
      formConfig: {
        visible: true,
        fieldType: "input",
      },
      tableConfig: {
        visible: false,
      },
    },
    authorAvatar: {
      type: "string",
      editable: true,
      uiConfig: {
        label: "Author Avatar",
      },
      formConfig: {
        visible: true,
        fieldType: "input",
      },
      tableConfig: {
        visible: false,
      },
    },
    readingTimeMinutes: {
      type: "number",
      editable: false,
      sortable: true,
      uiConfig: {
        label: "Reading Time",
      },
      tableConfig: {
        visible: true,
        colWidth: 120,
      },
    },
    wordCount: {
      type: "number",
      editable: false,
      sortable: true,
      uiConfig: {
        label: "Word Count",
      },
      tableConfig: {
        visible: true,
        colWidth: 120,
      },
    },
    isFeatured: {
      type: "boolean",
      editable: true,
      filterable: true,
      sortable: true,
      uiConfig: {
        label: "Featured",
        description: "Pin this post",
        defaultValue: false,
      },
      formConfig: {
        visible: true,
        fieldType: "boolean",
      },
      tableConfig: {
        visible: true,
        colWidth: 120,
      },
    },
    allowComments: {
      type: "boolean",
      editable: true,
      filterable: true,
      uiConfig: {
        label: "Allow Comments",
        description: "Enable comments",
        defaultValue: true,
      },
      formConfig: {
        visible: true,
        fieldType: "boolean",
      },
      tableConfig: {
        visible: true,
        colWidth: 150,
      },
    },
    viewCount: {
      type: "number",
      editable: false,
      sortable: true,
      uiConfig: {
        label: "Views",
      },
      tableConfig: {
        visible: true,
        colWidth: 80,
      },
    },
    publishAt: {
      type: "date",
      editable: true,
      sortable: true,
      uiConfig: {
        label: "Publish At",
      },
      formConfig: {
        visible: true,
        fieldType: "datetime",
      },
      tableConfig: {
        visible: true,
        colWidth: 150,
      },
    },
    publishedAt: {
      type: "date",
      editable: true,
      sortable: true,
      uiConfig: {
        label: "Published At",
      },
      tableConfig: {
        visible: true,
        colWidth: 150,
      },
    },
    postedAt: {
      type: "date",
      editable: false,
      sortable: true,
      uiConfig: {
        label: "Posted At",
      },
      tableConfig: {
        visible: false,
      },
    },
    appId: {
      type: "string",
      editable: false,
      filterable: true,
      uiConfig: {
        label: "App ID",
        description: "Auto-set when scopeByAppId is enabled",
      },
      formConfig: {
        visible: false,
      },
      tableConfig: {
        visible: false,
      },
    },
    maxVersionsToKeep: {
      type: "number",
      editable: true,
      uiConfig: {
        label: "Max Versions",
        description: "Max versions to retain",
      },
      formConfig: {
        visible: true,
        fieldType: "number",
      },
      tableConfig: {
        visible: false,
      },
    },
    createdAt: {
      type: "date",
      editable: false,
      sortable: true,
      uiConfig: {
        label: "Created",
      },
      tableConfig: {
        visible: true,
        colWidth: 150,
      },
    },
    updatedAt: {
      type: "date",
      editable: false,
      sortable: true,
      uiConfig: {
        label: "Updated",
      },
      tableConfig: {
        visible: false,
      },
    },
  };

  protected static validationRules = {
    title: {
      rules: "required|min:3|max:200",
      fieldName: "Title",
      messages: {
        required: "Title is required",
        min: "Title must be at least 3 characters",
        max: "Title must be less than 200 characters",
      },
    },
  };

  // ============================================================
  // QUERY HELPERS
  // ============================================================

  /**
   * Find a post by slug (unique per appId)
   */
  static async findBySlug(
    slug: string,
    options?: { appId?: string },
  ): Promise<Post | null> {
    const query: Record<string, unknown> = { slug };
    if (options?.appId) query.appId = options.appId;

    const results = await this.where(query);
    return results.length > 0 ? (results[0] as Post) : null;
  }

  /**
   * Get all published posts
   */
  static async published(options?: {
    contentType?: ContentType;
    appId?: string;
    limit?: number;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
  }) {
    const query: Record<string, unknown> = { status: "published" };
    if (options?.contentType) query.contentType = options.contentType;
    if (options?.appId) query.appId = options.appId;

    return this.where(query, {
      orderBy: options?.orderBy || "publishedAt",
      orderDirection: options?.orderDirection || "desc",
      limit: options?.limit,
    });
  }

  /**
   * Get featured posts
   */
  static async featured(options?: {
    status?: PostStatus;
    contentType?: ContentType;
    appId?: string;
    limit?: number;
  }) {
    const query: Record<string, unknown> = { isFeatured: true };
    if (options?.status) query.status = options.status;
    if (options?.contentType) query.contentType = options.contentType;
    if (options?.appId) query.appId = options.appId;

    return this.where(query, {
      orderBy: "publishedAt",
      orderDirection: "desc",
      limit: options?.limit,
    });
  }

  /**
   * Get posts by category
   */
  static async byCategory(
    categoryId: string,
    options?: {
      status?: PostStatus;
      appId?: string;
      orderBy?: string;
      orderDirection?: "asc" | "desc";
      limit?: number;
    },
  ) {
    const query: Record<string, unknown> = { categoryId };
    if (options?.status) query.status = options.status;
    if (options?.appId) query.appId = options.appId;

    return this.where(query, {
      orderBy: options?.orderBy || "publishedAt",
      orderDirection: options?.orderDirection || "desc",
      limit: options?.limit,
    });
  }

  /**
   * Get posts in a series
   */
  static async bySeries(
    seriesId: string,
    options?: {
      status?: PostStatus;
      appId?: string;
      limit?: number;
    },
  ) {
    const query: Record<string, unknown> = { seriesId };
    if (options?.status) query.status = options.status;
    if (options?.appId) query.appId = options.appId;

    return this.where(query, {
      orderBy: "seriesOrder",
      orderDirection: "asc",
      limit: options?.limit,
    });
  }

  // ============================================================
  // RELATIONSHIPS
  // ============================================================

  /**
   * Get the author of this post (BelongsTo User)
   */
  async author(select?: string[]) {
    const { User } = await import("@ottabase/ottaorm");

    return this.belongsTo(User as any, "authorId", {
      select: select || undefined,
    });
  }

  /**
   * Get tags for this post (BelongsToMany PostTag via postTagLinksTable)
   */
  async tags(options?: {
    select?: string[];
    orderBy?: string;
    orderDirection?: "asc" | "desc";
    withPivot?: string[];
  }) {
    return this.belongsToMany(PostTag, postTagLinksTable, {
      foreignKey: "postId",
      otherKey: "tagId",
      ...options,
    });
  }

  // ============================================================
  // STATIC HELPERS
  // ============================================================

  /**
   * Create post with auto-generated slug from title
   */
  static async createWithSlug(title: string, data?: Record<string, any>) {
    const slug = generateSlug(title);
    return this.create({ title, slug, ...data });
  }

  // ==================== Instance Methods ====================

  /**
   * Publish the post immediately
   */
  async publish() {
    const now = new Date();
    this.set("status", "published");
    this.set("publishedAt", this.get("publishedAt") || now);
    this.set("postedAt", now);
    return this.save();
  }

  /**
   * Unpublish (revert to draft)
   */
  async unpublish() {
    this.set("status", "draft");
    return this.save();
  }

  /**
   * Archive the post
   */
  async archive() {
    this.set("status", "archived");
    return this.save();
  }

  /**
   * Toggle featured status
   */
  async toggleFeatured() {
    this.set("isFeatured", !this.get("isFeatured"));
    return this.save();
  }

  /**
   * Increment view count
   */
  async incrementViews() {
    const currentViews = this.get("viewCount") || 0;
    this.set("viewCount", currentViews + 1);
    return this.save();
  }

  /**
   * Update reading time and word count from content
   */
  updateReadingStats() {
    const content = this.get("content") as EditorJSData | null;
    if (!content) return;

    const readingTime = calculateReadingTime(content);
    this.set("readingTimeMinutes", readingTime.minutes);
    this.set("wordCount", readingTime.words);
  }

  /**
   * Auto-generate slug from title if not set
   */
  generateSlug() {
    const title = this.get("title") as string;
    if (title && !this.get("slug")) {
      this.set("slug", generateSlug(title));
    }
  }

  /**
   * Auto-generate excerpt from content if not set
   */
  generateExcerpt() {
    const content = this.get("content") as EditorJSData | null;
    if (!content || this.get("excerpt")) return;

    const excerpt = extractExcerpt(content);
    this.set("excerpt", excerpt);
  }
}
