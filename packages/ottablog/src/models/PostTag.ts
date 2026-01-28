/**
 * PostTag Model
 *
 * Junction table linking posts to tags (many-to-many).
 * Uses the core Tag model from @ottabase/ottaorm.
 */
import { BaseModel, ModelFields, tagsTable } from "@ottabase/ottaorm";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { postsTable } from "./tables/PostTable";

/**
 * Post-Tags junction table for many-to-many relationship
 * Links posts to the core Tag model from @ottabase/ottaorm
 */
export const postTagsTable = sqliteTable(
  "post_tags",
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
    // Composite primary key prevents duplicate tag assignments
    primaryKey({ columns: [table.postId, table.tagId] }),

    // Get all tags for a post: postId (foreign key)
    index("post_tags_post_id_idx").on(table.postId),

    // Get all posts with a tag: tagId (foreign key)
    index("post_tags_tag_id_idx").on(table.tagId),
  ],
);

export type NewPostTag = typeof postTagsTable.$inferInsert;

export class PostTag extends BaseModel {
  static entity = "post_tags";
  static table = postTagsTable;
  static primaryKey = "postId";

  protected static fields: ModelFields = {
    postId: {
      type: "string",
      editable: false,
      uiConfig: {
        label: "Post ID",
      },
    },
    tagId: {
      type: "string",
      editable: false,
      uiConfig: {
        label: "Tag ID",
      },
    },
    createdAt: {
      type: "date",
      editable: false,
      uiConfig: {
        label: "Created",
      },
    },
  };
}
