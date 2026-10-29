import { and } from 'drizzle-orm';
import { integer, sqliteTable, SQLiteSyncDialect, text } from 'drizzle-orm/sqlite-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearConnection, registerConnection } from '../../context';
import { BaseModel, QueryBindingLimitError } from '../BaseModel';
import { loadRelations, parseRelationSpec, RecordNotFoundError } from '../QueryBuilder';

const postsTable = sqliteTable('qb_posts', {
    id: text('id').primaryKey(),
    title: text('title'),
    status: text('status'),
    views: integer('views'),
    deletedAt: integer('deleted_at'),
});

class Post extends BaseModel {
    static entity = 'qb_posts';
    static table = postsTable;
    static primaryKey = 'id';
    static softDeletes = true;
    static sqlOf(where: Record<string, unknown>) {
        const conditions = this.buildWhereConditions(where);
        return new SQLiteSyncDialect().sqlToQuery(and(...conditions)!);
    }
}

describe('QueryBuilder.toWhere', () => {
    it('compiles equality, operators and null checks to the where object', () => {
        const where = Post.query()
            .where('status', 'published')
            .where('views', '>=', 100)
            .whereIn('id', ['a', 'b'])
            .whereNotIn('status', ['spam'])
            .whereNull('deletedAt')
            .whereNotNull('title')
            .whereContains('title', 'hello')
            .toWhere();
        expect(where).toEqual({
            $and: [
                { status: { $eq: 'published' } },
                { views: { $gte: 100 } },
                { id: { $in: ['a', 'b'] } },
                { status: { $nin: ['spam'] } },
                { deletedAt: { $null: true } },
                { title: { $null: false } },
                { title: { $contains: 'hello' } },
            ],
        });
    });

    it('ANDs repeated columns instead of replacing the earlier condition', () => {
        const where = Post.query().where('views', '>', 10).where('views', '<', 100).toWhere();
        expect(where).toEqual({ $and: [{ views: { $gt: 10 } }, { views: { $lt: 100 } }] });
    });

    it('groups orWhere branches Laravel-style and supports callback groups', () => {
        const where = Post.query()
            .where('status', 'published')
            .where('views', '>', 1)
            .orWhere((q) => q.where('status', 'featured').where('views', '>', 1000))
            .toWhere();
        expect(where).toEqual({
            $or: [
                { $and: [{ status: { $eq: 'published' } }, { views: { $gt: 1 } }] },
                { $and: [{ status: { $eq: 'featured' } }, { views: { $gt: 1000 } }] },
            ],
        });
    });

    it('merges raw where objects, compiles onlyTrashed and refuses unknown operators', () => {
        expect(
            Post.query()
                .where({ status: ['a', 'b'] })
                .toWhere(),
        ).toEqual({ status: ['a', 'b'] });
        expect(Post.query().onlyTrashed().toWhere()).toEqual({ deletedAt: { $ne: null } });
        expect(() => Post.query().where('views', 'like' as never, 1)).toThrow(/Unknown operator/);
        expect(() => Post.query().orderBy('title').orderBy('views')).toThrow(/one column/);
        expect(Post.query().orderBy('title').orderBy('id').toWhere()).toEqual({});
    });
});

describe('new where operators', () => {
    it('emits NOT IN, IS NULL / IS NOT NULL and escaped LIKE', () => {
        expect(Post.sqlOf({ status: { $nin: ['a', 'b'] } }).sql).toContain('not in');
        expect(Post.sqlOf({ title: { $null: true } }).sql).toContain('is null');
        expect(Post.sqlOf({ title: { $null: false } }).sql).toContain('is not null');
        const like = Post.sqlOf({ title: { $contains: '50%_off\\now' } });
        expect(like.sql).toContain("LIKE ? ESCAPE '\\'");
        expect(like.params).toEqual(['%50\\%\\_off\\\\now%']);
        expect(Post.sqlOf({ title: { $startsWith: 'a' } }).params).toEqual(['a%']);
        expect(Post.sqlOf({ title: { $endsWith: 'a' } }).params).toEqual(['%a']);
    });

    it('drops an empty NOT IN and caps the escaped pattern at 48 bytes', () => {
        expect(Post.sqlOf({ status: { $nin: [] }, title: 'x' }).sql).not.toContain('not in');
        expect(() => Post.sqlOf({ title: { $contains: 'a'.repeat(48) } })).not.toThrow();
        expect(() => Post.sqlOf({ title: { $contains: '%'.repeat(25) } })).toThrow(QueryBindingLimitError);
    });
});

describe('parseRelationSpec', () => {
    it('parses name, dotted path, key and projection, always keeping the key', () => {
        expect(parseRelationSpec('author')).toEqual({ name: 'author', path: ['author'], fields: undefined });
        expect(parseRelationSpec('author:id')).toEqual({ name: 'author', path: ['author'], fields: ['id'] });
        expect(parseRelationSpec('tags:id{name, slug,id}')).toEqual({
            name: 'tags',
            path: ['tags'],
            fields: ['id', 'name', 'slug'],
        });
        expect(parseRelationSpec('tags.category:id{name}')).toEqual({
            name: 'tags',
            path: ['tags', 'category'],
            fields: ['id', 'name'],
        });
        expect(() => parseRelationSpec('tags..category')).toThrow(/Invalid relation spec/);
    });
});

describe('QueryBuilder terminals', () => {
    afterEach(() => clearConnection('default'));

    function driver(rows: Array<Record<string, unknown>>, count = rows.length) {
        const calls: { selection?: unknown; limit?: number }[] = [];
        const select = vi.fn((selection?: Record<string, unknown>) => {
            const call: { selection?: unknown; limit?: number } = { selection };
            calls.push(call);
            const chain: Record<string, unknown> = {
                from: () => chain,
                where: () => chain,
                orderBy: () => chain,
                limit: (n: number) => ((call.limit = n), chain),
                offset: () => chain,
                then: (resolve: (v: unknown[]) => unknown) =>
                    Promise.resolve(
                        resolve(selection && 'count' in selection ? [{ count }] : rows.slice(0, call.limit)),
                    ),
            };
            return chain;
        });
        return { select, calls, getDb: () => ({ select }) };
    }

    it('first() limits to one row and firstOrFail() throws on nothing', async () => {
        const d = driver([{ id: '1', title: 'A' }]);
        registerConnection('default', d as never);
        const row = await Post.query().where('status', 'x').first();
        expect(row?.get('title')).toBe('A');
        expect(d.calls[0].limit).toBe(1);

        registerConnection('default', driver([]) as never);
        await expect(Post.query().firstOrFail()).rejects.toBeInstanceOf(RecordNotFoundError);
    });

    it('paginate() returns the standard page shape and pluck() projects one column', async () => {
        const d = driver(
            [
                { id: '1', title: 'A' },
                { id: '2', title: 'B' },
            ],
            2,
        );
        registerConnection('default', d as never);
        const page = await Post.query().orderBy('title', 'desc').paginate(1, 10);
        expect(page.total).toBe(2);
        expect(page.data.map((r) => r.get('id'))).toEqual(['1', '2']);
        expect(await Post.query().pluck('title')).toEqual(['A', 'B']);
        // pluck selected only title (+ primary key)
        const projected = d.calls.find((c) => c.selection && 'title' in (c.selection as object));
        expect(projected).toBeDefined();
    });

    it('with() eager-loads through load() and applies the projection', async () => {
        class Author extends BaseModel {
            static entity = 'qb_authors';
            static table = sqliteTable('qb_authors', { id: text('id').primaryKey(), name: text('name') });
        }
        class PostWithAuthor extends Post {
            async author() {
                return new (Author as any)({ entity: 'qb_authors', data: { id: 'u1', name: 'Ann', email: 'a@x' } });
            }
        }
        registerConnection('default', driver([{ id: '1', title: 'A' }]) as never);
        const [row] = await PostWithAuthor.query().limit(5).with('author:id{name}').get();
        expect(row.get('author')).toEqual({ id: 'u1', name: 'Ann' });
    });
});

describe('nested relations', () => {
    const t = (name: string) => sqliteTable(name, { id: text('id').primaryKey(), name: text('name') });
    class Category extends BaseModel {
        static entity = 'qb_categories';
        static table = t('qb_categories');
    }
    class Tag extends BaseModel {
        static entity = 'qb_tags2';
        static table = t('qb_tags2');
        protected static hidden = ['secret'];
        async category() {
            return new (Category as any)({ entity: 'qb_categories', data: { id: `c-${this.get('id')}`, name: 'Cat' } });
        }
    }
    class Article extends BaseModel {
        static entity = 'qb_articles';
        static table = t('qb_articles');
        async tags() {
            const make = (id: string) =>
                new (Tag as any)({ entity: 'qb_tags2', data: { id, name: id.toUpperCase(), slug: id, secret: 's' } });
            const list = [make('a'), make('b')];
            (list[0] as any)._pivot = { order: 1 };
            return list;
        }
    }

    it('loads a.b paths on the related instances, projects each level, keeps pivot, hides hidden', async () => {
        const article = new (Article as any)({ entity: 'qb_articles', data: { id: 'p1' } }) as Article;
        const resolved: string[] = [];
        await loadRelations([article], ['tags:id{name}', 'tags.category:id{name}'], {
            onResolved: (path, entity) => resolved.push(`${path}=${entity}`),
        });
        expect(article.get('tags')).toEqual([
            { id: 'a', name: 'A', category: { id: 'c-a', name: 'Cat' }, pivot: { order: 1 } },
            { id: 'b', name: 'B', category: { id: 'c-b', name: 'Cat' } },
        ]);
        expect(new Set(resolved)).toEqual(new Set(['tags=qb_tags2', 'tags.category=qb_categories']));

        const plain = new (Article as any)({ entity: 'qb_articles', data: { id: 'p2' } }) as Article;
        await loadRelations([plain], ['tags.category']);
        const tags = plain.get('tags') as Array<Record<string, unknown>>;
        expect(tags[0]).not.toHaveProperty('secret');
        expect(tags[0].slug).toBe('a');
        await expect(loadRelations([plain], ['nope'])).rejects.toThrow(/not defined on model "qb_articles"/);
    });
});

describe('syncPivot()', () => {
    afterEach(() => clearConnection('default'));

    const tagsTable = sqliteTable('qb_tags', { id: text('id').primaryKey() });
    const pivot = sqliteTable('qb_post_tags', {
        postId: text('post_id'),
        tagId: text('tag_id'),
        order: integer('order'),
    });
    class Tag extends BaseModel {
        static entity = 'qb_tags';
        static table = tagsTable;
    }
    class TaggedPost extends Post {
        syncTags(ids: string[]) {
            return this.syncPivot(Tag, pivot, ids, { foreignKey: 'postId', otherKey: 'tagId' });
        }
    }

    it('diffs instead of delete-all-recreate and runs one atomic batch', async () => {
        const executeBatch = vi.fn(async () => []);
        const existing = [{ other: 't1' }, { other: 't2' }];
        const chain: Record<string, unknown> = { from: () => chain, where: () => Promise.resolve(existing) };
        const sqls: string[] = [];
        const toSqlChain = (kind: string) => ({
            where: () => ({ toSQL: () => ({ sql: `${kind} where`, params: [] }) }),
            values: () => ({ toSQL: () => ({ sql: `${kind} values`, params: [] }) }),
        });
        const db = {
            select: () => chain,
            delete: () => toSqlChain('delete'),
            insert: () => toSqlChain('insert'),
        };
        registerConnection('default', { getDb: () => db, executeBatch } as never);

        const post = new (TaggedPost as any)({ entity: 'qb_posts', data: { id: 'p1' } }) as TaggedPost;
        const result = await post.syncTags(['t2', 't3']);
        expect(result).toEqual({ attached: 1, detached: 1 });
        expect(executeBatch).toHaveBeenCalledTimes(1);
        const statements = executeBatch.mock.calls[0][0] as Array<{ sql: string }>;
        sqls.push(...statements.map((s) => s.sql));
        expect(sqls).toEqual(['delete where', 'insert values']);

        // Unchanged set: nothing runs.
        executeBatch.mockClear();
        expect(await post.syncTags(['t1', 't2'])).toEqual({ attached: 0, detached: 0 });
        expect(executeBatch).not.toHaveBeenCalled();
    });
});
