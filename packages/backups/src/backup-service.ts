/**
 * @ottabase/backups — Backup Service
 *
 * Core logic for D1→R2 database backups.
 * Exports all tables from D1 as SQL INSERT statements and stores them in R2.
 * Supports full and differential backups with content hashing for integrity.
 */

import type {
    BackupConfig,
    BackupListResponse,
    BackupMetadata,
    BackupResult,
    BackupSetupStatus,
    BackupType,
} from './types';
import { DEFAULT_BACKUP_CONFIG } from './types';

// ============================================================
// Interfaces for D1 and R2 (minimal, to avoid tight coupling)
// ============================================================

/** Minimal D1-compatible database interface */
export interface D1Like {
    prepare(query: string): {
        all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
        bind(...values: unknown[]): {
            all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
            run(): Promise<unknown>;
        };
        run(): Promise<unknown>;
    };
    exec(query: string): Promise<unknown>;
    batch<T = unknown>(statements: unknown[]): Promise<T[]>;
}

/** Minimal R2-compatible bucket interface */
export interface R2Like {
    put(
        key: string,
        value: string | ArrayBuffer | ReadableStream,
        options?: { customMetadata?: Record<string, string>; httpMetadata?: Record<string, string> },
    ): Promise<unknown>;
    get(key: string): Promise<{ text(): Promise<string>; customMetadata?: Record<string, string> } | null>;
    delete(keys: string | string[]): Promise<void>;
    list(options?: { prefix?: string; cursor?: string; limit?: number; include?: string[] }): Promise<{
        objects: Array<{ key: string; size: number; uploaded: Date; customMetadata?: Record<string, string> }>;
        truncated: boolean;
        cursor?: string;
    }>;
    head(key: string): Promise<{ key: string; size: number; customMetadata?: Record<string, string> } | null>;
}

// ============================================================
// Utility helpers
// ============================================================

/** Generate a SHA-256 hex hash of a string */
export async function sha256(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Escape a SQL value for safe inclusion in an INSERT statement */
export function escapeSqlValue(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '1' : '0';
    // Escape single quotes by doubling them
    const str = String(value).replace(/'/g, "''");
    return `'${str}'`;
}

/** Format bytes to a human-readable string */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Validate that a table name contains only safe characters (alphanumeric, underscores) */
export function isValidTableName(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Generate a backup filename: yyyy-mm-dd-hhmmss_appName.sql
 * Uses UTC time for consistency across timezones.
 */
export function generateBackupFilename(appName: string, date?: Date): string {
    const d = date ?? new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
    // Sanitize appName: keep alphanumeric, hyphens, underscores
    const safe = appName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    return `${timestamp}_${safe}.sql`;
}

// ============================================================
// Backup Service
// ============================================================

export class BackupService {
    private db: D1Like;
    private bucket: R2Like;
    private config: Required<BackupConfig>;

    constructor(db: D1Like, bucket: R2Like, config?: BackupConfig) {
        this.db = db;
        this.bucket = bucket;
        this.config = { ...DEFAULT_BACKUP_CONFIG, ...config };
    }

    /**
     * List all user tables in D1 (excludes internal SQLite tables and excluded tables from config)
     */
    async listTables(): Promise<string[]> {
        const result = await this.db
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations' ORDER BY name",
            )
            .all<{ name: string }>();

        return result.results
            .map((r) => r.name)
            .filter((name) => isValidTableName(name) && !this.config.excludeTables.includes(name));
    }

    /**
     * Get row count for a specific table
     */
    async getRowCount(table: string): Promise<number> {
        if (!isValidTableName(table)) throw new Error(`Invalid table name: ${table}`);
        const result = await this.db.prepare(`SELECT COUNT(*) as count FROM "${table}"`).all<{ count: number }>();
        return result.results[0]?.count ?? 0;
    }

    /**
     * Export a single table as SQL INSERT statements
     */
    async exportTable(table: string): Promise<{ sql: string; rowCount: number }> {
        if (!isValidTableName(table)) throw new Error(`Invalid table name: ${table}`);
        const rows = await this.db.prepare(`SELECT * FROM "${table}"`).all<Record<string, unknown>>();
        if (!rows.results.length) {
            return { sql: '', rowCount: 0 };
        }

        const columns = Object.keys(rows.results[0]);
        const columnList = columns.map((c) => `"${c}"`).join(', ');
        const lines: string[] = [];

        for (const row of rows.results) {
            const values = columns.map((col) => escapeSqlValue(row[col])).join(', ');
            lines.push(`INSERT INTO "${table}" (${columnList}) VALUES (${values});`);
        }

        return {
            sql: lines.join('\n'),
            rowCount: rows.results.length,
        };
    }

    /**
     * Create a full database backup (all tables → R2)
     */
    async createBackup(options?: { label?: string; type?: BackupType }): Promise<BackupResult> {
        const startTime = Date.now();
        const backupType = options?.type ?? 'full';

        try {
            const tables = await this.listTables();
            if (tables.length === 0) {
                return { success: false, error: 'No tables found in database' };
            }

            const sqlParts: string[] = [
                `-- Ottabase D1 Backup`,
                `-- Type: ${backupType}`,
                `-- Created: ${new Date().toISOString()}`,
                `-- Tables: ${tables.length}`,
                '',
            ];

            let totalRows = 0;

            for (const table of tables) {
                const { sql, rowCount } = await this.exportTable(table);
                totalRows += rowCount;

                sqlParts.push(`-- Table: ${table} (${rowCount} rows)`);
                if (sql) {
                    sqlParts.push(`DELETE FROM "${table}";`);
                    sqlParts.push(sql);
                }
                sqlParts.push('');
            }

            const content = sqlParts.join('\n');
            const contentHash = await sha256(content);
            const sizeBytes = new TextEncoder().encode(content).byteLength;
            const durationMs = Date.now() - startTime;

            const id = crypto.randomUUID();
            const createdAt = new Date().toISOString();
            const filename = generateBackupFilename(this.config.appName);
            const key = `${this.config.prefix}/${filename}`;

            const metadata: BackupMetadata = {
                id,
                createdAt,
                sizeBytes,
                tableCount: tables.length,
                totalRows,
                tables,
                type: backupType,
                label: options?.label,
                durationMs,
                contentHash,
            };

            // Store the backup SQL in R2 with metadata
            await this.bucket.put(key, content, {
                httpMetadata: { contentType: 'application/sql' },
                customMetadata: {
                    backupId: id,
                    backupType,
                    createdAt,
                    tableCount: String(tables.length),
                    totalRows: String(totalRows),
                    contentHash,
                    label: options?.label ?? '',
                    durationMs: String(durationMs),
                    tables: JSON.stringify(tables),
                    filename,
                },
            });

            // Enforce retention policy
            await this.enforceRetention();

            return { success: true, metadata };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Backup failed',
            };
        }
    }

    /**
     * List all backups from R2
     */
    async listBackups(): Promise<BackupListResponse> {
        const backups: BackupMetadata[] = [];
        let cursor: string | undefined;

        // Paginate through all R2 objects with our prefix
        do {
            const result = await this.bucket.list({
                prefix: `${this.config.prefix}/`,
                cursor,
                limit: 100,
                include: ['customMetadata'],
            });

            for (const obj of result.objects) {
                if (!obj.key.endsWith('.sql')) continue;

                const meta = obj.customMetadata;
                if (meta?.backupId) {
                    backups.push({
                        id: meta.backupId,
                        createdAt: meta.createdAt ?? obj.uploaded.toISOString(),
                        sizeBytes: obj.size,
                        tableCount: parseInt(meta.tableCount ?? '0', 10),
                        totalRows: parseInt(meta.totalRows ?? '0', 10),
                        tables: meta.tables ? JSON.parse(meta.tables) : [],
                        type: (meta.backupType as BackupMetadata['type']) ?? 'full',
                        label: meta.label || undefined,
                        durationMs: parseInt(meta.durationMs ?? '0', 10),
                        contentHash: meta.contentHash ?? '',
                        filename: meta.filename || obj.key.split('/').pop(),
                    });
                }
            }

            cursor = result.truncated ? result.cursor : undefined;
        } while (cursor);

        // Sort by creation date (newest first)
        backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const totalSizeBytes = backups.reduce((sum, b) => sum + b.sizeBytes, 0);

        return {
            backups,
            stats: {
                totalBackups: backups.length,
                totalSizeBytes,
                oldestBackup: backups.length > 0 ? backups[backups.length - 1].createdAt : null,
                newestBackup: backups.length > 0 ? backups[0].createdAt : null,
            },
        };
    }

    /**
     * Delete a specific backup from R2 by its ID.
     * Scans the prefix to find the matching key (supports both legacy uuid.sql and new timestamped filenames).
     */
    async deleteBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const key = await this.resolveBackupKey(backupId);
            if (!key) {
                return { success: false, error: 'Backup not found' };
            }
            await this.bucket.delete(key);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Delete failed',
            };
        }
    }

    /**
     * Download a backup's SQL content from R2
     */
    async downloadBackup(
        backupId: string,
    ): Promise<{ success: boolean; content?: string; filename?: string; error?: string }> {
        try {
            const key = await this.resolveBackupKey(backupId);
            if (!key) {
                return { success: false, error: 'Backup not found' };
            }
            const obj = await this.bucket.get(key);
            if (!obj) {
                return { success: false, error: 'Backup not found' };
            }
            const content = await obj.text();
            // Extract filename from key
            const filename = key.split('/').pop() ?? `backup-${backupId}.sql`;
            return { success: true, content, filename };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Download failed',
            };
        }
    }

    /**
     * Resolve an R2 key for a given backup ID.
     * Checks the new metadata-based lookup and falls back to legacy `{id}.sql` pattern.
     */
    private async resolveBackupKey(backupId: string): Promise<string | null> {
        // Try legacy path first (fast path for old backups)
        const legacyKey = `${this.config.prefix}/${backupId}.sql`;
        const legacyHead = await this.bucket.head(legacyKey);
        if (legacyHead) return legacyKey;

        // Scan prefix for matching backupId in customMetadata
        const { backups } = await this.listBackups();
        const match = backups.find((b) => b.id === backupId);
        if (!match) return null;

        // Reconstruct key from the metadata filename or fall back
        const meta = match as BackupMetadata & { filename?: string };
        if (meta.filename) {
            return `${this.config.prefix}/${meta.filename}`;
        }
        return null;
    }

    /**
     * Check setup status — reports what's configured and what needs admin attention
     */
    async checkSetup(options?: { cronConfigured?: boolean }): Promise<BackupSetupStatus> {
        const pendingItems: string[] = [];
        let d1Configured = false;
        let r2Configured = false;
        let hasBackups = false;

        // Check D1
        try {
            await this.db.prepare('SELECT 1').all();
            d1Configured = true;
        } catch {
            pendingItems.push('D1 database binding (OBCF_D1) is not configured');
        }

        // Check R2
        try {
            await this.bucket.list({ prefix: this.config.prefix, limit: 1 });
            r2Configured = true;
        } catch {
            pendingItems.push('R2 bucket binding (OBCF_R2) is not configured');
        }

        // Check if backups exist
        if (r2Configured) {
            try {
                const result = await this.bucket.list({ prefix: `${this.config.prefix}/`, limit: 1 });
                hasBackups = result.objects.length > 0;
                if (!hasBackups) {
                    pendingItems.push('No backups exist yet — run your first backup');
                }
            } catch {
                // R2 list failed
            }
        }

        // Check cron
        const cronConfigured = options?.cronConfigured ?? false;
        if (!cronConfigured) {
            pendingItems.push('No scheduled backup cron job configured — set up automated backups in Scheduled Tasks');
        }

        return {
            d1Configured,
            r2Configured,
            hasBackups,
            cronConfigured,
            pendingItems,
            ready: d1Configured && r2Configured && hasBackups && cronConfigured,
        };
    }

    /**
     * Enforce backup retention policy:
     * 1. Delete backups older than retentionDays
     * 2. Delete oldest backups exceeding maxRetained count
     */
    private async enforceRetention(): Promise<void> {
        const { backups } = await this.listBackups();

        const keysToDelete: string[] = [];

        // Day-based retention: delete backups older than retentionDays
        if (this.config.retentionDays > 0) {
            const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
            for (const b of backups) {
                if (new Date(b.createdAt).getTime() < cutoff) {
                    const key = b.filename
                        ? `${this.config.prefix}/${b.filename}`
                        : `${this.config.prefix}/${b.id}.sql`;
                    keysToDelete.push(key);
                }
            }
        }

        // Count-based retention: delete oldest beyond maxRetained
        const remaining = backups.filter((b) => {
            const key = b.filename ? `${this.config.prefix}/${b.filename}` : `${this.config.prefix}/${b.id}.sql`;
            return !keysToDelete.includes(key);
        });
        if (remaining.length > this.config.maxRetained) {
            const overflow = remaining.slice(this.config.maxRetained);
            for (const b of overflow) {
                const key = b.filename ? `${this.config.prefix}/${b.filename}` : `${this.config.prefix}/${b.id}.sql`;
                if (!keysToDelete.includes(key)) {
                    keysToDelete.push(key);
                }
            }
        }

        if (keysToDelete.length > 0) {
            await this.bucket.delete(keysToDelete);
        }
    }
}

/**
 * Create a BackupService instance
 */
export function createBackupService(db: D1Like, bucket: R2Like, config?: BackupConfig): BackupService {
    return new BackupService(db, bucket, config);
}
