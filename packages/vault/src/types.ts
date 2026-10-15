// ============================================================
// @ottabase/vault — backups, restore, per-tenant export
// ============================================================
// D1 has point-in-time recovery, which is Cloudflare's safety net. This is yours: a copy of
// every table in a bucket you control, readable by anything that reads JSON, restorable
// into a fresh database, and sliceable per tenant when a customer asks for their data.
// ============================================================

export type Awaitable<T> = T | Promise<T>;

export interface RawResult {
    results?: Array<Record<string, unknown>>;
    meta?: { changes?: number };
}

export interface RawStatement {
    sql: string;
    params?: unknown[];
}

/** Raw SQL against the app's database. `batch` runs statements as one transaction (D1's `batch`). */
export interface RawDriver {
    executeRaw(sql: string, params?: unknown[]): Promise<RawResult>;
    batch?(statements: RawStatement[]): Promise<RawResult[]>;
}

/** The slice of `R2Bucket` the vault uses, so tests can hand it a Map. */
export interface BucketLike {
    put(
        key: string,
        value: string | ArrayBuffer | ReadableStream,
        options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
    ): Promise<unknown>;
    get(key: string): Promise<{ text(): Promise<string> } | null>;
    list(options?: { prefix?: string; delimiter?: string; cursor?: string; limit?: number }): Promise<{
        objects: Array<{ key: string; size: number }>;
        delimitedPrefixes: string[];
        truncated: boolean;
        cursor?: string;
    }>;
    delete(keys: string | string[]): Promise<void>;
}

export interface BackupTable {
    name: string;
    /** Object key of the table's NDJSON. */
    key: string;
    rows: number;
    bytes: number;
    /** Column order at backup time; restore intersects it with the live table. */
    columns: string[];
}

export interface BackupManifest {
    version: 1;
    id: string;
    appId: string;
    label: string | null;
    createdAt: string;
    durationMs: number;
    tables: BackupTable[];
    /** `CREATE TABLE` statements as SQLite reported them, for reference and for rebuilding elsewhere. */
    schema: Array<{ name: string; sql: string }>;
}

export interface RestoreResult {
    id: string;
    tables: Array<{ name: string; rows: number; skippedColumns: string[] }>;
    /** Tables in the backup that no longer exist (or are excluded) and were left alone. */
    skippedTables: string[];
}

/** Which rows a tenant export takes: every row whose `column` equals `value`, in every table that has the column. */
export interface ExportScope {
    column: string;
    value: string;
}

export interface VaultOptions<Env> {
    driver: (env: Env) => RawDriver;
    /** The bucket backups live in. Null means backups are not configured (routes answer 503). */
    bucket: (env: Env) => BucketLike | null | undefined;
    appId: (env: Env) => string;
    /** Key prefix inside the bucket. Default `vault`. Keys are `<prefix>/<appId>/<backupId>/<table>.ndjson`. */
    prefix?: string;
    /** Tables never backed up, restored or exported, on top of SQLite's and D1's own. */
    exclude?: string[];
    /** Rows read per query. Default 1000. */
    pageSize?: number;
    now?: () => Date;
    /** Backup id for a timestamp. Must sort chronologically. */
    id?: (at: Date) => string;
}

export interface Vault<Env> {
    /** User tables, with their CREATE statements. */
    tables(env: Env): Promise<Array<{ name: string; sql: string }>>;
    backup(env: Env, options?: { tables?: string[]; label?: string }): Promise<BackupManifest>;
    /** Newest first. */
    list(env: Env, limit?: number): Promise<BackupManifest[]>;
    manifest(env: Env, id: string): Promise<BackupManifest | null>;
    /**
     * Put the backup's rows back. Each table is emptied first unless `truncate: false` (then
     * rows are upserted by primary key). Runs as one transaction with deferred foreign keys when
     * the driver can batch, so parents and children land together.
     */
    restore(env: Env, id: string, options?: { tables?: string[]; truncate?: boolean }): Promise<RestoreResult>;
    remove(env: Env, id: string): Promise<boolean>;
    /** Delete backups older than `keepDays`, always keeping the newest one. Returns the ids removed. */
    prune(env: Env, keepDays: number): Promise<string[]>;
    /** NDJSON stream of `{ table, row }` lines for one tenant. */
    export(env: Env, scope: ExportScope, options?: { tables?: string[] }): ReadableStream<Uint8Array>;
}

export class VaultError extends Error {
    constructor(
        public readonly code: 'NO_BUCKET' | 'NOT_FOUND' | 'VALIDATION',
        message: string,
    ) {
        super(message);
        this.name = 'VaultError';
    }
}
