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
    get(key: string): Promise<{
        text(): Promise<string>;
        /** The bytes as a stream, which an R2 `put` takes as is: how an object is copied. */
        body?: ReadableStream;
        etag?: string;
        httpMetadata?: { contentType?: string };
        customMetadata?: Record<string, string>;
    } | null>;
    list(options?: {
        prefix?: string;
        delimiter?: string;
        cursor?: string;
        limit?: number;
        /** R2 lists metadata only when asked. */
        include?: Array<'httpMetadata' | 'customMetadata'>;
    }): Promise<{
        objects: Array<{
            key: string;
            size: number;
            etag?: string;
            uploaded?: Date | string;
            httpMetadata?: { contentType?: string };
        }>;
        delimitedPrefixes: string[];
        truncated: boolean;
        cursor?: string;
    }>;
    delete(keys: string | string[]): Promise<void>;
}

/** What a backup says about the bucket's objects it snapshotted. */
export interface BackupObjects {
    /** Object key of the `objects.ndjson` listing (key, etag, size, uploaded, content type per line). */
    key: string;
    count: number;
    bytes: number;
    /** Objects whose bytes were new to the content store; the rest were there from earlier snapshots. */
    copied: number;
}

export interface RestoredObjects {
    restored: number;
    /** Live objects whose etag already matched the snapshot. */
    skipped: number;
    /** Keys whose bytes were gone from the content store. */
    missing: string[];
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

export type BackupTrigger = 'manual' | 'scheduled';

export interface BackupManifest {
    version: 1;
    id: string;
    appId: string;
    label: string | null;
    /** Who asked for it: an admin, or the nightly schedule. The manual-backup cap counts only `manual`. */
    trigger: BackupTrigger;
    createdAt: string;
    durationMs: number;
    tables: BackupTable[];
    /** `CREATE TABLE` statements as SQLite reported them, for reference and for rebuilding elsewhere. */
    schema: Array<{ name: string; sql: string }>;
    /** The bucket snapshot, when `objects` is configured and was not turned off for this backup. */
    objects?: BackupObjects;
}

export interface RestoreResult {
    id: string;
    tables: Array<{ name: string; rows: number; skippedColumns: string[] }>;
    /** Tables in the backup that no longer exist (or are excluded) and were left alone. */
    skippedTables: string[];
    objects?: RestoredObjects;
}

/** Which of the bucket's objects a backup snapshots. */
export interface ObjectsOptions<Env> {
    /** The bucket whose objects are snapshotted. Default: the vault's own bucket. */
    bucket?: (env: Env) => BucketLike | null | undefined;
    /** Key prefixes to snapshot. Default `['']`: everything. */
    prefixes?: string[];
    /** Key prefixes left out. The vault's own prefix always is. */
    exclude?: string[];
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
    /**
     * Snapshot the bucket's objects (uploads, media) with every backup: their listing beside the
     * tables, their bytes in a content store keyed by etag, copied once. Off when absent.
     */
    objects?: ObjectsOptions<Env>;
}

export interface Vault<Env> {
    /** User tables, with their CREATE statements. */
    tables(env: Env): Promise<Array<{ name: string; sql: string }>>;
    /**
     * `objects: false` leaves the bucket out of this backup even when snapshots are configured.
     * `trigger` defaults to `manual`; the cron job passes `scheduled`.
     */
    backup(
        env: Env,
        options?: { tables?: string[]; label?: string; objects?: boolean; trigger?: BackupTrigger },
    ): Promise<BackupManifest>;
    /** Newest first. */
    list(env: Env, limit?: number): Promise<BackupManifest[]>;
    manifest(env: Env, id: string): Promise<BackupManifest | null>;
    /**
     * Put the backup's rows back. Each table is emptied first unless `truncate: false` (then
     * rows are upserted by primary key). Runs as one transaction with deferred foreign keys when
     * the driver can batch, so parents and children land together.
     */
    restore(
        env: Env,
        id: string,
        options?: { tables?: string[]; truncate?: boolean; objects?: boolean },
    ): Promise<RestoreResult>;
    remove(env: Env, id: string): Promise<boolean>;
    /**
     * Delete backups older than `keepDays`, always keeping the newest one, then drop the object
     * bytes no remaining backup names. Returns the ids removed.
     */
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
