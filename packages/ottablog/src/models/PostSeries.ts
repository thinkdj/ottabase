/**
 * PostSeries Model
 *
 * OttaORM model for blog series - groups related posts into ordered collections.
 * Perfect for multi-part tutorials, article series, or themed content.
 */
import { BaseModel, ModelFields } from "@ottabase/ottaorm";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { generateSlug } from "../types";

/**
 * Series table - group related posts into a series
 */
export const seriesTable = sqliteTable(
  "series",
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
    isComplete: integer("is_complete", { mode: "boolean" })
      .notNull()
      .default(false),

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
    // Lookup by slug
    index("series_slug_idx").on(table.slug),

    // List series by app ordered: appId + isComplete + sortOrder
    index("series_app_id_complete_order_idx").on(
      table.appId,
      table.isComplete,
      table.sortOrder,
    ),

    // Find complete/incomplete series: isComplete + sortOrder
    index("series_is_complete_sort_order_idx").on(
      table.isComplete,
      table.sortOrder,
    ),

    // App ID single index for other filtering
    index("series_app_id_idx").on(table.appId),
  ],
);

export type Series = typeof seriesTable.$inferSelect;
export type NewSeries = typeof seriesTable.$inferInsert;

export type PostSeriesType = typeof seriesTable.$inferSelect;
export type NewPostSeriesType = typeof seriesTable.$inferInsert;

export class PostSeries extends BaseModel {
  static entity = "series";
  static table = seriesTable;
  static primaryKey = "id";

  static casts = {
    coverImage: "json" as const,
    isComplete: "boolean" as const,
    sortOrder: "number" as const,
    createdAt: "date" as const,
    updatedAt: "date" as const,
  };

  protected static defaults = {
    isComplete: false,
    sortOrder: 0,
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
        description: "Series title",
        placeholder: "Enter series title...",
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
    description: {
      type: "string",
      editable: true,
      searchable: true,
      uiConfig: {
        label: "Description",
        description: "Series description",
        placeholder: "What is this series about?",
      },
      formConfig: {
        visible: true,
        fieldType: "textarea",
      },
      tableConfig: {
        visible: true,
        colWidth: 300,
      },
    },
    coverImage: {
      type: "json",
      editable: true,
      uiConfig: {
        label: "Cover Image",
        description: "Series cover image",
      },
      formConfig: {
        visible: true,
        fieldType: "image",
      },
      tableConfig: {
        visible: false,
      },
    },
    isComplete: {
      type: "boolean",
      editable: true,
      filterable: true,
      sortable: true,
      uiConfig: {
        label: "Complete",
        description: "Mark series as complete",
        defaultValue: false,
      },
      formConfig: {
        visible: true,
        fieldType: "boolean",
      },
      tableConfig: {
        visible: true,
        colWidth: 100,
      },
    },
    sortOrder: {
      type: "number",
      editable: true,
      sortable: true,
      uiConfig: {
        label: "Sort Order",
        description: "Display order (lower = first)",
        defaultValue: 0,
      },
      formConfig: {
        visible: true,
        fieldType: "number",
      },
      tableConfig: {
        visible: true,
        colWidth: 100,
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
  };

  protected static validationRules = {
    title: {
      rules: "required|min:3|max:200",
      fieldName: "Title",
      messages: {
        required: "Series title is required",
      },
    },
  };

  // ==================== Query Scopes ====================

  /**
   * Get all series
   */
  static async list(options?: {
    appId?: string;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
  }) {
    const query: Record<string, unknown> = {};
    if (options?.appId) query.appId = options.appId;

    return this.where(query, {
      orderBy: options?.orderBy || "sortOrder",
      orderDirection: options?.orderDirection || "asc",
    });
  }

  /**
   * Get complete series only
   */
  static async complete(options?: {
    appId?: string;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
  }) {
    const query: Record<string, unknown> = { isComplete: true };
    if (options?.appId) query.appId = options.appId;

    return this.where(query, {
      orderBy: options?.orderBy || "sortOrder",
      orderDirection: options?.orderDirection || "asc",
    });
  }

  /**
   * Find series by slug
   */
  static async findBySlug(
    slug: string,
    options?: { appId?: string },
  ): Promise<PostSeries | null> {
    const query: Record<string, unknown> = { slug };
    if (options?.appId) query.appId = options.appId;

    const results = await this.where(query);
    return results.length > 0 ? (results[0] as PostSeries) : null;
  }

  // ==================== Instance Methods ====================

  /**
   * Auto-generate slug from title if not set
   */
  generateSlug() {
    const title = this.get("title") as string;
    if (title && !this.get("slug")) {
      this.set("slug", generateSlug(title));
    }
  }
}
