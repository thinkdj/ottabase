// ============================================================
// @ottabase/ottaorm - Post Model
// ============================================================

import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { BaseModel, IModelConstructorParams, ModelFields } from "../base/BaseModel";

/**
 * Post table schema
 */
export const postsTable = sqliteTable("posts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content"),
  excerpt: text("excerpt"),
  published: integer("published", { mode: "boolean" }).default(false).notNull(),
  authorId: text("author_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

/**
 * Post-Tag pivot table (many-to-many)
 */
export const postTagsTable = sqliteTable(
  "post_tags",
  {
    postId: text("post_id").notNull(),
    tagId: text("tag_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.tagId] }),
  })
);

/**
 * Post model types
 */
export type PostType = typeof postsTable.$inferSelect;
export type NewPostType = typeof postsTable.$inferInsert;

/**
 * Post model - Fat Model Pattern
 *
 * Demonstrates fat model with:
 * - Complete field metadata
 * - Relationships (author, tags via pivot)
 * - Type casting
 * - Validation rules
 * - Custom methods
 * - Accessors
 *
 * @example
 * ```typescript
 * import { Post } from "@ottabase/ottaorm/models";
 * import { setDriver } from "@ottabase/ottaorm";
 * import { createD1Driver } from "@ottabase/db/drizzle-d1";
 *
 * setDriver(createD1Driver(env.OBCF_D1));
 *
 * // Create post
 * const post = await Post.create({
 *   title: "My First Post",
 *   slug: "my-first-post",
 *   content: "Hello world!",
 *   authorId: "user-123"
 * });
 *
 * // Get published posts
 * const published = await Post.where({ published: true });
 *
 * // Publish a post
 * const post = await Post.find("post-id");
 * await post.publish();
 * ```
 */
export class Post extends BaseModel {

  static entity = "posts";
  static table = postsTable;
  static primaryKey = "id";

  static casts = {
    published: 'boolean' as const,
    createdAt: 'date' as const,
    updatedAt: 'date' as const,
  };

  protected static defaults = {
    published: false,
  };

  protected static fields: ModelFields = {
    id: {
      type: 'id',
      primaryKey: true,
      editable: false,
      uiConfig: {
        label: 'ID',
      },
    },
    title: {
      type: 'string',
      editable: true,
      searchable: true,
      sortable: true,
      uiConfig: {
        label: 'Title',
        description: 'Post title',
        placeholder: 'Enter post title',
      },
      formConfig: {
        visible: true,
        fieldType: 'input',
      },
      tableConfig: {
        visible: true,
        colWidth: 'auto',
      },
      validation: {
        rules: "required",
        messages: {
          required: "Title is required",
        }
      }
    },
    slug: {
      type: 'string',
      unique: true,
      editable: true,
      searchable: true,
      sortable: true,
      uiConfig: {
        label: 'Slug',
        description: 'URL-friendly slug',
        placeholder: 'post-slug',
      },
      formConfig: {
        visible: true,
        fieldType: 'input',
      },
      tableConfig: {
        visible: true,
        colWidth: 200,
      },
      validation: {
        rules: "required|unique:posts,slug",
        messages: {
          required: "Slug is required",
          unique: "This slug already exists",
        }
      }
    },
    content: {
      type: 'string',
      editable: true,
      searchable: true,
      uiConfig: {
        label: 'Content',
        description: 'Post content',
      },
      formConfig: {
        visible: true,
        fieldType: 'textarea',
      },
      tableConfig: {
        visible: false,
      },
    },
    excerpt: {
      type: 'string',
      editable: true,
      uiConfig: {
        label: 'Excerpt',
        description: 'Short excerpt',
      },
      formConfig: {
        visible: true,
        fieldType: 'textarea',
      },
      tableConfig: {
        visible: false,
      },
    },
    published: {
      type: 'boolean',
      editable: true,
      filterable: true,
      sortable: true,
      uiConfig: {
        label: 'Published',
        description: 'Is post published?',
        defaultValue: false,
      },
      formConfig: {
        visible: true,
        fieldType: 'boolean',
      },
      tableConfig: {
        visible: true,
        colWidth: 100,
      },
    },
    authorId: {
      type: 'string',
      editable: true,
      filterable: true,
      uiConfig: {
        label: 'Author',
        description: 'Post author',
      },
      formConfig: {
        visible: true,
        fieldType: 'select',
      },
      tableConfig: {
        visible: false,
      },
    },
    createdAt: {
      type: 'date',
      editable: false,
      sortable: true,
      uiConfig: {
        label: 'Created',
      },
      tableConfig: {
        visible: true,
        colWidth: 150,
      },
    },
    updatedAt: {
      type: 'date',
      editable: false,
      sortable: true,
      uiConfig: {
        label: 'Updated',
      },
      tableConfig: {
        visible: false,
      },
    },
  };

  protected static validationRules = {
    "title": {
      rules: "required",
      fieldName: "Title",
      messages: {
        required: "Title is required",
      }
    },
    "slug": {
      rules: "required|unique:posts,slug",
      fieldName: "Slug",
      messages: {
        required: "Slug is required",
        unique: "This slug already exists",
      }
    },
    "content": {
      rules: "required",
      fieldName: "Content",
      messages: {
        required: "Content is required",
      }
    },
  };

  // Accessor example - add "readingTime" to JSON output
  protected appends = ['readingTime'];

  constructor(data: { [key: string]: any }) {
    const params: IModelConstructorParams = { entity: Post.entity, data };
    super(params);
  }

  // ============================================================
  // RELATIONSHIPS
  // ============================================================

  /**
   * Get the author of this post (BelongsTo User)
   *
   * @example
   * ```typescript
   * const post = await Post.find('id');
   *
   * // Simple - load all fields
   * const author = await post.author();
   *
   * // Optimized - select only needed fields
   * const author = await post.author(['id', 'name', 'email', 'image']);
   * ```
   */
  async author(select?: string[]) {
    // Dynamic import to avoid circular dependency
    const { User } = await import("./User");

    return this.belongsTo(User, 'authorId', {
      select: select || undefined
    });
  }

  /**
   * Get tags for this post (BelongsToMany Tag via postTagsTable)
   *
   * @example
   * ```typescript
   * const post = await Post.find('id');
   *
   * // Simple - load all fields
   * const tags = await post.tags();
   *
   * // Optimized - select only needed fields, ordered
   * const tags = await post.tags({
   *   select: ['id', 'name', 'slug'],
   *   orderBy: 'name',
   *   orderDirection: 'asc'
   * });
   *
   * // With pivot data (e.g., order, createdAt from pivot table)
   * const tags = await post.tags({ withPivot: ['createdAt'] });
   * ```
   */
  async tags(options?: {
    select?: string[];
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    withPivot?: string[];
  }) {
    // Dynamic import
    const { Tag } = await import("./Tag");

    return this.belongsToMany(Tag, postTagsTable, {
      foreignKey: 'postId',
      otherKey: 'tagId',
      ...options
    });
  }

  // ============================================================
  // ACCESSORS
  // ============================================================

  /**
   * Accessor: Calculate reading time
   */
  private getReadingTime(): string {
    const content = this.get('content') || '';
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return `${minutes} min read`;
  }

  /**
   * Generate slug from title
   */
  static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Get all published posts
   */
  static async published(options?: { orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
    return this.where({ published: true }, {
      orderBy: options?.orderBy || 'createdAt',
      orderDirection: options?.orderDirection || 'desc'
    });
  }

  /**
   * Get all draft posts
   */
  static async drafts(options?: { orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
    return this.where({ published: false }, {
      orderBy: options?.orderBy || 'createdAt',
      orderDirection: options?.orderDirection || 'desc'
    });
  }

  /**
   * Publish this post
   */
  async publish() {
    this.set('published', true);
    return this.save();
  }

  /**
   * Unpublish this post
   */
  async unpublish() {
    this.set('published', false);
    return this.save();
  }

  /**
   * Create post with auto-generated slug if not provided
   */
  static async createWithSlug(title: string, data?: Record<string, any>) {
    const slug = this.generateSlug(title);
    return this.create({ title, slug, ...data });
  }
}
