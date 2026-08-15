import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearConnection, registerConnection } from '../../context';
import { BaseModel } from '../BaseModel';

const postsTable = sqliteTable('deferred_posts', {
    id: text('id').primaryKey(),
    title: text('title'),
    body: text('body'),
    notes: text('notes'),
});

class DeferredPost extends BaseModel {
    static entity = 'deferred_posts';
    static table = postsTable;
    static primaryKey = 'id';
    static deferred = ['body', 'notes'];
}

class PlainPost extends BaseModel {
    static entity = 'deferred_posts';
    static table = postsTable;
    static primaryKey = 'id';
}

/** Chainable query stub: every builder call returns itself, awaiting it yields no rows. */
function createDbStub() {
    const select = vi.fn(() => chain);
    const chain: Record<string, any> = {
        then: (resolve: (rows: unknown[]) => unknown) => resolve([]),
    };
    for (const method of ['from', 'where', 'orderBy', 'limit', 'offset']) chain[method] = () => chain;
    return { select, getDb: () => ({ select }) };
}

/** The column names a call to db.select(projection) asked for, or null when it selected everything. */
function projectionOf(select: ReturnType<typeof createDbStub>['select']): string[] | null {
    const arg = select.mock.calls.at(-1)?.[0];
    return arg ? Object.keys(arg).sort() : null;
}

describe('BaseModel deferred columns', () => {
    let db: ReturnType<typeof createDbStub>;

    beforeEach(() => {
        clearConnection('default');
        db = createDbStub();
        registerConnection('default', db as any);
    });

    it('drops deferred columns from a collection read', async () => {
        await DeferredPost.where({});
        expect(projectionOf(db.select)).toEqual(['id', 'title']);
    });

    it('keeps every column on single-record reads, which never defer', async () => {
        await DeferredPost.first({ id: 'post-1' });
        expect(projectionOf(db.select)).toBeNull();

        await DeferredPost.find('post-1');
        expect(projectionOf(db.select)).toBeNull();
    });

    it('selects everything for a model that declares nothing deferred', async () => {
        await PlainPost.where({});
        expect(projectionOf(db.select)).toBeNull();
    });

    it('loads deferred columns when a caller explicitly asks for them', async () => {
        await DeferredPost.where({}, { withDeferred: true });
        expect(projectionOf(db.select)).toBeNull();
    });

    it('lets an explicit select win, and forces the primary key into it', async () => {
        // Without the pk the resulting instances could not save(), refresh(), or destroy().
        await DeferredPost.where({}, { select: ['title'] });
        expect(projectionOf(db.select)).toEqual(['id', 'title']);

        // An explicit select may even re-request a deferred column.
        await DeferredPost.where({}, { select: ['body'] });
        expect(projectionOf(db.select)).toEqual(['body', 'id']);
    });

    it('defers on every collection entry point, not just where', async () => {
        await DeferredPost.all();
        expect(projectionOf(db.select)).toEqual(['id', 'title']);

        await DeferredPost.whereIn('id', ['post-1']);
        expect(projectionOf(db.select)).toEqual(['id', 'title']);

        await DeferredPost.search('kyoto', ['title']);
        expect(projectionOf(db.select)).toEqual(['id', 'title']);
    });

    it('ignores unknown column names in a select', async () => {
        await DeferredPost.where({}, { select: ['title', 'nope'] });
        expect(projectionOf(db.select)).toEqual(['id', 'title']);
    });
});

describe('records loaded without their deferred columns', () => {
    /** What a collection read produces: the projected row plus the names it left behind. */
    function collectionRecord() {
        return new DeferredPost({
            entity: 'deferred_posts',
            data: { id: 'post-1', title: 'Kyoto' },
            omitted: ['body', 'notes'],
        });
    }

    it('throws on read instead of returning undefined', () => {
        const record = collectionRecord();

        // The whole point: `if (!record.get('body'))` must not quietly look like an empty body.
        expect(() => record.get('body')).toThrow(/was not loaded/);
        expect(record.get('title')).toBe('Kyoto');
    });

    it('names the field, the model, and both ways out', () => {
        expect(() => collectionRecord().get('body')).toThrow(/"body".*DeferredPost/s);
        expect(() => collectionRecord().get('body')).toThrow(/find\(\)\/first\(\)|withDeferred/);
    });

    it('stops throwing once the caller supplies the value', () => {
        const record = collectionRecord();
        record.set('body', 'now known');

        expect(record.get('body')).toBe('now known');
        expect(() => record.get('notes')).toThrow(/was not loaded/);
    });

    it('leaves omitted columns out of toJson rather than emitting them as null', () => {
        const json = collectionRecord().toJson();

        expect(json).toMatchObject({ id: 'post-1', title: 'Kyoto' });
        expect('body' in json).toBe(false);
        expect('notes' in json).toBe(false);
    });

    it('does not flag anything on a normally loaded record', () => {
        const record = new DeferredPost({
            entity: 'deferred_posts',
            data: { id: 'post-1', title: 'Kyoto', body: 'full text', notes: null },
        });

        expect(record.get('body')).toBe('full text');
        expect(record.get('notes')).toBeNull();
    });
});
