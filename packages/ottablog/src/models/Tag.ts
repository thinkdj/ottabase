/**
 * Tag Model
 *
 * OttaORM model for tags.
 */
import { BaseModel, ModelFields } from "@ottabase/ottaorm";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { generateSlug } from "../types";

/**
 * Tags table - flexible content labeling
 */
export const tagsTable = sqliteTable(
  "tags",
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
    index("tags_slug_idx").on(table.slug),
    index("tags_app_id_idx").on(table.appId),
  ],
);

export type Tag = typeof tagsTable.$inferSelect;
export type NewTag = typeof tagsTable.$inferInsert;

export type TagType = typeof tagsTable.$inferSelect;
export type NewTagType = typeof tagsTable.$inferInsert;

export class Tag extends BaseModel {
  static entity = "tags";
  static table = tagsTable;
  static primaryKey = "id";

  static casts = {
    createdAt: "date" as const,
  };

  protected static defaults = {};

  protected static fields: ModelFields = {
    id: {
      type: "id",
      primaryKey: true,
      editable: false,
      uiConfig: {
        label: "ID",
      },
    },
    name: {
      type: "string",
      editable: true,
      searchable: true,
      sortable: true,
      uiConfig: {
        label: "Name",
        description: "Tag name",
        placeholder: "Enter tag name...",
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
        rules: "required|min:2|max:50",
        messages: {
          required: "Name is required",
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
        placeholder: "auto-generated-from-name",
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
    color: {
      type: "string",
      editable: true,
      uiConfig: {
        label: "Color",
        description: "Tag color (hex code)",
        placeholder: "#3b82f6",
      },
      formConfig: {
        visible: true,
        fieldType: "input",
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
    name: {
      rules: "required|min:2|max:50",
      fieldName: "Name",
      messages: {
        required: "Tag name is required",
      },
    },
  };

  // ==================== Query Scopes ====================

  /**
   * Find tag by slug
   */
  static async findBySlug(
    slug: string,
    options?: { appId?: string },
  ): Promise<Tag | null> {
    const query: Record<string, unknown> = { slug };
    if (options?.appId) query.appId = options.appId;

    const results = await this.where(query);
    return results.length > 0 ? (results[0] as Tag) : null;
  }

  /**
   * Get all tags for an app
   */
  static async forApp(
    appId: string,
    options?: {
      orderBy?: string;
      orderDirection?: "asc" | "desc";
    },
  ) {
    return this.where(
      { appId },
      {
        orderBy: options?.orderBy || "name",
        orderDirection: options?.orderDirection || "asc",
      },
    );
  }

  // ==================== Instance Methods ====================

  /**
   * Auto-generate slug from name if not set
   */
  generateSlug() {
    const name = this.get("name") as string;
    if (name && !this.get("slug")) {
      this.set("slug", generateSlug(name));
    }
  }

  /**
   * Get tag style for UI
   */
  getStyle(): { backgroundColor: string; color: string } {
    const color = this.get("color") as string | null;
    if (!color) {
      return {
        backgroundColor: "#e5e7eb",
        color: "#374151",
      };
    }
    // Simple contrast calculation
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return {
      backgroundColor: color,
      color: luminance > 0.5 ? "#000000" : "#ffffff",
    };
  }
}
