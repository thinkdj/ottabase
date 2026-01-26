/**
 * BlogPost Model
 *
 * OttaORM model for blog posts using @ottabase/ottablog schema.
 * Supports multiple content types, SEO, hero images, and OttaEditor content.
 */
import { BaseModel, ModelFields } from "@ottabase/ottaorm";
import {
  postsTable,
  CONTENT_TYPES,
  POST_STATUSES,
  calculateReadingTime,
  extractExcerpt,
  generateSlug,
  type ContentType,
  type PostStatus,
  type EditorJSData,
} from "@ottabase/ottablog";

export type BlogPostType = typeof postsTable.$inferSelect;
export type NewBlogPostType = typeof postsTable.$inferInsert;

export class BlogPost extends BaseModel {
  static entity = "blog_posts";
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
        fieldType: "editor", // Custom field type for OttaEditor
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
        })),
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
        })),
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
        visible: false,
      },
    },
    heroImage: {
      type: "json",
      editable: true,
      uiConfig: {
        label: "Hero Image",
        description: "Featured image for the post",
      },
      formConfig: {
        visible: true,
        fieldType: "upload", // Custom field type for image upload
      },
      tableConfig: {
        visible: false,
      },
    },
    seoMeta: {
      type: "json",
      editable: true,
      uiConfig: {
        label: "SEO Settings",
        description: "Search engine optimization metadata",
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
        description: "Author-only notes (not shown publicly)",
      },
      formConfig: {
        visible: true,
        fieldType: "editor",
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
        description: "Public footnotes/endnotes",
      },
      formConfig: {
        visible: true,
        fieldType: "editor",
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
        visible: false,
      },
      tableConfig: {
        visible: false,
      },
    },
    authorName: {
      type: "string",
      editable: true,
      searchable: true,
      uiConfig: {
        label: "Author",
        description: "Author name",
      },
      formConfig: {
        visible: true,
        fieldType: "input",
      },
      tableConfig: {
        visible: true,
        colWidth: 150,
      },
    },
    authorEmail: {
      type: "string",
      editable: true,
      uiConfig: {
        label: "Author Email",
      },
      formConfig: {
        visible: false,
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
        visible: false,
      },
      tableConfig: {
        visible: false,
      },
    },
    isFeatured: {
      type: "boolean",
      editable: true,
      filterable: true,
      sortable: true,
      uiConfig: {
        label: "Featured",
        description: "Pin to top of listings",
        defaultValue: false,
      },
      formConfig: {
        visible: true,
        fieldType: "boolean",
      },
      tableConfig: {
        visible: true,
        colWidth: 80,
      },
    },
    allowComments: {
      type: "boolean",
      editable: true,
      uiConfig: {
        label: "Allow Comments",
        defaultValue: true,
      },
      formConfig: {
        visible: true,
        fieldType: "boolean",
      },
      tableConfig: {
        visible: false,
      },
    },
    viewCount: {
      type: "number",
      editable: false,
      sortable: true,
      uiConfig: {
        label: "Views",
      },
      formConfig: {
        visible: false,
      },
      tableConfig: {
        visible: true,
        colWidth: 80,
      },
    },
    readingTimeMinutes: {
      type: "number",
      editable: false,
      uiConfig: {
        label: "Reading Time",
      },
      formConfig: {
        visible: false,
      },
      tableConfig: {
        visible: true,
        colWidth: 100,
      },
    },
    publishedAt: {
      type: "date",
      editable: true,
      sortable: true,
      uiConfig: {
        label: "Publish Date",
        description: "When to display as published",
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
    maxVersionsToKeep: {
      type: "number",
      editable: true,
      uiConfig: {
        label: "Version History",
        description: "Number of versions to keep (empty = keep all)",
      },
      formConfig: {
        visible: true,
        fieldType: "select",
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

  // ==================== Query Scopes ====================

  /**
   * Get published posts
   */
  static async published(options?: {
    contentType?: ContentType;
    appId?: string;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
    limit?: number;
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
   * Get draft posts
   */
  static async drafts(options?: {
    appId?: string;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
  }) {
    const query: Record<string, unknown> = { status: "draft" };
    if (options?.appId) query.appId = options.appId;

    return this.where(query, {
      orderBy: options?.orderBy || "updatedAt",
      orderDirection: options?.orderDirection || "desc",
    });
  }

  /**
   * Get featured posts
   */
  static async featured(options?: {
    contentType?: ContentType;
    appId?: string;
    limit?: number;
  }) {
    const query: Record<string, unknown> = {
      status: "published",
      isFeatured: true,
    };
    if (options?.contentType) query.contentType = options.contentType;
    if (options?.appId) query.appId = options.appId;

    return this.where(query, {
      orderBy: "publishedAt",
      orderDirection: "desc",
      limit: options?.limit,
    });
  }

  /**
   * Get posts by content type
   */
  static async byContentType(
    contentType: ContentType,
    options?: {
      status?: PostStatus;
      appId?: string;
      orderBy?: string;
      orderDirection?: "asc" | "desc";
      limit?: number;
    }
  ) {
    const query: Record<string, unknown> = { contentType };
    if (options?.status) query.status = options.status;
    if (options?.appId) query.appId = options.appId;

    return this.where(query, {
      orderBy: options?.orderBy || "publishedAt",
      orderDirection: options?.orderDirection || "desc",
      limit: options?.limit,
    });
  }

  /**
   * Find post by slug
   */
  static async findBySlug(
    slug: string,
    options?: { appId?: string }
  ): Promise<BlogPost | null> {
    const query: Record<string, unknown> = { slug };
    if (options?.appId) query.appId = options.appId;

    const results = await this.where(query);
    return results.length > 0 ? (results[0] as BlogPost) : null;
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
    }
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
    }
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
    if (content && content.blocks) {
      const stats = calculateReadingTime(content);
      this.set("readingTimeMinutes", stats.minutes);
      this.set("wordCount", stats.words);
    }
  }

  /**
   * Auto-generate excerpt from content if not set
   */
  generateExcerpt(maxLength = 160) {
    const content = this.get("content") as EditorJSData | null;
    if (content && content.blocks && !this.get("excerpt")) {
      this.set("excerpt", extractExcerpt(content, maxLength));
    }
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
   * Prepare post for saving (auto-generate fields)
   */
  prepareForSave() {
    this.generateSlug();
    this.generateExcerpt();
    this.updateReadingStats();
  }

  /**
   * Check if post is published
   */
  isPublished(): boolean {
    return this.get("status") === "published";
  }

  /**
   * Check if post is draft
   */
  isDraft(): boolean {
    return this.get("status") === "draft";
  }

  /**
   * Get formatted reading time
   */
  getFormattedReadingTime(): string {
    const minutes = this.get("readingTimeMinutes") || 0;
    return minutes <= 1 ? "1 min read" : `${minutes} min read`;
  }
}
