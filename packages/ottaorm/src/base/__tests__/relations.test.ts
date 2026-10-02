import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { describe, expect, it, vi } from 'vitest';
import { BaseModel } from '../BaseModel';

const postsTable = sqliteTable('posts', { id: text('id').primaryKey() });
const tagsTable = sqliteTable('tags', { id: text('id').primaryKey() });
// Pivot columns follow the singular convention: postId / tagId (never postsId / tagsId).
const postTagsTable = sqliteTable('post_tags', {
    postId: text('post_id'),
    tagId: text('tag_id'),
});

class RelTag extends BaseModel {
    static entity = 'tags';
    static table = tagsTable;
}

class RelPost extends BaseModel {
    static entity = 'posts';
    static table = postsTable;

    tags(driver: never) {
        return this.belongsToMany(RelTag, postTagsTable, { driver });
    }
}

describe('belongsToMany', () => {
    it('infers singular pivot keys from plural entity names', async () => {
        const chain = {
            from: () => chain,
            where: () => Promise.resolve([]),
        };
        const driver = { getDb: () => ({ select: vi.fn(() => chain) }) };
        const post = new (RelPost as any)({ entity: 'posts', data: { id: 'p1' } }) as RelPost;

        // With plural inference (postsId/tagsId) this throws "Pivot table column(s) not found".
        await expect(post.tags(driver as never)).resolves.toEqual([]);
    });
});
