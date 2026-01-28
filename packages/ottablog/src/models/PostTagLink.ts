/**
 * PostTagLink Model
 *
 * Junction table linking Posts to PostTags (many-to-many relationship).
 */
import { BaseModel, ModelFields } from "@ottabase/ottaorm";
import { sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { postsTable } from "./tables/PostTable";
import { postTagsTable } from "./PostTag";

/**
 * Post-Tag junction table for many-to-many relationship
 */
export const postTagLinksTable = sqliteTable(
	"post_tag_links",
	{
		postId: text("post_id")
			.notNull()
			.references(() => postsTable.id, { onDelete: "cascade" }),

		tagId: text("tag_id")
			.notNull()
			.references(() => postTagsTable.id, { onDelete: "cascade" }),

		// When the tag was added to the post
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		// Composite primary key prevents duplicate tag assignments
		primaryKey({ columns: [table.postId, table.tagId] }),

		// Get all tags for a post
		index("post_tag_links_post_id_idx").on(table.postId),

		// Get all posts with a tag
		index("post_tag_links_tag_id_idx").on(table.tagId),
	],
);

export type PostTagLinkType = typeof postTagLinksTable.$inferSelect;
export type NewPostTagLinkType = typeof postTagLinksTable.$inferInsert;

/**
 * PostTagLink Model - Junction for Post <-> PostTag relationship
 */
export class PostTagLink extends BaseModel {
	static entity = "post_tag_links";
	static table = postTagLinksTable;
	static primaryKey = "postId"; // Composite key, using postId as primary

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

	/**
	 * Link a tag to a post
	 */
	static async linkTag(postId: string, tagId: string): Promise<PostTagLink> {
		return this.create({ postId, tagId });
	}

	/**
	 * Unlink a tag from a post
	 */
	static async unlinkTag(postId: string, tagId: string): Promise<void> {
		const link = await this.first({ postId, tagId });
		if (link) {
			await this.delete(link.get("postId"));
		}
	}

	/**
	 * Get all tag links for a post
	 */
	static async forPost(postId: string): Promise<PostTagLink[]> {
		return this.where({ postId });
	}

	/**
	 * Get all post links for a tag
	 */
	static async forTag(tagId: string): Promise<PostTagLink[]> {
		return this.where({ tagId });
	}
}
