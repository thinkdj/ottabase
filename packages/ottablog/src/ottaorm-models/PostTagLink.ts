/**
 * PostTagLink Model
 *
 * Junction table linking Posts to PostTags (many-to-many relationship).
 */
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { postTagLinksTable, type NewPostTagLinkType, type PostTagLinkType } from './PostTagLink.schema';

export { postTagLinksTable, type NewPostTagLinkType, type PostTagLinkType } from './PostTagLink.schema';

/**
 * PostTagLink Model - Junction for Post <-> PostTag relationship
 */
export class PostTagLink extends BaseModel {
    static entity = 'post_tag_links';
    static table = postTagLinksTable;
    static primaryKey = 'postId'; // Composite key, using postId as primary
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    protected static fields: ModelFields = {
        postId: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Post ID',
            },
        },
        tagId: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Tag ID',
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Created',
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
            await this.delete(link.get('postId'));
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
