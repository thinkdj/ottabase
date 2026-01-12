// ============================================================
// Shortlink Model (App-specific implementation of @ottabase/shortlinks)
// ============================================================

import { BaseModel, IModelConstructorParams, ModelFields } from "@ottabase/ottaorm";
import { shortlinksTable, ShortlinkTypes } from "@ottabase/shortlinks";
import type { Shortlink as ShortlinkType, NewShortlink } from "@ottabase/shortlinks";

export type { ShortlinkType, NewShortlink };

/**
 * Shortlink model - URL shortening service
 *
 * @example
 * ```typescript
 * import { Shortlink } from "./models/Shortlink";
 * import { setDriver } from "@ottabase/ottaorm";
 *
 * setDriver(createD1Driver(env.DB));
 *
 * // Create shortlink
 * const link = await Shortlink.create({
 *   fullUrl: "https://github.com/ottabase",
 *   shortCode: "gh",
 *   type: "redirect",
 *   appName: "myapp"
 * });
 *
 * // Find by short code
 * const found = await Shortlink.findByCode("gh");
 *
 * // Track click
 * await found.trackClick();
 *
 * // Check if expired
 * if (found.isExpired()) {
 *   console.log("Link has expired");
 * }
 * ```
 */
export class Shortlink extends BaseModel {
  static entity = "shortlinks";
  static table = shortlinksTable;
  static primaryKey = "id";

  static casts = {
    expiryDate: "date" as const,
    createdAt: "date" as const,
    updatedAt: "date" as const,
    lastClickedAt: "date" as const,
    clicks: "number" as const,
  };

  protected static defaults = {
    type: ShortlinkTypes.REDIRECT,
    appName: "default",
    clicks: 0,
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
    fullUrl: {
      type: "string",
      editable: true,
      searchable: true,
      sortable: true,
      uiConfig: {
        label: "Full URL",
        description: "The destination URL",
        placeholder: "https://example.com/very/long/url",
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
        rules: "required|url",
        messages: {
          required: "URL is required",
          url: "Must be a valid URL",
        },
      },
    },
    shortCode: {
      type: "string",
      editable: true,
      searchable: true,
      sortable: true,
      uiConfig: {
        label: "Short Code",
        description: "Unique identifier for the short URL",
        placeholder: "gh",
      },
      formConfig: {
        visible: true,
        fieldType: "input",
      },
      tableConfig: {
        visible: true,
        colWidth: 150,
      },
      validation: {
        rules: "required|alpha_dash|min:2|max:50",
        messages: {
          required: "Short code is required",
          alpha_dash: "Only letters, numbers, dashes and underscores allowed",
          min: "Minimum 2 characters",
          max: "Maximum 50 characters",
        },
      },
    },
    type: {
      type: "string",
      editable: true,
      filterable: true,
      sortable: true,
      uiConfig: {
        label: "Type",
        description: "Link type",
        defaultValue: ShortlinkTypes.REDIRECT,
      },
      formConfig: {
        visible: true,
        fieldType: "select",
        options: Object.values(ShortlinkTypes).map((type) => ({
          label: type.charAt(0).toUpperCase() + type.slice(1),
          value: type,
        })),
      },
      tableConfig: {
        visible: true,
        colWidth: 120,
      },
    },
    appName: {
      type: "string",
      editable: true,
      filterable: true,
      sortable: true,
      uiConfig: {
        label: "App Name",
        description: "Application identifier for multi-tenant support",
        defaultValue: "default",
      },
      formConfig: {
        visible: true,
        fieldType: "input",
      },
      tableConfig: {
        visible: true,
        colWidth: 120,
      },
    },
    expiryDate: {
      type: "date",
      editable: true,
      sortable: true,
      uiConfig: {
        label: "Expiry Date",
        description: "Optional expiration date",
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
    clicks: {
      type: "number",
      editable: false,
      sortable: true,
      uiConfig: {
        label: "Clicks",
        description: "Number of times this link has been clicked",
      },
      tableConfig: {
        visible: true,
        colWidth: 100,
      },
    },
    lastClickedAt: {
      type: "date",
      editable: false,
      sortable: true,
      uiConfig: {
        label: "Last Clicked",
      },
      tableConfig: {
        visible: true,
        colWidth: 150,
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
    fullUrl: {
      rules: "required|url",
      fieldName: "Full URL",
      messages: {
        required: "URL is required",
        url: "Must be a valid URL",
      },
    },
    shortCode: {
      rules: "required|alpha_dash|min:2|max:50",
      fieldName: "Short Code",
      messages: {
        required: "Short code is required",
        alpha_dash: "Only letters, numbers, dashes and underscores allowed",
        min: "Minimum 2 characters",
        max: "Maximum 50 characters",
      },
    },
  };

  constructor(data: { [key: string]: any }) {
    const params: IModelConstructorParams = { entity: Shortlink.entity, data };
    super(params);
  }

  // ============================================================
  // QUERY HELPERS
  // ============================================================

  /**
   * Find a shortlink by its short code
   */
  static async findByCode(shortCode: string): Promise<Shortlink | null> {
    const results = await this.where({ shortCode });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Find active (non-expired) shortlinks
   */
  static async active(options?: {
    appName?: string;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
  }) {
    const now = new Date();
    const query: any = {};

    if (options?.appName) {
      query.appName = options.appName;
    }

    // Note: We'll need to filter expired ones after fetching
    // since Drizzle doesn't support complex date comparisons easily
    const results = await this.where(query, {
      orderBy: options?.orderBy || "createdAt",
      orderDirection: options?.orderDirection || "desc",
    });

    // Filter out expired links
    return results.filter((link) => !link.isExpired());
  }

  /**
   * Get shortlinks by app name
   */
  static async byApp(
    appName: string,
    options?: {
      orderBy?: string;
      orderDirection?: "asc" | "desc";
    }
  ) {
    return this.where(
      { appName },
      {
        orderBy: options?.orderBy || "createdAt",
        orderDirection: options?.orderDirection || "desc",
      }
    );
  }

  /**
   * Get shortlinks by type
   */
  static async byType(
    type: string,
    options?: {
      orderBy?: string;
      orderDirection?: "asc" | "desc";
    }
  ) {
    return this.where(
      { type },
      {
        orderBy: options?.orderBy || "createdAt",
        orderDirection: options?.orderDirection || "desc",
      }
    );
  }

  // ============================================================
  // INSTANCE METHODS
  // ============================================================

  /**
   * Check if the shortlink has expired
   */
  isExpired(): boolean {
    const expiryDate = this.get("expiryDate");
    if (!expiryDate) return false;
    return new Date() > new Date(expiryDate);
  }

  /**
   * Track a click on this shortlink
   */
  async trackClick() {
    const currentClicks = this.get("clicks") || 0;
    this.set("clicks", currentClicks + 1);
    this.set("lastClickedAt", new Date());
    return this.save();
  }

  /**
   * Get the full short URL (requires baseUrl)
   */
  getShortUrl(baseUrl: string): string {
    return `${baseUrl}/${this.get("shortCode")}`;
  }

  /**
   * Update expiry date
   */
  async setExpiry(date: Date | null) {
    this.set("expiryDate", date);
    return this.save();
  }

  /**
   * Get analytics summary
   */
  getAnalytics() {
    return {
      clicks: this.get("clicks") || 0,
      lastClicked: this.get("lastClickedAt"),
      isExpired: this.isExpired(),
      created: this.get("createdAt"),
    };
  }
}
