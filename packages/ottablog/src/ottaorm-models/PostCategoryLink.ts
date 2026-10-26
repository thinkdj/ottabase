/**
 * PostCategoryLink Model
 *
 * Junction table linking Posts to PostCategories (many-to-many relationship).
 */
import type { DbDriver } from '@ottabase/db/drizzle';
import { BaseModel, ModelFields, type AtomicMutationGuard, type PackageType } from '@ottabase/ottaorm';
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

    // Every link write re-derives the post's denormalized `isLocked` flag (see PostCategory).
    // Post and PostCategory import this module, so they are loaded lazily here.

    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        const link = (await super.create.call(this, data, driver)) as InstanceType<T>;
        const categoryId = String(link.get('categoryId'));
        const { PostCategory } = await import('./PostCategory');
        // Filing a post under an unlocked category can never lock it: skip the sync (import path).
        if ((await PostCategory.lockedAmong([categoryId])).size > 0) {
            const { Post } = await import('./Post');
            await Post.syncLocked([String(link.get('postId'))]);
        }
        return link;
    }

    static async delete(id: string | number, driver?: DbDriver): Promise<boolean> {
        const link = await this.find(id, driver);
        const deleted = await super.delete.call(this, id, driver);
        if (link) await PostCategoryLink.syncPost(link);
        return deleted;
    }

    static async deleteConstrained(
        id: string | number,
        guard: AtomicMutationGuard,
        driver?: DbDriver,
    ): Promise<boolean> {
        const link = await this.find(id, driver);
        const deleted = await super.deleteConstrained.call(this, id, guard, driver);
        if (link) await PostCategoryLink.syncPost(link);
        return deleted;
    }

    private static async syncPost(link: BaseModel): Promise<void> {
        const { Post } = await import('./Post');
        await Post.syncLocked([String(link.get('postId'))]);
    }

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
