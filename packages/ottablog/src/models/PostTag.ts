/**
 * PostTag Model
 *
 * Junction table for posts and tags.
 */
import { BaseModel } from "@ottabase/ottaorm";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { postsTable } from "./Post";
import { tagsTable } from "./Tag";

/**
 * Post-Tags junction table for many-to-many relationship
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
    primaryKey({ columns: [table.postId, table.tagId] }),
    index("post_tags_post_id_idx").on(table.postId),
    index("post_tags_tag_id_idx").on(table.tagId),
  ],
);

export type PostTag = typeof postTagsTable.$inferSelect;
export type NewPostTag = typeof postTagsTable.$inferInsert;

export class PostTag extends BaseModel {
  static entity = "post_tags";
  static table = postTagsTable;
  static primaryKey = "postId";
}
