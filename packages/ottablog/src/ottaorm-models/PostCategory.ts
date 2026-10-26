/**
 * PostCategory Model
 *
 * OttaORM model for post categories with hierarchy support.
 */
import type { DbDriver } from '@ottabase/db/drizzle';
import {
    BaseModel,
    ModelFields,
    type AtomicMutationGuard,
    type PackageType,
    type UpdateMutationContext,
} from '@ottabase/ottaorm';
import { eq } from 'drizzle-orm';
import { prepareCreateSlug, prepareUpdateSlug, type SlugLifecycleConfig } from '../slug-utils';
import { NOTHING_LOCKED, type BlogViewer, type LockAccess } from '../lock-key';
import { generateSlug, type BlogScope } from '../types';
import { OttablogAudienceMember, OttablogCategoryAudience, ottablogCategoryAudiencesTable } from './OttablogAudience';
import { categoriesTable } from './PostCategory.schema';
import { PostCategoryLink, postCategoryLinksTable } from './PostCategoryLink';

export {
    categoriesTable,
    type Category,
    type NewCategory,
    type NewPostCategoryType,
    type PostCategoryType,
} from './PostCategory.schema';

/** The columns that decide a category's effective lock. */
export interface CategoryLockRow {
    id: string;
    parentId: string | null;
    isLocked: boolean;
}

const LOCK_COLUMNS = ['id', 'parentId', 'isLocked'];
/** Deepest category nesting walked when resolving an inherited lock (cycle and runaway guard). */
const MAX_CATEGORY_DEPTH = 32;

function toLockRow(row: BaseModel): CategoryLockRow {
    return {
        id: String(row.get('id')),
        parentId: (row.get('parentId') as string | null) ?? null,
        isLocked: Boolean(row.get('isLocked')),
    };
}

export class PostCategory extends BaseModel {
    static entity = 'categories';
    static table = categoriesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static writable = {
        create: ['name', 'slug', 'description', 'parentId', 'sortOrder', 'type', 'isLocked', 'appId'],
        update: ['name', 'slug', 'description', 'parentId', 'sortOrder', 'type', 'isLocked'],
    };

    static casts = {
        sortOrder: 'number' as const,
        isLocked: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        sortOrder: 0,
        isLocked: false,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
            },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Name',
                description: 'Category name',
                placeholder: 'Enter category name...',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 'auto',
            },
            validation: {
                rules: 'required|min:2|max:100',
                messages: {
                    required: 'Name is required',
                },
            },
        },
        slug: {
            type: 'string',
            unique: true,
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Slug',
                description: 'URL-friendly identifier',
                placeholder: 'auto-generated-from-name',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 200,
            },
        },
        description: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Description',
                description: 'Category description',
                placeholder: 'Brief description of this category...',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: true,
                colWidth: 300,
            },
        },
        parentId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Parent Category',
                description: 'Parent category for nesting',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        sortOrder: {
            type: 'number',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Sort Order',
                description: 'Display order (lower = first)',
                defaultValue: 0,
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 100,
            },
        },
        type: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Type',
                description: 'Content type (post, news, docs, etc.)',
                defaultValue: 'post',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 100,
            },
        },
        isLocked: {
            type: 'boolean',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Locked',
                description: 'Invite-only: posts here and in child categories need reader access',
                defaultValue: false,
            },
            formConfig: {
                visible: true,
                fieldType: 'boolean',
            },
            tableConfig: {
                visible: true,
                colWidth: 100,
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Created',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
    };

    // ==================== Slug Lifecycle Config ====================

    private static readonly slugConfig: SlugLifecycleConfig = {
        slugPrefix: 'category',
        nameField: 'name',
        hasType: true,
        entityLabel: 'categories',
    };

    // ==================== Query Scopes ====================

    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: any,
    ): Promise<InstanceType<T>> {
        await prepareCreateSlug(this, data, PostCategory.slugConfig, driver);
        return (await super.create.call(this, data, driver)) as InstanceType<T>;
    }

    protected static async prepareUpdateMutation(
        data: Record<string, any>,
        { id, currentData, driver }: UpdateMutationContext,
    ): Promise<Record<string, any>> {
        await prepareUpdateSlug(this, id, data, PostCategory.slugConfig, driver, currentData);
        return data;
    }

    // ==================== Locking ====================
    //
    // A category's lock is inherited by its descendants. Posts carry a denormalized `lockKey`
    // (their effectively locked categories) so public lists filter in SQL; every write that can
    // change it re-syncs the affected posts here or in PostCategoryLink.

    static async update<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        data: Record<string, any>,
        driver?: DbDriver,
        currentData?: Record<string, unknown>,
    ): Promise<InstanceType<T>> {
        const before = await PostCategory.lockSnapshot(String(id), data, currentData);
        const updated = (await super.update.call(this, id, data, driver, currentData)) as InstanceType<T>;
        await PostCategory.syncLockAfterUpdate(String(id), before, updated);
        return updated;
    }

    static async updateConstrained<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        data: Record<string, any>,
        guard: AtomicMutationGuard,
        currentData?: Record<string, unknown>,
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        const before = await PostCategory.lockSnapshot(String(id), data, currentData);
        const updated = (await super.updateConstrained.call(
            this,
            id,
            data,
            guard,
            currentData,
            driver,
        )) as InstanceType<T>;
        await PostCategory.syncLockAfterUpdate(String(id), before, updated);
        return updated;
    }

    static async delete(id: string | number, driver?: DbDriver): Promise<boolean> {
        const affected = await PostCategory.lockedSubtreePosts(String(id));
        const deleted = await super.delete.call(this, id, driver);
        await PostCategory.afterDelete(String(id), affected, driver);
        return deleted;
    }

    static async deleteConstrained(
        id: string | number,
        guard: AtomicMutationGuard,
        driver?: DbDriver,
    ): Promise<boolean> {
        const affected = await PostCategory.lockedSubtreePosts(String(id));
        const deleted = await super.deleteConstrained.call(this, id, guard, driver);
        await PostCategory.afterDelete(String(id), affected, driver);
        return deleted;
    }

    /**
     * Ids of every row that is locked itself or sits under a locked ancestor. Pure: the caller
     * loads the rows. A parent missing from `rows` counts as unlocked.
     */
    static effectiveLockedIds(rows: CategoryLockRow[]): Set<string> {
        const byId = new Map(rows.map((row) => [row.id, row]));
        const memo = new Map<string, boolean>();
        const lockedOf = (id: string, depth: number): boolean => {
            const cached = memo.get(id);
            if (cached !== undefined) return cached;
            const row = byId.get(id);
            if (!row || depth > MAX_CATEGORY_DEPTH) return false;
            const locked = row.isLocked || (row.parentId ? lockedOf(row.parentId, depth + 1) : false);
            memo.set(id, locked);
            return locked;
        };
        return new Set(rows.filter((row) => lockedOf(row.id, 0)).map((row) => row.id));
    }

    /**
     * What a reader may open of a blog's locked categories. A category opens to the members of an
     * audience given it or any of its ancestors; the blog's staff open everything, a signed-out
     * reader nothing. One category query, plus two small ones for a signed-in reader when
     * something is locked. A lazy `viewer` is resolved only then.
     */
    static async lockAccessFor(
        blog: BlogScope,
        viewerOrResolve: BlogViewer | (() => Promise<BlogViewer>),
    ): Promise<LockAccess> {
        const rows = (await this.where({ ...blog }, { select: LOCK_COLUMNS })).map(toLockRow);
        if (!rows.some((row) => row.isLocked)) return NOTHING_LOCKED;
        const locked = this.effectiveLockedIds(rows);
        const viewer = typeof viewerOrResolve === 'function' ? await viewerOrResolve() : viewerOrResolve;
        if (viewer.readsAllLocked) return { locked, forbidden: new Set() };
        if (!viewer.userId) return { locked, forbidden: new Set(locked) };

        const grants = await OttablogCategoryAudience.where(
            { categoryId: [...locked] },
            { select: ['categoryId', 'audienceId'] },
        );
        const audienceIds = [...new Set(grants.map((grant) => String(grant.get('audienceId'))))];
        const memberships =
            audienceIds.length > 0
                ? await OttablogAudienceMember.where(
                      { userId: viewer.userId, audienceId: audienceIds },
                      { select: ['audienceId'] },
                  )
                : [];
        const memberOf = new Set(memberships.map((row) => String(row.get('audienceId'))));
        const granted = new Set(
            grants
                .filter((grant) => memberOf.has(String(grant.get('audienceId'))))
                .map((grant) => String(grant.get('categoryId'))),
        );
        const parentOf = new Map(rows.map((row) => [row.id, row.parentId]));
        const opens = (id: string): boolean => {
            let current: string | null = id;
            for (let depth = 0; current && depth <= MAX_CATEGORY_DEPTH; depth++) {
                if (granted.has(current)) return true;
                current = parentOf.get(current) ?? null;
            }
            return false;
        };
        return { locked, forbidden: new Set([...locked].filter((id) => !opens(id))) };
    }

    /** Which of these categories are effectively locked, walking up their ancestors. */
    static async lockedAmong(categoryIds: string[]): Promise<Set<string>> {
        const rows = new Map<string, CategoryLockRow>();
        let pending = [...new Set(categoryIds)];
        for (let depth = 0; pending.length > 0 && depth <= MAX_CATEGORY_DEPTH; depth++) {
            const found = (await this.where({ id: pending }, { select: LOCK_COLUMNS })).map(toLockRow);
            for (const row of found) rows.set(row.id, row);
            pending = [
                ...new Set(found.map((row) => row.parentId).filter((id): id is string => !!id && !rows.has(id))),
            ];
        }
        const locked = this.effectiveLockedIds([...rows.values()]);
        return new Set(categoryIds.filter((id) => locked.has(id)));
    }

    /** A category and every descendant in its blog (one query). */
    private static async subtreeIds(id: string): Promise<string[]> {
        const [root] = await this.where({ id }, { select: ['id', 'appId', 'organizationId'], limit: 1 });
        if (!root) return [id];
        const rows = await this.where(
            { appId: root.get('appId'), organizationId: root.get('organizationId') ?? null },
            { select: ['id', 'parentId'] },
        );
        const children = new Map<string, string[]>();
        for (const row of rows) {
            const parentId = row.get('parentId') as string | null;
            if (!parentId) continue;
            children.set(parentId, [...(children.get(parentId) ?? []), String(row.get('id'))]);
        }
        const subtree = new Set([id]);
        const queue = [id];
        while (queue.length > 0) {
            for (const child of children.get(queue.shift()!) ?? []) {
                if (!subtree.has(child)) {
                    subtree.add(child);
                    queue.push(child);
                }
            }
        }
        return [...subtree];
    }

    /** Posts whose lock may change with this category's subtree. Empty when nothing in it is locked. */
    private static async lockedSubtreePosts(id: string): Promise<string[]> {
        const subtree = await this.subtreeIds(id);
        if ((await this.lockedAmong(subtree)).size === 0) return [];
        const links = await PostCategoryLink.where({ categoryId: subtree }, { select: ['postId'] });
        return [...new Set(links.map((link) => String(link.get('postId'))))];
    }

    private static async lockSnapshot(
        id: string,
        data: Record<string, any>,
        currentData?: Record<string, unknown>,
    ): Promise<{ isLocked: boolean; parentId: string | null } | null> {
        if (!('isLocked' in data) && !('parentId' in data)) return null;
        const current = currentData ?? (await this.find(id))?.toJson();
        return {
            isLocked: Boolean(current?.isLocked),
            parentId: (current?.parentId as string | null | undefined) ?? null,
        };
    }

    private static async syncLockAfterUpdate(
        id: string,
        before: { isLocked: boolean; parentId: string | null } | null,
        updated: BaseModel,
    ): Promise<void> {
        if (!before) return;
        const parentId = (updated.get('parentId') as string | null) ?? null;
        if (before.isLocked === Boolean(updated.get('isLocked')) && before.parentId === parentId) return;
        await this.syncSubtreePosts(id);
    }

    /** Re-derive `posts.lockKey` for every post filed under this category or its descendants. */
    static async syncSubtreePosts(id: string): Promise<void> {
        const links = await PostCategoryLink.where({ categoryId: await this.subtreeIds(id) }, { select: ['postId'] });
        const { Post } = await import('./Post');
        await Post.syncLocked(links.map((link) => String(link.get('postId'))));
    }

    /**
     * There are no FOREIGN KEY clauses in D1 (see Post.delete), so a deleted category would leave
     * its post links and audience grants behind. Remove them, then re-derive the posts it may have
     * locked.
     */
    private static async afterDelete(id: string, affectedPostIds: string[], driver?: DbDriver): Promise<void> {
        const db = this.getDriver(driver).getDb();
        await db.delete(postCategoryLinksTable).where(eq(postCategoryLinksTable.categoryId, id));
        await db.delete(ottablogCategoryAudiencesTable).where(eq(ottablogCategoryAudiencesTable.categoryId, id));
        if (affectedPostIds.length === 0) return;
        const { Post } = await import('./Post');
        await Post.syncLocked(affectedPostIds);
    }

    /** A blog's root categories (no parent). */
    static async roots(scope: BlogScope & { orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        const { orderBy, orderDirection, ...blog } = scope;
        return this.where(
            { ...blog, parentId: null },
            { orderBy: orderBy || 'sortOrder', orderDirection: orderDirection || 'asc' },
        );
    }

    /** A category's children, within its blog. */
    static async children(parentId: string, scope: BlogScope & { orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        const { orderBy, orderDirection, ...blog } = scope;
        return this.where(
            { ...blog, parentId },
            { orderBy: orderBy || 'sortOrder', orderDirection: orderDirection || 'asc' },
        );
    }

    /** A category of one blog by slug. */
    static async findBySlug(slug: string, scope: BlogScope & { type?: string }): Promise<PostCategory | null> {
        const { type, ...blog } = scope;
        return (await this.first({ slug, ...blog, ...(type ? { type } : {}) })) as PostCategory | null;
    }

    // ==================== Instance Methods ====================

    /**
     * Auto-generate slug from name if not set
     */
    generateSlug() {
        const name = this.get('name') as string;
        if (name && !this.get('slug')) {
            this.set('slug', generateSlug(name));
        }
    }
}
