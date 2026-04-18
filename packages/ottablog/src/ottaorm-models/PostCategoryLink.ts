/**
 * PostCategoryLink Model
 *
 * Junction table linking Posts to PostCategories (many-to-many relationship).
 */
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { postCategoryLinksTable } from './PostCategoryLink.schema';

export {
    postCategoryLinksTable,
    type NewPostCategoryLinkType,
    type PostCategoryLinkType,
} from './PostCategoryLink.schema';

/**
 * PostCategoryLink Model - Junction for Post <-> PostCategory relationship
 */
export class PostCategoryLink extends BaseModel {
    static entity = 'post_category_links';
    static table = postCategoryLinksTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static writable = {
        create: ['postId', 'categoryId'],
        update: [] as string[],
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        postId: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Post ID',
            },
        },
        categoryId: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Category ID',
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
     * Link a category to a post
     */
    static async linkCategory(postId: string, categoryId: string): Promise<PostCategoryLink> {
        return this.create({ postId, categoryId });
    }

    /**
     * Unlink a category from a post
     */
    static async unlinkCategory(postId: string, categoryId: string): Promise<void> {
        const link = await this.first({ postId, categoryId });
        if (link) {
            await this.delete(link.get('id'));
        }
    }

    /**
     * Get all category links for a post
     */
    static async forPost(postId: string): Promise<PostCategoryLink[]> {
        return this.where({ postId });
    }

    /**
     * Get all post links for a category
     */
    static async forCategory(categoryId: string): Promise<PostCategoryLink[]> {
        return this.where({ categoryId });
    }
}
