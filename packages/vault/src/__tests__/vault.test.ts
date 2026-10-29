import { createPackageRegistry, mountPackages } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { createVault, createVaultPackage, d1Driver, defaultBackupId, type BucketLike, type RawDriver } from '../index';

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

/** A content hash standing in for R2's etag. */
const etagOf = (value: string) => {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
    return hash.toString(16);
};

function memoryBucket(): BucketLike & { objects: Map<string, string>; types: Map<string, string> } {
    const objects = new Map<string, string>();
    const types = new Map<string, string>();
    return {
        objects,
        types,
        async put(key, value, options) {
            objects.set(
                key,
                typeof value === 'string'
                    ? value
                    : value instanceof ReadableStream
                      ? await new Response(value).text()
                      : new TextDecoder().decode(value as ArrayBuffer),
            );
            if (options?.httpMetadata?.contentType) types.set(key, options.httpMetadata.contentType);
        },
        async get(key) {
            const value = objects.get(key);
            if (value === undefined) return null;
            const contentType = types.get(key);
            return {
                text: async () => value,
                body: new Blob([value]).stream(),
                etag: etagOf(value),
                ...(contentType ? { httpMetadata: { contentType } } : {}),
            };
        },
        async list({ prefix = '', delimiter } = {}) {
            const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
            const prefixes = new Set<string>();
            const direct: Array<{ key: string; size: number; etag: string; uploaded: Date }> = [];
            for (const key of keys) {
                const rest = key.slice(prefix.length);
                const at = delimiter ? rest.indexOf(delimiter) : -1;
                if (at >= 0) prefixes.add(prefix + rest.slice(0, at + 1));
                else {
                    const value = objects.get(key)!;
                    direct.push({
                        key,
                        size: value.length,
                        etag: etagOf(value),
                        uploaded: new Date(0),
                        ...(types.get(key) ? { httpMetadata: { contentType: types.get(key)! } } : {}),
                    });
                }
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

describe('object snapshots', () => {
    function withObjects() {
        const bucket = memoryBucket();
        bucket.objects.set('uploads/a.txt', 'alpha');
        bucket.types.set('uploads/a.txt', 'text/plain');
        bucket.objects.set('uploads/b.txt', 'beta');
        bucket.objects.set('og/card.png', 'cached');
        let tick = 0;
        const base = Date.now();
        const vault = createVault<Env>({
            driver: (env) => sqliteDriver(env.db),
            bucket: (env) => env.bucket,
            appId: () => 'app',
            now: () => new Date(base + tick++),
            id: (at) => `${at.toISOString().replace(/[-:.]/g, '')}-${tick}`,
            objects: { exclude: ['og/'] },
        });
        return { vault, env: { bucket, db: seed() } as Env, bucket };
    }

    it('lists the objects beside the tables and copies each etag once, never its own prefix or an excluded one', async () => {
        const { vault, env, bucket } = withObjects();
        const first = await vault.backup(env);
        expect(first.objects).toMatchObject({ key: `vault/app/${first.id}/objects.ndjson`, count: 2, copied: 2 });
        const entries = bucket.objects
            .get(first.objects!.key)!
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
        expect(entries.map((entry) => [entry.key, entry.contentType])).toEqual([
            ['uploads/a.txt', 'text/plain'],
            ['uploads/b.txt', null],
        ]);
        const store = [...bucket.objects.keys()].filter((key) => key.startsWith('vault/app/_objects/'));
        expect(store).toHaveLength(2);
        expect(bucket.types.get(store.find((key) => bucket.objects.get(key) === 'alpha')!)).toBe('text/plain');

        // The same bucket again: nothing new to copy. A changed object: one copy.
        expect((await vault.backup(env)).objects).toMatchObject({ count: 2, copied: 0 });
        bucket.objects.set('uploads/b.txt', 'beta 2');
        expect((await vault.backup(env)).objects).toMatchObject({ count: 2, copied: 1 });
        expect((await vault.backup(env, { objects: false })).objects).toBeUndefined();
        expect((await vault.list(env))[0]!.objects).toBeUndefined();
    });

    it('restores the listed objects, skipping the ones that still match, and reports the missing', async () => {
        const { vault, env, bucket } = withObjects();
        const backup = await vault.backup(env);
        bucket.objects.set('uploads/a.txt', 'changed');
        bucket.objects.delete('uploads/b.txt');
        const restored = await vault.restore(env, backup.id);
        expect(restored.objects).toEqual({ restored: 2, skipped: 0, missing: [] });
        expect(bucket.objects.get('uploads/a.txt')).toBe('alpha');
        expect(bucket.types.get('uploads/a.txt')).toBe('text/plain');
        expect(bucket.objects.get('uploads/b.txt')).toBe('beta');
        expect((await vault.restore(env, backup.id)).objects).toEqual({ restored: 0, skipped: 2, missing: [] });

        for (const key of [...bucket.objects.keys()])
            if (key.startsWith('vault/app/_objects/')) bucket.objects.delete(key);
        bucket.objects.delete('uploads/a.txt');
        expect((await vault.restore(env, backup.id)).objects).toEqual({
            restored: 0,
            skipped: 1,
            missing: ['uploads/a.txt'],
        });
        expect((await vault.restore(env, backup.id, { objects: false })).objects).toBeUndefined();
    });

    it('prunes the bytes no remaining backup names', async () => {
        const { vault, env, bucket } = withObjects();
        const old = await vault.backup(env);
        bucket.objects.set('uploads/a.txt', 'alpha 2');
        const newer = await vault.backup(env);
        bucket.objects.set(
            `vault/app/${old.id}/manifest.json`,
            JSON.stringify({ ...old, createdAt: '2025-01-01T00:00:00.000Z' }),
        );
        const before = [...bucket.objects.keys()].filter((key) => key.startsWith('vault/app/_objects/'));
        expect(before).toHaveLength(3);

        expect(await vault.prune(env, 30)).toEqual([old.id]);
        const after = [...bucket.objects.keys()].filter((key) => key.startsWith('vault/app/_objects/'));
        expect(after).toHaveLength(2);
        expect(after.map((key) => bucket.objects.get(key)).sort()).toEqual(['alpha 2', 'beta']);
        expect((await vault.restore(env, newer.id)).objects).toEqual({ restored: 0, skipped: 2, missing: [] });
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

describe('routes and package', () => {
    type RouteEnv = Env & {
        who?: { userId: string; organizationId: string | null; platformAdmin?: boolean; canManage?: boolean } | null;
    };

    function mount(limits: { maxManualBackups?: number; minBackupIntervalMinutes?: number } = {}) {
        const { vault, env } = build();
        const pkg = createVaultPackage<RouteEnv>({
            vault: vault as never,
            resolveCaller: (_request, e) =>
                e.who === undefined
                    ? { userId: 'u1', organizationId: 'org-a', appId: 'app', platformAdmin: true, canManage: true }
                    : e.who && { appId: 'app', ...e.who },
            retentionDays: 7,
            ...limits,
        });
        const router = new Router<RouteEnv>();
        mountPackages(router, { packages: createPackageRegistry<RouteEnv>({ packages: [pkg] }) });
        const call = (path: string, init: RequestInit = {}, e: Partial<RouteEnv> = {}) =>
            router.handle(new Request(`https://app.test/api/vault${path}`, init), { ...env, ...e } as RouteEnv);
        return { router, env: env as RouteEnv, pkg, vault, call };
    }
    const post = (body: unknown): RequestInit => ({
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
    });

    it('is a free package, mounted by the kernel like any other', () => {
        const { pkg } = mount();
        expect(pkg.premium).toBeUndefined();
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

    it('caps manual backups and spaces them out, leaving scheduled ones uncounted', async () => {
        const { call } = mount({ maxManualBackups: 2 });
        expect((await call('/backups', post({})))?.status).toBe(201);
        const tooSoon = await call('/backups', post({}));
        expect(tooSoon?.status).toBe(429);
        expect(Number(tooSoon?.headers.get('Retry-After'))).toBeGreaterThan(0);

        const unspaced = mount({ maxManualBackups: 2, minBackupIntervalMinutes: 0 });
        expect((await unspaced.call('/backups', post({})))?.status).toBe(201);
        await unspaced.vault.backup(unspaced.env, { trigger: 'scheduled' });
        expect((await unspaced.call('/backups', post({})))?.status).toBe(201);
        const full = await unspaced.call('/backups', post({}));
        expect(full?.status).toBe(409);
        expect(await full!.json()).toMatchObject({ code: 'BACKUP_LIMIT' });
    });

    it('refuses a limit that is not a whole number', () => {
        expect(() => mount({ maxManualBackups: Number.NaN })).toThrow(/maxManualBackups/);
        expect(() => mount({ minBackupIntervalMinutes: -5 })).toThrow(/minBackupIntervalMinutes/);
    });

    it('exports a tenant for the operator and a person their own rows', async () => {
        const { call } = mount();

        const admin = await call('/export?organizationId=org-b');
        expect(admin?.status).toBe(200);
        expect(admin?.headers.get('content-disposition')).toContain('organization-org-b.ndjson');
        expect((await admin!.text()).trim().split('\n')).toHaveLength(1);
        expect((await call('/export'))?.status).toBe(400);
        expect(
            (await call('/export?organizationId=org-b', {}, { who: { userId: 'u5', organizationId: 'org-b' } }))
                ?.status,
        ).toBe(403);

        const manager = await call(
            '/export/me',
            {},
            { who: { userId: 'u3', organizationId: 'org-a', canManage: true } },
        );
        expect(manager?.status).toBe(200);
        expect((await manager!.text()).trim().split('\n')).toHaveLength(2);
        const member = await call(
            '/export/me',
            {},
            { who: { userId: 'u4', organizationId: 'org-a', canManage: false } },
        );
        expect(member?.headers.get('content-disposition')).toContain('user-u4.ndjson');
        expect((await member!.text()).trim()).toBe('');
    });

    it('the scheduled handler backs up, then prunes; health reports the newest backup', async () => {
        const { pkg, env, vault } = mount();
        expect(await pkg.health!(env)).toMatchObject({
            name: 'vault:latest-backup',
            ok: false,
            detail: 'no backup yet',
        });

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
});
