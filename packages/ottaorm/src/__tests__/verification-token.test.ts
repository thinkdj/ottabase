import { beforeEach, describe, expect, it } from 'vitest';
import { registerConnection } from '../context';
import { VerificationToken } from '../models/VerificationToken';

// The rewritten VerificationToken previously crashed because it called the RAW D1 API
// (db.prepare()/db.run(sql,...args)) on what is actually a Drizzle instance. These tests
// run the methods against an in-memory driver that exposes ONLY the Drizzle query-builder
// surface (select/from/where/limit, delete/where/returning) and NO .prepare()/.run() --
// so the old code would throw here -- while verifying atomic single-use consumption.
//
// (A full real-D1 round trip belongs in the app's Workers integration suite; this unit
// test locks in the query-builder contract + single-use semantics with no native deps.)

interface Row {
    identifier: string;
    token: string;
    expires: number;
}

/**
 * Minimal in-memory driver backed by a single-table row array. Faithful for the
 * exact-match (identifier, token) queries these methods issue: each test seeds only the
 * rows it queries, so operating on the whole store models the WHERE match. It exposes
 * ONLY the Drizzle query-builder surface -- no .prepare()/.run() -- so a regression to
 * the raw D1 API would throw.
 */
function createFakeDriver() {
    const rows: Row[] = [];

    const db = {
        select() {
            return {
                from() {
                    return {
                        where() {
                            return {
                                async limit() {
                                    return rows.slice();
                                },
                            };
                        },
                    };
                },
            };
        },
        delete() {
            return {
                where() {
                    return {
                        async returning() {
                            return rows.splice(0, rows.length);
                        },
                    };
                },
            };
        },
    };

    return {
        rows,
        driver: {
            getDb: () => db,
            getD1: () => db,
            execute: async () => [],
        } as any,
    };
}

let fake: ReturnType<typeof createFakeDriver>;

beforeEach(() => {
    fake = createFakeDriver();
    registerConnection('default', fake.driver);
});

describe('VerificationToken query-builder contract', () => {
    it('findByIdentifierAndToken returns a stored token via the query builder', async () => {
        fake.rows.push({ identifier: 'login:a@e.com', token: 'tok-1', expires: Date.now() + 60_000 });
        const found = await VerificationToken.findByIdentifierAndToken('login:a@e.com', 'tok-1');
        expect(found).not.toBeNull();
        expect(String(found!.get('token'))).toBe('tok-1');
    });

    it('findByIdentifierAndToken returns null when the store has no match', async () => {
        await expect(VerificationToken.findByIdentifierAndToken('login:a@e.com', 'nope')).resolves.toBeNull();
    });

    it('consumeByIdentifierAndToken deletes-and-returns atomically (single-use)', async () => {
        fake.rows.push({ identifier: 'login:a@e.com', token: 'tok-2', expires: Date.now() + 60_000 });

        const first = await VerificationToken.consumeByIdentifierAndToken('login:a@e.com', 'tok-2');
        expect(first).not.toBeNull();
        expect(Number(first!.get('expires'))).toBeGreaterThan(Date.now());

        // Already consumed -> second attempt yields null (store emptied by the delete).
        await expect(VerificationToken.consumeByIdentifierAndToken('login:a@e.com', 'tok-2')).resolves.toBeNull();
    });

    it('concurrent consume of the same token yields exactly one winner', async () => {
        fake.rows.push({ identifier: 'login:a@e.com', token: 'tok-3', expires: Date.now() + 60_000 });
        const results = await Promise.all([
            VerificationToken.consumeByIdentifierAndToken('login:a@e.com', 'tok-3'),
            VerificationToken.consumeByIdentifierAndToken('login:a@e.com', 'tok-3'),
            VerificationToken.consumeByIdentifierAndToken('login:a@e.com', 'tok-3'),
        ]);
        expect(results.filter((r) => r !== null)).toHaveLength(1);
    });

    it('deleteByIdentifierAndToken reports whether a row was removed', async () => {
        fake.rows.push({ identifier: 'login:a@e.com', token: 'tok-4', expires: Date.now() + 60_000 });
        await expect(VerificationToken.deleteByIdentifierAndToken('login:a@e.com', 'tok-4')).resolves.toBe(true);
        await expect(VerificationToken.deleteByIdentifierAndToken('login:a@e.com', 'tok-4')).resolves.toBe(false);
    });

    it('does not use the raw D1 .prepare()/.run() API (regression guard)', async () => {
        // The fake driver's getDb() intentionally exposes no .prepare/.run; if the model
        // regressed to the raw D1 API these calls would throw instead of resolving.
        fake.rows.push({ identifier: 'id', token: 't', expires: Date.now() + 1000 });
        await expect(VerificationToken.findByIdentifierAndToken('id', 't')).resolves.not.toBeNull();
    });
});
