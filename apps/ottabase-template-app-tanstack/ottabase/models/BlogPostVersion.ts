/**
 * BlogPostVersion Model
 *
 * OttaORM model for blog post version history.
 * Stores snapshots of post content on each save for version tracking.
 */
import { BaseModel, ModelFields } from "@ottabase/ottaorm";
import { postVersionsTable } from "@ottabase/ottablog";

export type BlogPostVersionType = typeof postVersionsTable.$inferSelect;
export type NewBlogPostVersionType = typeof postVersionsTable.$inferInsert;

export class BlogPostVersion extends BaseModel {
  static entity = "blog_post_versions";
  static table = postVersionsTable;
  static primaryKey = "id";

  static casts = {
    content: "json" as const,
    privateNotes: "json" as const,
    footnotes: "json" as const,
    versionNumber: "number" as const,
    wordCount: "number" as const,
    createdAt: "date" as const,
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
    postId: {
      type: "string",
      editable: false,
      filterable: true,
      uiConfig: {
        label: "Post ID",
      },
      tableConfig: {
        visible: false,
      },
    },
    versionNumber: {
      type: "number",
      editable: false,
      sortable: true,
      uiConfig: {
        label: "Version",
        description: "Version number",
      },
      tableConfig: {
        visible: true,
        colWidth: 80,
      },
    },
    title: {
      type: "string",
      editable: false,
      searchable: true,
      uiConfig: {
        label: "Title",
        description: "Title at this version",
      },
      tableConfig: {
        visible: true,
        colWidth: "auto",
      },
    },
    content: {
      type: "json",
      editable: false,
      uiConfig: {
        label: "Content",
        description: "Content snapshot",
      },
      tableConfig: {
        visible: false,
      },
    },
    excerpt: {
      type: "string",
      editable: false,
      uiConfig: {
        label: "Excerpt",
      },
      tableConfig: {
        visible: false,
      },
    },
    privateNotes: {
      type: "json",
      editable: false,
      uiConfig: {
        label: "Private Notes",
      },
      tableConfig: {
        visible: false,
      },
    },
    footnotes: {
      type: "json",
      editable: false,
      uiConfig: {
        label: "Footnotes",
      },
      tableConfig: {
        visible: false,
      },
    },
    wordCount: {
      type: "number",
      editable: false,
      uiConfig: {
        label: "Words",
      },
      tableConfig: {
        visible: true,
        colWidth: 80,
      },
    },
    changedBy: {
      type: "string",
      editable: false,
      uiConfig: {
        label: "Changed By",
        description: "Who made this change",
      },
      tableConfig: {
        visible: true,
        colWidth: 150,
      },
    },
    changeNote: {
      type: "string",
      editable: false,
      uiConfig: {
        label: "Change Note",
        description: "Reason for this change",
      },
      tableConfig: {
        visible: true,
        colWidth: 200,
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

  // ==================== Query Scopes ====================

  /**
   * Get all versions for a post
   */
  static async forPost(
    postId: string,
    options?: {
      orderBy?: string;
      orderDirection?: "asc" | "desc";
      limit?: number;
    }
  ) {
    return this.where(
      { postId },
      {
        orderBy: options?.orderBy || "versionNumber",
        orderDirection: options?.orderDirection || "desc",
        limit: options?.limit,
      }
    );
  }

  /**
   * Get the latest version for a post
   */
  static async latestForPost(postId: string): Promise<BlogPostVersion | null> {
    const versions = await this.forPost(postId, { limit: 1 });
    return versions.length > 0 ? (versions[0] as BlogPostVersion) : null;
  }

  /**
   * Get a specific version by number
   */
  static async getVersion(
    postId: string,
    versionNumber: number
  ): Promise<BlogPostVersion | null> {
    const results = await this.where({ postId, versionNumber });
    return results.length > 0 ? (results[0] as BlogPostVersion) : null;
  }

  /**
   * Get the next version number for a post
   */
  static async getNextVersionNumber(postId: string): Promise<number> {
    const latest = await this.latestForPost(postId);
    return latest ? (latest.get("versionNumber") as number) + 1 : 1;
  }

  /**
   * Create a version snapshot from post data
   */
  static async createFromPost(
    postId: string,
    postData: {
      title: string;
      content?: unknown;
      excerpt?: string | null;
      privateNotes?: unknown;
      footnotes?: unknown;
      wordCount?: number | null;
    },
    options?: {
      changedBy?: string;
      changeNote?: string;
    }
  ): Promise<BlogPostVersion> {
    const versionNumber = await this.getNextVersionNumber(postId);

    return this.create({
      postId,
      versionNumber,
      title: postData.title,
      content: postData.content || null,
      excerpt: postData.excerpt || null,
      privateNotes: postData.privateNotes || null,
      footnotes: postData.footnotes || null,
      wordCount: postData.wordCount || null,
      changedBy: options?.changedBy || null,
      changeNote: options?.changeNote || null,
    }) as Promise<BlogPostVersion>;
  }

  /**
   * Prune old versions, keeping only the most recent N
   */
  static async pruneVersions(postId: string, keepCount: number): Promise<number> {
    if (keepCount < 1) return 0;

    const allVersions = await this.forPost(postId, {
      orderBy: "versionNumber",
      orderDirection: "desc",
    });

    const versionsToDelete = allVersions.slice(keepCount);
    let deletedCount = 0;

    for (const version of versionsToDelete) {
      const id = version.get("id") as string;
      await this.delete(id);
      deletedCount++;
    }

    return deletedCount;
  }

  // ==================== Instance Methods ====================

  /**
   * Get the version number
   */
  getVersionNumber(): number {
    return this.get("versionNumber") as number;
  }

  /**
   * Get formatted version label (e.g., "v1", "v2")
   */
  getVersionLabel(): string {
    return `v${this.getVersionNumber()}`;
  }

  /**
   * Get the post ID this version belongs to
   */
  getPostId(): string {
    return this.get("postId") as string;
  }
}
