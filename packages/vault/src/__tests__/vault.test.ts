import { createPackageRegistry } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { createMemoryStateStore, createPremiumRegistry } from '@ottabase/premium';
import { mountPremiumPackages } from '@ottabase/premium/server';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import {
    createVault,
    createVaultPackage,
    d1Driver,
    defaultBackupId,
    DEMO_PRO_LICENSE,
    type BucketLike,
    type RawDriver,
} from '../index';

// ---------- a real database (Node's SQLite) and a Map-backed bucket ----------

function sqliteDriver(db: DatabaseSync): Required<RawDriver> {
    const driver: Required<RawDriver> = {
        async executeRaw(sql, params = []) {
            const statement = db.prepare(sql);
            if (/^\s*(SELECT|PRAGMA|WITH)/i.test(sql)) {
                return { results: statement.all(...(params as SQLInputValue[])).map((row) => ({ ...row })) };
            }
            const info = statement.run(...(params as SQLInputValue[]));
            return { results: [], meta: { changes: Number(info.changes) } };
        },
        async batch(statements) {
            db.exec('BEGIN');
            try {
                const out = [];
                for (const statement of statements) out.push(await driver.executeRaw(statement.sql, statement.params));
                db.exec('COMMIT');
                return out;
            } catch (error) {
                db.exec('ROLLBACK');
                throw error;
            }
        },
    };
    return driver;
}

function memoryBucket(): BucketLike & { objects: Map<string, string> } {
    const objects = new Map<string, string>();
    return {
        objects,
        async put(key, value) {
            objects.set(key, typeof value === 'string' ? value : new TextDecoder().decode(value as ArrayBuffer));
        },
        async get(key) {
            const value = objects.get(key);
            return value === undefined ? null : { text: async () => value };
        },
        async list({ prefix = '', delimiter } = {}) {
            const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
            const prefixes = new Set<string>();
            const direct: Array<{ key: string; size: number }> = [];
            for (const key of keys) {
                const rest = key.slice(prefix.length);
                const at = delimiter ? rest.indexOf(delimiter) : -1;
                if (at >= 0) prefixes.add(prefix + rest.slice(0, at + 1));
                else direct.push({ key, size: objects.get(key)!.length });
            }
            return { objects: direct, delimitedPrefixes: [...prefixes], truncated: false };
        },
        async delete(keys) {
            for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
        },
    };
}

function seed(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    db.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id TEXT NOT NULL REFERENCES organizations(id),
            title TEXT NOT NULL,
            body BLOB,
            score REAL
        );
        CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID;
        CREATE TABLE _cf_KV (k TEXT);
        INSERT INTO organizations VALUES ('org-a', 'Acme'), ('org-b', 'Bolt');
        INSERT INTO posts (organization_id, title, body, score) VALUES
            ('org-a', 'one', X'0102', 1.5), ('org-a', 'two', NULL, NULL), ('org-b', 'three', X'FF', 0);
        INSERT INTO settings VALUES ('theme', 'dark');
    `);
    return db;
}

type Env = { bucket: BucketLike | null; db: DatabaseSync };
type MemoryBucket = ReturnType<typeof memoryBucket>;

function build(db = seed(), bucket: MemoryBucket | null = memoryBucket()) {
    let tick = 0;
    // Real time, not a fixed date: the health probe ages backups against Date.now().
    const base = Date.now();
    const vault = createVault<Env>({
        driver: (env) => sqliteDriver(env.db),
        bucket: (env) => env.bucket,
        appId: () => 'app',
        pageSize: 2, // small on purpose: every table with 3 rows exercises keyset paging
        now: () => new Date(base + tick++),
        id: (at) => `${at.toISOString().replace(/[-:.]/g, '')}-${tick}`,
    });
    return { vault, env: { bucket, db } as Env, bucket };
}

const rows = (db: DatabaseSync, sql: string) =>
    db
        .prepare(sql)
        .all()
        .map((row) => ({ ...row }));

describe('backup', () => {
    it('writes one NDJSON object per user table and a manifest last, skipping internal tables', async () => {
        const { vault, env, bucket } = build();
        const manifest = await vault.backup(env, { label: 'first' });

        expect(manifest.tables.map((table) => table.name)).toEqual(['organizations', 'posts', 'settings']);
        expect(manifest.tables.find((table) => table.name === 'posts')).toMatchObject({
            rows: 3,
            columns: ['id', 'organization_id', 'title', 'body', 'score'],
        });
        expect(manifest.schema.find((table) => table.name === 'settings')?.sql).toContain('WITHOUT ROWID');
        expect(manifest.label).toBe('first');

        const keys = [...bucket!.objects.keys()];
        expect(keys).toContain(`vault/app/${manifest.id}/posts.ndjson`);
        expect(keys).toContain(`vault/app/${manifest.id}/manifest.json`);
        expect(keys.some((key) => key.includes('_cf_KV'))).toBe(false);

        const lines = bucket!.objects
            .get(`vault/app/${manifest.id}/posts.ndjson`)!
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
        expect(lines[0]).toEqual({
            id: 1,
            organization_id: 'org-a',
            title: 'one',
            body: { $blob: 'AQI=' },
            score: 1.5,
        });
        expect(lines[1].body).toBeNull();
        expect(lines).toHaveLength(3);
    });

    it('lists newest first, reads one manifest, and refuses to run without a bucket', async () => {
        const { vault, env } = build();
        const first = await vault.backup(env);
        const second = await vault.backup(env, { tables: ['posts'] });
        const listed = await vault.list(env);
        expect(listed.map((manifest) => manifest.id)).toEqual([second.id, first.id]);
        expect((await vault.list(env, 1)).map((m) => m.id)).toEqual([second.id]);
        expect((await vault.manifest(env, second.id))?.tables.map((t) => t.name)).toEqual(['posts']);
        expect(await vault.manifest(env, 'nope')).toBeNull();
        await expect(vault.manifest(env, '../escape')).rejects.toThrow(/Invalid backup id/);

        const { vault: dry, env: dryEnv } = build(seed(), null);
        await expect(dry.backup(dryEnv)).rejects.toMatchObject({ code: 'NO_BUCKET' });
        expect(defaultBackupId(new Date('2026-10-16T02:23:00.123Z'))).toMatch(/^20261016T022300Z-[0-9a-f]{4}$/);
    });
});

describe('restore', () => {
    it('puts every row back in one transaction, blobs included, with foreign keys enforced', async () => {
        const { vault, env } = build();
        const before = rows(env.db, 'SELECT * FROM posts ORDER BY id');
        const manifest = await vault.backup(env);

        env.db.exec(
            `DELETE FROM posts WHERE id = 1; UPDATE posts SET title = 'changed' WHERE id = 2; UPDATE organizations SET name = 'Renamed' WHERE id = 'org-a'; DELETE FROM settings;`,
        );
        const result = await vault.restore(env, manifest.id);

        expect(result.tables).toEqual([
            { name: 'organizations', rows: 2, skippedColumns: [] },
            { name: 'posts', rows: 3, skippedColumns: [] },
            { name: 'settings', rows: 1, skippedColumns: [] },
        ]);
        expect(rows(env.db, 'SELECT * FROM posts ORDER BY id')).toEqual(before);
        expect(rows(env.db, "SELECT name FROM organizations WHERE id = 'org-a'")).toEqual([{ name: 'Acme' }]);
        expect(rows(env.db, 'SELECT * FROM settings')).toEqual([{ key: 'theme', value: 'dark' }]);
        expect(env.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    });

    it('survives schema drift: dropped columns are skipped, dropped tables left alone, and a table filter honoured', async () => {
        const { vault, env } = build();
        const manifest = await vault.backup(env);
        env.db.exec('ALTER TABLE posts DROP COLUMN score; DROP TABLE settings; DELETE FROM posts;');

        const result = await vault.restore(env, manifest.id, { tables: ['posts', 'settings'] });
        expect(result.tables).toEqual([{ name: 'posts', rows: 3, skippedColumns: ['score'] }]);
        expect(result.skippedTables).toEqual(['settings']);
        expect(rows(env.db, 'SELECT title FROM posts ORDER BY id').map((r) => r.title)).toEqual([
            'one',
            'two',
            'three',
        ]);

        await expect(vault.restore(env, 'missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('with truncate off, rows are upserted and extra live rows survive', async () => {
        const { vault, env } = build();
        const manifest = await vault.backup(env);
        env.db.exec(
            "UPDATE posts SET title = 'edited' WHERE id = 1; INSERT INTO posts (organization_id, title) VALUES ('org-b', 'new')",
        );
        await vault.restore(env, manifest.id, { tables: ['posts'], truncate: false });
        expect(rows(env.db, 'SELECT title FROM posts ORDER BY id').map((r) => r.title)).toEqual([
            'one',
            'two',
            'three',
            'new',
        ]);
    });
});

describe('export and prune', () => {
    it('streams one tenant as {table,row} lines from every table that has the column', async () => {
        const { vault, env } = build();
        const text = await new Response(vault.export(env, { column: 'organization_id', value: 'org-a' })).text();
        const lines = text
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
        expect(lines).toHaveLength(2);
        expect(lines.every((line) => line.table === 'posts' && line.row.organization_id === 'org-a')).toBe(true);
        expect(lines[0].row.body).toEqual({ $blob: 'AQI=' });
        expect(() => vault.export(env, { column: 'organization_id; DROP TABLE posts', value: 'x' })).toThrow(
            /unsafe identifier/,
        );
    });

    it('prunes old backups but never the newest, and removes every object of a pruned backup', async () => {
        const { vault, env, bucket } = build();
        const old = await vault.backup(env);
        const newer = await vault.backup(env);
        // Date the first backup back a year; the second stays fresh.
        const key = `vault/app/${old.id}/manifest.json`;
        bucket!.objects.set(key, JSON.stringify({ ...old, createdAt: '2025-01-01T00:00:00.000Z' }));

        expect(await vault.prune(env, 30)).toEqual([old.id]);
        expect([...bucket!.objects.keys()].some((k) => k.includes(old.id))).toBe(false);
        expect(await vault.manifest(env, newer.id)).not.toBeNull();

        // Only one left, however old: kept.
        bucket!.objects.set(
            `vault/app/${newer.id}/manifest.json`,
            JSON.stringify({ ...newer, createdAt: '2020-01-01T00:00:00.000Z' }),
        );
        expect(await vault.prune(env, 1)).toEqual([]);
        expect(await vault.remove(env, 'never-existed')).toBe(false);
    });
});

describe('d1Driver', () => {
    it('binds parameters and batches prepared statements', async () => {
        const calls: string[] = [];
        const statement = (sql: string) => ({
            bind: (...values: unknown[]) => (calls.push(`bind ${sql} ${JSON.stringify(values)}`), statement(sql)),
            all: async () => (calls.push(`all ${sql}`), { results: [{ ok: 1 }], meta: { changes: 1 } }),
        });
        const d1 = {
            prepare: (sql: string) => (calls.push(`prepare ${sql}`), statement(sql)),
            batch: async (stmts: unknown[]) => stmts.map(() => ({ results: [] })),
        };
        const driver = d1Driver(d1);
        expect(await driver.executeRaw('SELECT ?', [1])).toEqual({ results: [{ ok: 1 }], meta: { changes: 1 } });
        expect(await driver.batch([{ sql: 'A' }, { sql: 'B', params: [2] }])).toHaveLength(2);
        expect(calls).toEqual([
            'prepare SELECT ?',
            'bind SELECT ? [1]',
            'all SELECT ?',
            'prepare A',
            'prepare B',
            'bind B [2]',
        ]);
    });
});

describe('routes and package (a Premium Package)', () => {
    type RouteEnv = Env & {
        who?: { userId: string; organizationId: string | null; platformAdmin?: boolean; canManage?: boolean } | null;
        PREMIUM_LICENSE_VAULT?: string;
    };

    function mount(options: { licensed?: boolean } = {}) {
        const { vault, env: base } = build();
        const pkg = createVaultPackage<RouteEnv>({
            vault: vault as never,
            resolveCaller: (_request, e) =>
                e.who === undefined
                    ? { userId: 'u1', organizationId: 'org-a', appId: 'app', platformAdmin: true, canManage: true }
                    : e.who && { appId: 'app', ...e.who },
            retentionDays: 7,
        });
        const premium = createPremiumRegistry<RouteEnv>({
            packages: [pkg],
            getStore: () => createMemoryStateStore(),
            cacheTtlMs: 0,
        });
        const router = new Router<RouteEnv>();
        mountPremiumPackages(router, premium, { packages: createPackageRegistry<RouteEnv>({ packages: [pkg] }) });
        const env = {
            ...base,
            ...(options.licensed === false ? {} : { PREMIUM_LICENSE_VAULT: DEMO_PRO_LICENSE }),
        } as RouteEnv;
        const call = (path: string, init: RequestInit = {}, e: Partial<RouteEnv> = {}) =>
            router.handle(new Request(`https://app.test/api/vault${path}`, init), { ...env, ...e } as RouteEnv);
        return { router, env, pkg, vault, premium, call };
    }
    const post = (body: unknown): RequestInit => ({
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
    });

    it('is a Premium Package whose free tier keeps backup, restore and delete', () => {
        const { pkg } = mount();
        expect(pkg.premium).toBe(true);
        expect(pkg.freeFeatures).toEqual(['backup']);
        expect(pkg.freeLimits).toEqual({ backups: 5 });
        expect(pkg.routes?.gate).toBe('entitlements');
        expect(pkg.nav?.[0].href).toBe('/admin/infrastructure/vault');
    });

    it('backs up, lists, restores with confirmation, and deletes, for platform admins only', async () => {
        const { call, env } = mount();
        expect((await call('/backups', {}, { who: null }))?.status).toBe(401);
        expect((await call('/backups', {}, { who: { userId: 'u2', organizationId: 'org-a' } }))?.status).toBe(403);

        const created = await call('/backups', post({ label: 'manual' }));
        expect(created?.status).toBe(201);
        const { data: manifest } = (await created!.json()) as { data: { id: string; label: string } };
        expect(manifest.label).toBe('manual');
        expect(((await (await call('/backups'))!.json()) as { data: unknown[] }).data).toHaveLength(1);
        expect((await call(`/backups/${manifest.id}`))?.status).toBe(200);

        env.db.exec('DELETE FROM posts');
        const unconfirmed = await call(`/backups/${manifest.id}/restore`, { method: 'POST', body: '{}' });
        expect(unconfirmed?.status).toBe(400);
        const restored = await call(`/backups/${manifest.id}/restore`, post({ confirm: manifest.id }));
        expect(restored?.status).toBe(200);
        expect(rows(env.db, 'SELECT count(*) AS n FROM posts')).toEqual([{ n: 3 }]);

        expect((await call(`/backups/${manifest.id}`, { method: 'DELETE' }))?.status).toBe(200);
        expect((await call(`/backups/${manifest.id}`))?.status).toBe(404);
        expect((await call('/backups', {}, { bucket: null }))?.status).toBe(503);
    });

    it("unlicensed: the sixth backup is 402 with the limit, operator export is 402, a user's own export stays free", async () => {
        const { call } = mount({ licensed: false });
        for (let i = 0; i < 5; i++) expect((await call('/backups', post({ label: `b${i}` })))?.status).toBe(201);
        const sixth = await call('/backups', post({}));
        expect(sixth?.status).toBe(402);
        const body = (await sixth!.json()) as { code: string; metadata: Record<string, unknown> };
        expect(body.code).toBe('PREMIUM_REQUIRED');
        expect(body.metadata).toMatchObject({ package: 'vault', reason: 'LIMIT_REACHED', limit: 5, upsell: true });

        const operator = await call('/export?organizationId=org-b');
        expect(operator?.status).toBe(402);
        expect(((await operator!.json()) as { metadata: { reason: string } }).metadata.reason).toBe('LICENSE_MISSING');

        const me = await call('/export/me', {}, { who: { userId: 'u3', organizationId: 'org-a', canManage: true } });
        expect(me?.status).toBe(200);
        expect((await me!.text()).trim().split('\n')).toHaveLength(2);
    });

    it("licensed: operator export streams a tenant and the kept-backups ceiling is the license's", async () => {
        const { call } = mount();
        const admin = await call('/export?organizationId=org-b');
        expect(admin?.status).toBe(200);
        expect(admin?.headers.get('content-disposition')).toContain('organization-org-b.ndjson');
        expect((await admin!.text()).trim().split('\n')).toHaveLength(1);
        expect((await call('/export'))?.status).toBe(400);
        for (let i = 0; i < 6; i++) expect((await call('/backups', post({})))?.status).toBe(201);
        const member = await call(
            '/export/me',
            {},
            { who: { userId: 'u4', organizationId: 'org-a', canManage: false } },
        );
        expect(member?.headers.get('content-disposition')).toContain('user-u4.ndjson');
        expect((await member!.text()).trim()).toBe('');
    });

    it('the scheduled handler runs only with a license, then prunes; health follows the same gate', async () => {
        const unlicensed = mount({ licensed: false });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await unlicensed.pkg.cron!['vault:backup'].handler({ env: unlicensed.env, payload: null } as never);
        expect(await unlicensed.vault.list(unlicensed.env)).toEqual([]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('unlicensed'));
        warn.mockRestore();
        expect(await unlicensed.pkg.health!(unlicensed.env)).toMatchObject({ name: 'vault:schedule', ok: true });

        const { pkg, env, vault } = mount();
        const prune = vi.spyOn(vault, 'prune');
        const cron = pkg.cron!['vault:backup'];
        expect(cron.schedule).toBe('23 2 * * *');
        await cron.handler({ env, payload: { retentionDays: 3 } } as never);
        expect(prune).toHaveBeenCalledWith(env, 3);
        expect((await vault.list(env)).map((m) => m.label)).toEqual(['scheduled']);

        const fresh = await pkg.health!(env);
        expect(fresh).toMatchObject({ name: 'vault:latest-backup', ok: true });
        expect((fresh as { detail: string }).detail).toContain('3 tables');
        const [latest] = await vault.list(env, 1);
        (env.bucket as MemoryBucket).objects.set(
            `vault/app/${latest.id}/manifest.json`,
            JSON.stringify({ ...latest, createdAt: '2020-01-01T00:00:00.000Z' }),
        );
        expect(await pkg.health!(env)).toMatchObject({ name: 'vault:latest-backup', ok: false });
        expect(await pkg.health!({ ...env, bucket: null })).toMatchObject({ name: 'vault:bucket', ok: false });
    });

    it('before the routes are mounted the schedule stays off, and health says why', async () => {
        const { vault, env } = build();
        const pkg = createVaultPackage<Env>({ vault, resolveCaller: () => null });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await pkg.cron!['vault:backup'].handler({ env, payload: null } as never);
        warn.mockRestore();
        expect(await vault.list(env)).toEqual([]);
        expect(await pkg.health!(env)).toMatchObject({ name: 'vault:schedule', ok: false });
    });
});
