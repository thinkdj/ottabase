import { byteLength, decodeRow, encodeRow, isInternalTable, isValidBackupId, ndjsonLines, quoteIdent } from './codec';
import { collectGarbage, contentKey, parseEntries, restoreObjects, snapshotObjects } from './objects';
import {
    VaultError,
    type BackupManifest,
    type BackupObjects,
    type BackupTable,
    type BucketLike,
    type RawDriver,
    type RawStatement,
    type RestoreResult,
    type Vault,
    type VaultOptions,
} from './types';

/** D1 binds at most 100 parameters per statement. */
const MAX_PARAMS = 100;

/** `20261016T022300Z-3f9a`: sorts chronologically, safe in a URL and an object key. */
export function defaultBackupId(at: Date): string {
    const stamp = at
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
    return `${stamp}-${crypto.randomUUID().slice(0, 4)}`;
}

export function createVault<Env = unknown>(options: VaultOptions<Env>): Vault<Env> {
    const prefix = options.prefix ?? 'vault';
    const pageSize = options.pageSize ?? 1000;
    const now = options.now ?? (() => new Date());
    const makeId = options.id ?? defaultBackupId;
    const excluded = new Set(options.exclude ?? []);
    const skip = (name: string) => isInternalTable(name) || excluded.has(name);

    const bucketOf = (env: Env): BucketLike => {
        const bucket = options.bucket(env);
        if (!bucket) throw new VaultError('NO_BUCKET', 'No bucket is configured for backups');
        return bucket;
    };
    const appDir = (env: Env) => `${prefix}/${options.appId(env)}/`;
    const backupDir = (env: Env, id: string) => {
        if (!isValidBackupId(id)) throw new VaultError('VALIDATION', `Invalid backup id "${id}"`);
        return `${appDir(env)}${id}/`;
    };
    /** The content store: one object per etag, shared by every snapshot of the app. */
    const objectStore = (env: Env) => `${appDir(env)}_objects/`;
    /** The bound source buckets, by name. */
    const objectSources = (env: Env): Array<[string, BucketLike]> => {
        if (!options.objects) return [];
        const buckets = options.objects.buckets ?? { files: options.bucket };
        return Object.entries(buckets).flatMap(([name, bucket]) => {
            const bound = bucket(env);
            return bound ? [[name, bound] as [string, BucketLike]] : [];
        });
    };

    async function tables(env: Env): Promise<Array<{ name: string; sql: string }>> {
        const rows =
            (
                await options
                    .driver(env)
                    .executeRaw(`SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name`)
            ).results ?? [];
        return rows
            .map((row) => ({ name: String(row.name), sql: String(row.sql ?? '') }))
            .filter((table) => !skip(table.name));
    }

    async function columns(driver: RawDriver, table: string): Promise<string[]> {
        const rows = (await driver.executeRaw(`PRAGMA table_info(${quoteIdent(table)})`)).results ?? [];
        return rows.map((row) => String(row.name));
    }

    /** Rows in rowid order, a page at a time, so a large table never comes back in one result. */
    async function* rows(
        driver: RawDriver,
        table: string,
        where?: { sql: string; params: unknown[] },
    ): AsyncGenerator<Record<string, unknown>> {
        const from = quoteIdent(table);
        const filter = where ? ` AND ${where.sql}` : '';
        const filterParams = where?.params ?? [];
        let cursor: number | null = null;
        for (;;) {
            const sql =
                cursor === null
                    ? `SELECT rowid AS _rowid_, * FROM ${from} WHERE 1 = 1${filter} ORDER BY rowid LIMIT ?`
                    : `SELECT rowid AS _rowid_, * FROM ${from} WHERE rowid > ?${filter} ORDER BY rowid LIMIT ?`;
            const params = cursor === null ? [...filterParams, pageSize] : [cursor, ...filterParams, pageSize];
            let page: Array<Record<string, unknown>>;
            try {
                page = (await driver.executeRaw(sql, params)).results ?? [];
            } catch (error) {
                // ponytail: a WITHOUT ROWID table cannot be keyset-paged this way; read it whole.
                if (cursor === null && /rowid/i.test(error instanceof Error ? error.message : String(error))) {
                    const all =
                        (await driver.executeRaw(`SELECT * FROM ${from} WHERE 1 = 1${filter}`, filterParams)).results ??
                        [];
                    for (const row of all) yield row;
                    return;
                }
                throw error;
            }
            for (const row of page) {
                const { _rowid_, ...rest } = row;
                cursor = Number(_rowid_);
                yield rest;
            }
            if (page.length < pageSize) return;
        }
    }

    async function readManifest(bucket: BucketLike, dir: string): Promise<BackupManifest | null> {
        const object = await bucket.get(`${dir}manifest.json`);
        if (!object) return null;
        return JSON.parse(await object.text()) as BackupManifest;
    }

    async function listIds(env: Env, bucket: BucketLike): Promise<string[]> {
        const base = appDir(env);
        const ids: string[] = [];
        let cursor: string | undefined;
        do {
            const page = await bucket.list({ prefix: base, delimiter: '/', cursor });
            for (const dir of page.delimitedPrefixes) ids.push(dir.slice(base.length, -1));
            cursor = page.truncated ? page.cursor : undefined;
        } while (cursor);
        return ids.sort().reverse();
    }

    async function keysUnder(bucket: BucketLike, dir: string): Promise<string[]> {
        const keys: string[] = [];
        let cursor: string | undefined;
        do {
            const page = await bucket.list({ prefix: dir, cursor });
            for (const object of page.objects) keys.push(object.key);
            cursor = page.truncated ? page.cursor : undefined;
        } while (cursor);
        return keys;
    }

    const api: Vault<Env> = {
        tables,

        async backup(env, { tables: only, label, objects: withObjects = true, trigger = 'manual' } = {}) {
            const started = now();
            const t0 = Date.now();
            const driver = options.driver(env);
            const bucket = bucketOf(env);
            const id = makeId(started);
            const dir = backupDir(env, id);
            const all = await tables(env);
            const chosen = only ? all.filter((table) => only.includes(table.name)) : all;
            const out: BackupTable[] = [];
            for (const table of chosen) {
                const cols = await columns(driver, table.name);
                // ponytail: a table's NDJSON is assembled in memory; move to an R2 multipart upload
                // per page when one table outgrows the Worker's heap.
                const lines: string[] = [];
                for await (const row of rows(driver, table.name)) lines.push(JSON.stringify(encodeRow(row)));
                const body = lines.length ? `${lines.join('\n')}\n` : '';
                const key = `${dir}${table.name}.ndjson`;
                await bucket.put(key, body, { httpMetadata: { contentType: 'application/x-ndjson' } });
                out.push({ name: table.name, key, rows: lines.length, bytes: byteLength(body), columns: cols });
            }
            const sources = withObjects ? objectSources(env) : [];
            let snapshot: Record<string, BackupObjects> | undefined;
            for (const [name, source] of sources) {
                snapshot ??= {};
                snapshot[name] = await snapshotObjects({
                    source,
                    vault: bucket,
                    store: objectStore(env),
                    prefixes: options.objects?.prefixes ?? [''],
                    exclude: [`${prefix}/`, ...(options.objects?.exclude ?? [])],
                    dir,
                    name,
                });
            }
            const manifest: BackupManifest = {
                version: 1,
                id,
                appId: options.appId(env),
                label: label ?? null,
                trigger,
                createdAt: started.toISOString(),
                durationMs: Date.now() - t0,
                tables: out,
                schema: chosen.map(({ name, sql }) => ({ name, sql })),
                ...(snapshot ? { objects: snapshot } : {}),
            };
            // Written last: a backup that died halfway is never listed, and never restored.
            await bucket.put(`${dir}manifest.json`, JSON.stringify(manifest), {
                httpMetadata: { contentType: 'application/json' },
            });
            return manifest;
        },

        async list(env, limit = 20) {
            const bucket = bucketOf(env);
            const ids = (await listIds(env, bucket)).slice(0, limit);
            const manifests: BackupManifest[] = [];
            for (const id of ids) {
                const manifest = await readManifest(bucket, backupDir(env, id));
                if (manifest) manifests.push(manifest);
            }
            return manifests;
        },

        async manifest(env, id) {
            return readManifest(bucketOf(env), backupDir(env, id));
        },

        async restore(env, id, { tables: only, truncate = true, objects: withObjects = true } = {}) {
            const driver = options.driver(env);
            const bucket = bucketOf(env);
            const manifest = await readManifest(bucket, backupDir(env, id));
            if (!manifest) throw new VaultError('NOT_FOUND', `Backup ${id} not found`);
            const live = new Set((await tables(env)).map((table) => table.name));
            const result: RestoreResult = { id, tables: [], skippedTables: [] };
            const statements: RawStatement[] = [{ sql: 'PRAGMA defer_foreign_keys = true' }];

            for (const table of manifest.tables) {
                if (only && !only.includes(table.name)) continue;
                if (!live.has(table.name) || skip(table.name)) {
                    result.skippedTables.push(table.name);
                    continue;
                }
                const object = await bucket.get(table.key);
                if (!object) {
                    result.skippedTables.push(table.name);
                    continue;
                }
                const current = new Set(await columns(driver, table.name));
                const cols = table.columns.filter((column) => current.has(column));
                const skippedColumns = table.columns.filter((column) => !current.has(column));
                const target = quoteIdent(table.name);
                if (truncate) statements.push({ sql: `DELETE FROM ${target}` });
                let inserted = 0;
                if (cols.length > 0) {
                    const columnList = cols.map(quoteIdent).join(', ');
                    const perStatement = Math.max(1, Math.floor(MAX_PARAMS / cols.length));
                    let batch: unknown[][] = [];
                    const flush = () => {
                        if (batch.length === 0) return;
                        const values = batch.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ');
                        statements.push({
                            sql: `INSERT OR REPLACE INTO ${target} (${columnList}) VALUES ${values}`,
                            params: batch.flat(),
                        });
                        inserted += batch.length;
                        batch = [];
                    };
                    for (const line of ndjsonLines(await object.text())) {
                        const row = decodeRow(line);
                        batch.push(cols.map((column) => row[column] ?? null));
                        if (batch.length >= perStatement) flush();
                    }
                    flush();
                }
                result.tables.push({ name: table.name, rows: inserted, skippedColumns });
            }

            if (driver.batch) {
                await driver.batch(statements);
            } else {
                // ponytail: without a batch the restore is not atomic and foreign keys are checked per
                // statement; give the driver a `batch` (D1 has one) for a real restore.
                for (const statement of statements) await driver.executeRaw(statement.sql, statement.params);
            }
            if (withObjects && manifest.objects) {
                const sources = new Map(objectSources(env));
                for (const [name, snapshot] of Object.entries(manifest.objects)) {
                    // A bucket no longer bound (or renamed) cannot take its objects back: left alone.
                    const source = sources.get(name);
                    if (!source) continue;
                    const listing = await bucket.get(snapshot.key);
                    result.objects ??= {};
                    result.objects[name] = await restoreObjects({
                        source,
                        vault: bucket,
                        store: objectStore(env),
                        entries: listing ? parseEntries(await listing.text()) : [],
                    });
                }
            }
            return result;
        },

        async remove(env, id) {
            const bucket = bucketOf(env);
            const keys = await keysUnder(bucket, backupDir(env, id));
            for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
            return keys.length > 0;
        },

        async prune(env, keepDays) {
            const cutoff = now().getTime() - keepDays * 86_400_000;
            const manifests = await api.list(env, Number.MAX_SAFE_INTEGER);
            const removed: string[] = [];
            // The newest backup is never pruned, whatever its age: an old copy beats no copy.
            for (const manifest of manifests.slice(1)) {
                if (Date.parse(manifest.createdAt) < cutoff) {
                    await api.remove(env, manifest.id);
                    removed.push(manifest.id);
                }
            }
            // Object bytes are shared across snapshots: once a backup is gone, drop what no other names.
            if (removed.length && options.objects) {
                const bucket = bucketOf(env);
                const store = objectStore(env);
                const referenced = new Set<string>();
                for (const manifest of manifests) {
                    if (removed.includes(manifest.id) || !manifest.objects) continue;
                    for (const snapshot of Object.values(manifest.objects)) {
                        const listing = await bucket.get(snapshot.key);
                        if (!listing) continue;
                        for (const entry of parseEntries(await listing.text()))
                            referenced.add(contentKey(store, entry.etag));
                    }
                }
                await collectGarbage(bucket, store, referenced);
            }
            return removed;
        },

        export(env, scope, { tables: only } = {}) {
            const column = quoteIdent(scope.column);
            const driver = options.driver(env);
            const encoder = new TextEncoder();
            const lines = (async function* () {
                const all = await tables(env);
                for (const table of all) {
                    if (only && !only.includes(table.name)) continue;
                    if (!(await columns(driver, table.name)).includes(scope.column)) continue;
                    const where = { sql: `${column} = ?`, params: [scope.value] };
                    for await (const row of rows(driver, table.name, where)) {
                        yield encoder.encode(`${JSON.stringify({ table: table.name, row: encodeRow(row) })}\n`);
                    }
                }
            })();
            return new ReadableStream<Uint8Array>({
                async pull(controller) {
                    const next = await lines.next();
                    if (next.done) controller.close();
                    else controller.enqueue(next.value);
                },
                cancel() {
                    void lines.return(undefined);
                },
            });
        },
    };
    return api;
}

/** The slice of `D1Database` the adapter needs. */
export interface D1Like {
    prepare(sql: string): D1StatementLike;
    batch(statements: D1StatementLike[]): Promise<Array<{ results?: unknown[]; meta?: { changes?: number } }>>;
}
export interface D1StatementLike {
    bind(...values: unknown[]): D1StatementLike;
    all(): Promise<{ results?: unknown[]; meta?: { changes?: number } }>;
}

/** A `RawDriver` over the D1 binding, with `batch` so restores run as one transaction. */
export function d1Driver(d1: D1Like): Required<RawDriver> {
    const prepare = (sql: string, params: unknown[] = []) =>
        params.length > 0 ? d1.prepare(sql).bind(...params) : d1.prepare(sql);
    return {
        executeRaw: async (sql, params) =>
            (await prepare(sql, params).all()) as Awaited<ReturnType<RawDriver['executeRaw']>>,
        batch: async (statements) =>
            (await d1.batch(statements.map((statement) => prepare(statement.sql, statement.params)))) as Awaited<
                ReturnType<NonNullable<RawDriver['batch']>>
            >,
    };
}
