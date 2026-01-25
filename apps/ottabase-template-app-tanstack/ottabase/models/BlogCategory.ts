/**
 * BlogCategory Model
 *
 * OttaORM model for blog categories with hierarchy support.
 */
import { BaseModel, ModelFields } from "@ottabase/ottaorm";
import { categoriesTable, generateSlug } from "@ottabase/ottablog";

export type BlogCategoryType = typeof categoriesTable.$inferSelect;
export type NewBlogCategoryType = typeof categoriesTable.$inferInsert;

export class BlogCategory extends BaseModel {
  static entity = "blog_categories";
  static table = categoriesTable;
  static primaryKey = "id";

  static casts = {
    sortOrder: "number" as const,
    createdAt: "date" as const,
    updatedAt: "date" as const,
  };

  protected static defaults = {
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
    name: {
      type: "string",
      editable: true,
      searchable: true,
      sortable: true,
      uiConfig: {
        label: "Name",
        description: "Category name",
        placeholder: "Enter category name...",
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
        rules: "required|min:2|max:100",
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
    description: {
      type: "string",
      editable: true,
      searchable: true,
      uiConfig: {
        label: "Description",
        description: "Category description",
        placeholder: "Brief description of this category...",
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
    parentId: {
      type: "string",
      editable: true,
      filterable: true,
      uiConfig: {
        label: "Parent Category",
        description: "Parent category for nesting",
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
      rules: "required|min:2|max:100",
      fieldName: "Name",
      messages: {
        required: "Category name is required",
      },
    },
  };

  // ==================== Query Scopes ====================

  /**
   * Get root categories (no parent)
   */
  static async roots(options?: {
    appId?: string;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
  }) {
    const query: Record<string, unknown> = { parentId: null };
    if (options?.appId) query.appId = options.appId;

    return this.where(query, {
      orderBy: options?.orderBy || "sortOrder",
      orderDirection: options?.orderDirection || "asc",
    });
  }

  /**
   * Get children of a category
   */
  static async children(
    parentId: string,
    options?: {
      appId?: string;
      orderBy?: string;
      orderDirection?: "asc" | "desc";
    }
  ) {
    const query: Record<string, unknown> = { parentId };
    if (options?.appId) query.appId = options.appId;

    return this.where(query, {
      orderBy: options?.orderBy || "sortOrder",
      orderDirection: options?.orderDirection || "asc",
    });
  }

  /**
   * Find category by slug
   */
  static async findBySlug(
    slug: string,
    options?: { appId?: string }
  ): Promise<BlogCategory | null> {
    const query: Record<string, unknown> = { slug };
    if (options?.appId) query.appId = options.appId;

    const results = await this.where(query);
    return results.length > 0 ? (results[0] as BlogCategory) : null;
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
   * Check if category is root (has no parent)
   */
  isRoot(): boolean {
    return !this.get("parentId");
  }

  /**
   * Get parent category
   */
  async parent(): Promise<BlogCategory | null> {
    const parentId = this.get("parentId") as string | null;
    if (!parentId) return null;

    const parent = await BlogCategory.find(parentId);
    return parent as BlogCategory | null;
  }

  /**
   * Get child categories
   */
  async children(): Promise<BlogCategory[]> {
    const id = this.get("id") as string;
    return BlogCategory.children(id) as Promise<BlogCategory[]>;
  }
}
