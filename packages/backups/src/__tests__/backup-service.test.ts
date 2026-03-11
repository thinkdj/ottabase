import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    BackupService,
    createBackupService,
    sha256,
    escapeSqlValue,
    formatBytes,
    isValidTableName,
    generateBackupFilename,
} from '../backup-service';
import type { D1Like, R2Like } from '../backup-service';
import type { BackupMetadata } from '../types';

// ============================================================
// Mock helpers
// ============================================================

function createMockD1(tables: Record<string, Record<string, unknown>[]> = {}): D1Like {
    const tableNames = Object.keys(tables);

    return {
        prepare: vi.fn((query: string) => {
            // Handle sqlite_master query (list tables)
            if (query.includes('sqlite_master')) {
                return {
                    all: vi.fn().mockResolvedValue({
                        results: tableNames.map((name) => ({ name })),
                    }),
                    bind: vi.fn().mockReturnValue({
                        all: vi.fn().mockResolvedValue({ results: [] }),
                        run: vi.fn().mockResolvedValue({}),
                    }),
                    run: vi.fn().mockResolvedValue({}),
                };
            }

            // Handle COUNT queries
            if (query.includes('COUNT(*)')) {
                const tableName = query.match(/FROM "(\w+)"/)?.[1];
                const count = tableName ? (tables[tableName]?.length ?? 0) : 0;
                return {
                    all: vi.fn().mockResolvedValue({ results: [{ count }] }),
                    bind: vi.fn().mockReturnValue({
                        all: vi.fn().mockResolvedValue({ results: [{ count }] }),
                        run: vi.fn().mockResolvedValue({}),
                    }),
                    run: vi.fn().mockResolvedValue({}),
                };
            }

            // Handle SELECT * queries (export table)
            if (query.startsWith('SELECT *')) {
                const tableName = query.match(/FROM "(\w+)"/)?.[1];
                const rows = tableName ? (tables[tableName] ?? []) : [];
                return {
                    all: vi.fn().mockResolvedValue({ results: rows }),
                    bind: vi.fn().mockReturnValue({
                        all: vi.fn().mockResolvedValue({ results: rows }),
                        run: vi.fn().mockResolvedValue({}),
                    }),
                    run: vi.fn().mockResolvedValue({}),
                };
            }

            // Default: SELECT 1 for health check
            return {
                all: vi.fn().mockResolvedValue({ results: [{ '1': 1 }] }),
                bind: vi.fn().mockReturnValue({
                    all: vi.fn().mockResolvedValue({ results: [] }),
                    run: vi.fn().mockResolvedValue({}),
                }),
                run: vi.fn().mockResolvedValue({}),
            };
        }),
        exec: vi.fn().mockResolvedValue({}),
        batch: vi.fn().mockResolvedValue([]),
    };
}

function createMockR2(
    existingObjects: Array<{ key: string; content: string; metadata?: Record<string, string> }> = [],
): R2Like {
    const storage = new Map<string, { content: string; metadata: Record<string, string> }>();

    // Pre-populate storage
    for (const obj of existingObjects) {
        storage.set(obj.key, { content: obj.content, metadata: obj.metadata ?? {} });
    }

    return {
        put: vi.fn(async (key: string, value: string | ArrayBuffer | ReadableStream, options?: any) => {
            const content = typeof value === 'string' ? value : '';
            storage.set(key, {
                content,
                metadata: options?.customMetadata ?? {},
            });
        }),
        get: vi.fn(async (key: string) => {
            const item = storage.get(key);
            if (!item) return null;
            return {
                text: async () => item.content,
                customMetadata: item.metadata,
            };
        }),
        delete: vi.fn(async (keys: string | string[]) => {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            for (const k of keyArray) {
                storage.delete(k);
            }
        }),
        list: vi.fn(async (options?: any) => {
            const prefix = options?.prefix ?? '';
            const objects = Array.from(storage.entries())
                .filter(([key]) => key.startsWith(prefix))
                .map(([key, val]) => ({
                    key,
                    size: new TextEncoder().encode(val.content).byteLength,
                    uploaded: new Date(),
                    customMetadata: val.metadata,
                }));
            return {
                objects,
                truncated: false,
                cursor: undefined,
            };
        }),
        head: vi.fn(async (key: string) => {
            const item = storage.get(key);
            if (!item) return null;
            return {
                key,
                size: new TextEncoder().encode(item.content).byteLength,
                customMetadata: item.metadata,
            };
        }),
    };
}

// ============================================================
// Tests
// ============================================================

describe('BackupService', () => {
    describe('utility functions', () => {
        describe('escapeSqlValue', () => {
            it('should escape null values', () => {
                expect(escapeSqlValue(null)).toBe('NULL');
                expect(escapeSqlValue(undefined)).toBe('NULL');
            });

            it('should handle numbers', () => {
                expect(escapeSqlValue(42)).toBe('42');
                expect(escapeSqlValue(3.14)).toBe('3.14');
                expect(escapeSqlValue(0)).toBe('0');
            });

            it('should handle booleans', () => {
                expect(escapeSqlValue(true)).toBe('1');
                expect(escapeSqlValue(false)).toBe('0');
            });

            it('should escape strings with single quotes', () => {
                expect(escapeSqlValue('hello')).toBe("'hello'");
                expect(escapeSqlValue("it's")).toBe("'it''s'");
                expect(escapeSqlValue("O'Brien's")).toBe("'O''Brien''s'");
            });

            it('should handle empty strings', () => {
                expect(escapeSqlValue('')).toBe("''");
            });
        });

        describe('sha256', () => {
            it('should produce a 64-char hex hash', async () => {
                const hash = await sha256('test content');
                expect(hash).toHaveLength(64);
                expect(hash).toMatch(/^[0-9a-f]{64}$/);
            });

            it('should produce consistent hashes for the same input', async () => {
                const hash1 = await sha256('hello');
                const hash2 = await sha256('hello');
                expect(hash1).toBe(hash2);
            });

            it('should produce different hashes for different inputs', async () => {
                const hash1 = await sha256('hello');
                const hash2 = await sha256('world');
                expect(hash1).not.toBe(hash2);
            });
        });

        describe('formatBytes', () => {
            it('should format zero bytes', () => {
                expect(formatBytes(0)).toBe('0 B');
            });

            it('should format bytes', () => {
                expect(formatBytes(500)).toBe('500 B');
            });

            it('should format kilobytes', () => {
                expect(formatBytes(1024)).toBe('1 KB');
                expect(formatBytes(1536)).toBe('1.5 KB');
            });

            it('should format megabytes', () => {
                expect(formatBytes(1048576)).toBe('1 MB');
            });
        });

        describe('isValidTableName', () => {
            it('should accept valid table names', () => {
                expect(isValidTableName('users')).toBe(true);
                expect(isValidTableName('post_tags')).toBe(true);
                expect(isValidTableName('_internal')).toBe(true);
                expect(isValidTableName('Table123')).toBe(true);
            });

            it('should reject invalid table names', () => {
                expect(isValidTableName('')).toBe(false);
                expect(isValidTableName('123start')).toBe(false);
                expect(isValidTableName('table name')).toBe(false);
                expect(isValidTableName('table;DROP')).toBe(false);
                expect(isValidTableName('table"name')).toBe(false);
                expect(isValidTableName("table'name")).toBe(false);
            });
        });
        describe('generateBackupFilename', () => {
            it('should generate a timestamped filename with appName', () => {
                const date = new Date('2024-06-15T02:30:00Z');
                const filename = generateBackupFilename('my-app', date);
                expect(filename).toBe('2024-06-15-023000_my-app.sql');
            });

            it('should sanitize special characters in appName', () => {
                const date = new Date('2024-01-01T00:00:00Z');
                const filename = generateBackupFilename('My App (v2)', date);
                expect(filename).toBe('2024-01-01-000000_my_app__v2_.sql');
            });

            it('should use current date when no date provided', () => {
                const filename = generateBackupFilename('test');
                // Should match pattern: yyyy-mm-dd-hhmmss_test.sql
                expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}_test\.sql$/);
            });

            it('should handle empty appName', () => {
                const date = new Date('2024-01-01T00:00:00Z');
                const filename = generateBackupFilename('', date);
                expect(filename).toBe('2024-01-01-000000_.sql');
            });
        });
    });

    describe('createBackupService', () => {
        it('should create a BackupService instance', () => {
            const service = createBackupService(createMockD1(), createMockR2());
            expect(service).toBeInstanceOf(BackupService);
        });
    });

    describe('listTables', () => {
        it('should return all user tables', async () => {
            const db = createMockD1({
                users: [{ id: '1', name: 'Alice' }],
                posts: [{ id: '1', title: 'Hello' }],
            });
            const service = createBackupService(db, createMockR2());

            const tables = await service.listTables();
            expect(tables).toEqual(['users', 'posts']);
        });

        it('should exclude configured tables', async () => {
            const db = createMockD1({
                users: [],
                sessions: [],
                temp_data: [],
            });
            const service = createBackupService(db, createMockR2(), {
                excludeTables: ['temp_data'],
            });

            const tables = await service.listTables();
            expect(tables).toEqual(['users', 'sessions']);
        });

        it('should return empty array for empty database', async () => {
            const db = createMockD1({});
            const service = createBackupService(db, createMockR2());

            const tables = await service.listTables();
            expect(tables).toEqual([]);
        });
    });

    describe('exportTable', () => {
        it('should export table data as SQL INSERT statements', async () => {
            const db = createMockD1({
                users: [
                    { id: '1', name: 'Alice', age: 30 },
                    { id: '2', name: 'Bob', age: 25 },
                ],
            });
            const service = createBackupService(db, createMockR2());

            const result = await service.exportTable('users');
            expect(result.rowCount).toBe(2);
            expect(result.sql).toContain('INSERT INTO "users"');
            expect(result.sql).toContain("'Alice'");
            expect(result.sql).toContain("'Bob'");
        });

        it('should return empty string for empty tables', async () => {
            const db = createMockD1({ users: [] });
            const service = createBackupService(db, createMockR2());

            const result = await service.exportTable('users');
            expect(result.rowCount).toBe(0);
            expect(result.sql).toBe('');
        });

        it('should handle null values in rows', async () => {
            const db = createMockD1({
                users: [{ id: '1', name: null, email: 'test@test.com' }],
            });
            const service = createBackupService(db, createMockR2());

            const result = await service.exportTable('users');
            expect(result.sql).toContain('NULL');
        });
    });

    describe('createBackup', () => {
        it('should create a full backup and store in R2', async () => {
            const db = createMockD1({
                users: [{ id: '1', name: 'Alice' }],
                posts: [{ id: '1', title: 'Hello' }],
            });
            const r2 = createMockR2();
            const service = createBackupService(db, r2);

            const result = await service.createBackup({ label: 'test-backup' });

            expect(result.success).toBe(true);
            expect(result.metadata).toBeDefined();
            expect(result.metadata!.tableCount).toBe(2);
            expect(result.metadata!.totalRows).toBe(2);
            expect(result.metadata!.type).toBe('full');
            expect(result.metadata!.label).toBe('test-backup');
            expect(result.metadata!.contentHash).toHaveLength(64);
            expect(result.metadata!.durationMs).toBeGreaterThanOrEqual(0);

            // Verify R2 was called
            expect(r2.put).toHaveBeenCalledTimes(1);
        });

        it('should use timestamped filename with appName', async () => {
            const db = createMockD1({ users: [{ id: '1' }] });
            const r2 = createMockR2();
            const service = createBackupService(db, r2, { appName: 'my-test-app' });

            const result = await service.createBackup();
            expect(result.success).toBe(true);

            // Verify the R2 key uses the new filename pattern
            const putCall = (r2.put as any).mock.calls[0];
            const key = putCall[0] as string;
            expect(key).toMatch(/^backups\/d1\/\d{4}-\d{2}-\d{2}-\d{6}_my-test-app\.sql$/);
        });

        it('should fail when no tables exist', async () => {
            const db = createMockD1({});
            const service = createBackupService(db, createMockR2());

            const result = await service.createBackup();

            expect(result.success).toBe(false);
            expect(result.error).toContain('No tables found');
        });

        it('should handle R2 errors gracefully', async () => {
            const db = createMockD1({ users: [{ id: '1' }] });
            const r2 = createMockR2();
            (r2.put as any).mockRejectedValue(new Error('R2 write failed'));
            const service = createBackupService(db, r2);

            const result = await service.createBackup();

            expect(result.success).toBe(false);
            expect(result.error).toBe('R2 write failed');
        });
    });

    describe('listBackups', () => {
        it('should list backups from R2', async () => {
            const r2 = createMockR2([
                {
                    key: 'backups/d1/abc-123.sql',
                    content: '-- backup content',
                    metadata: {
                        backupId: 'abc-123',
                        backupType: 'full',
                        createdAt: '2024-01-01T00:00:00Z',
                        tableCount: '3',
                        totalRows: '100',
                        contentHash: 'hash123',
                        durationMs: '500',
                        tables: '["users","posts","comments"]',
                    },
                },
            ]);
            const service = createBackupService(createMockD1(), r2);

            const result = await service.listBackups();

            expect(result.backups).toHaveLength(1);
            expect(result.backups[0].id).toBe('abc-123');
            expect(result.backups[0].tableCount).toBe(3);
            expect(result.backups[0].totalRows).toBe(100);
            expect(result.stats.totalBackups).toBe(1);
        });

        it('should return empty list when no backups exist', async () => {
            const service = createBackupService(createMockD1(), createMockR2());

            const result = await service.listBackups();

            expect(result.backups).toEqual([]);
            expect(result.stats.totalBackups).toBe(0);
            expect(result.stats.oldestBackup).toBeNull();
            expect(result.stats.newestBackup).toBeNull();
        });

        it('should sort backups newest first', async () => {
            const r2 = createMockR2([
                {
                    key: 'backups/d1/old.sql',
                    content: '-- old',
                    metadata: {
                        backupId: 'old',
                        backupType: 'full',
                        createdAt: '2024-01-01T00:00:00Z',
                        tableCount: '1',
                        totalRows: '10',
                        contentHash: 'h1',
                        durationMs: '100',
                        tables: '["users"]',
                    },
                },
                {
                    key: 'backups/d1/new.sql',
                    content: '-- new',
                    metadata: {
                        backupId: 'new',
                        backupType: 'full',
                        createdAt: '2024-06-01T00:00:00Z',
                        tableCount: '2',
                        totalRows: '20',
                        contentHash: 'h2',
                        durationMs: '200',
                        tables: '["users","posts"]',
                    },
                },
            ]);
            const service = createBackupService(createMockD1(), r2);

            const result = await service.listBackups();

            expect(result.backups[0].id).toBe('new');
            expect(result.backups[1].id).toBe('old');
        });
    });

    describe('deleteBackup', () => {
        it('should delete a legacy backup from R2', async () => {
            const r2 = createMockR2([{ key: 'backups/d1/abc.sql', content: '-- data', metadata: { backupId: 'abc' } }]);
            const service = createBackupService(createMockD1(), r2);

            const result = await service.deleteBackup('abc');

            expect(result.success).toBe(true);
            expect(r2.delete).toHaveBeenCalledWith('backups/d1/abc.sql');
        });

        it('should delete a new-format backup by scanning metadata', async () => {
            const r2 = createMockR2([
                {
                    key: 'backups/d1/2024-06-15-023000_myapp.sql',
                    content: '-- data',
                    metadata: {
                        backupId: 'xyz-789',
                        backupType: 'full',
                        createdAt: '2024-06-15T02:30:00Z',
                        tableCount: '1',
                        totalRows: '5',
                        contentHash: 'h',
                        durationMs: '100',
                        tables: '["users"]',
                        filename: '2024-06-15-023000_myapp.sql',
                    },
                },
            ]);
            const service = createBackupService(createMockD1(), r2);

            const result = await service.deleteBackup('xyz-789');
            expect(result.success).toBe(true);
        });

        it('should return error for non-existent backup', async () => {
            const service = createBackupService(createMockD1(), createMockR2());
            const result = await service.deleteBackup('nonexistent');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Backup not found');
        });
    });

    describe('downloadBackup', () => {
        it('should download backup content', async () => {
            const r2 = createMockR2([
                { key: 'backups/d1/abc.sql', content: '-- SQL backup content', metadata: { backupId: 'abc' } },
            ]);
            const service = createBackupService(createMockD1(), r2);

            const result = await service.downloadBackup('abc');

            expect(result.success).toBe(true);
            expect(result.content).toBe('-- SQL backup content');
            expect(result.filename).toBe('abc.sql');
        });

        it('should return error for non-existent backup', async () => {
            const service = createBackupService(createMockD1(), createMockR2());

            const result = await service.downloadBackup('nonexistent');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Backup not found');
        });
    });

    describe('checkSetup', () => {
        it('should report all items pending when nothing is configured', async () => {
            const db = createMockD1();
            (db.prepare as any).mockImplementation(() => ({
                all: vi.fn().mockRejectedValue(new Error('not configured')),
                bind: vi.fn().mockReturnValue({
                    all: vi.fn().mockRejectedValue(new Error('not configured')),
                    run: vi.fn().mockRejectedValue(new Error('not configured')),
                }),
                run: vi.fn().mockRejectedValue(new Error('not configured')),
            }));

            const r2 = createMockR2();
            (r2.list as any).mockRejectedValue(new Error('not configured'));

            const service = createBackupService(db, r2);
            const status = await service.checkSetup();

            expect(status.d1Configured).toBe(false);
            expect(status.r2Configured).toBe(false);
            expect(status.ready).toBe(false);
            expect(status.pendingItems.length).toBeGreaterThan(0);
        });

        it('should report ready when everything is configured', async () => {
            const db = createMockD1({ users: [{ id: '1' }] });
            const r2 = createMockR2([
                { key: 'backups/d1/test.sql', content: '-- backup', metadata: { backupId: 'test' } },
            ]);

            const service = createBackupService(db, r2);
            const status = await service.checkSetup({ cronConfigured: true });

            expect(status.d1Configured).toBe(true);
            expect(status.r2Configured).toBe(true);
            expect(status.hasBackups).toBe(true);
            expect(status.cronConfigured).toBe(true);
            expect(status.ready).toBe(true);
            expect(status.pendingItems).toEqual([]);
        });

        it('should flag missing cron configuration', async () => {
            const db = createMockD1({ users: [] });
            const r2 = createMockR2([
                { key: 'backups/d1/test.sql', content: '-- backup', metadata: { backupId: 'test' } },
            ]);

            const service = createBackupService(db, r2);
            const status = await service.checkSetup({ cronConfigured: false });

            expect(status.cronConfigured).toBe(false);
            expect(status.pendingItems).toContain(
                'No scheduled backup cron job configured — set up automated backups in Scheduled Tasks',
            );
        });
    });

    describe('retention policy', () => {
        it('should delete old backups when exceeding maxRetained', async () => {
            // Create service with maxRetained = 2
            const r2 = createMockR2([
                {
                    key: 'backups/d1/a.sql',
                    content: '-- a',
                    metadata: {
                        backupId: 'a',
                        createdAt: '2024-01-01T00:00:00Z',
                        backupType: 'full',
                        tableCount: '1',
                        totalRows: '1',
                        contentHash: 'h',
                        durationMs: '1',
                        tables: '["t"]',
                    },
                },
                {
                    key: 'backups/d1/b.sql',
                    content: '-- b',
                    metadata: {
                        backupId: 'b',
                        createdAt: '2024-02-01T00:00:00Z',
                        backupType: 'full',
                        tableCount: '1',
                        totalRows: '1',
                        contentHash: 'h',
                        durationMs: '1',
                        tables: '["t"]',
                    },
                },
            ]);

            const db = createMockD1({ users: [{ id: '1' }] });
            const service = createBackupService(db, r2, { maxRetained: 2 });

            // Creating a new backup should trigger retention
            await service.createBackup();

            // The oldest backup (a) should have been deleted since we now have 3 but max is 2
            // After the backup is created, we'll have 3 (a, b, new) and need to delete 1
            expect(r2.delete).toHaveBeenCalled();
        });

        it('should delete backups older than retentionDays', async () => {
            const now = new Date();
            const oldDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
            const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

            const r2 = createMockR2([
                {
                    key: 'backups/d1/old.sql',
                    content: '-- old',
                    metadata: {
                        backupId: 'old',
                        createdAt: oldDate.toISOString(),
                        backupType: 'full',
                        tableCount: '1',
                        totalRows: '1',
                        contentHash: 'h',
                        durationMs: '1',
                        tables: '["t"]',
                    },
                },
                {
                    key: 'backups/d1/recent.sql',
                    content: '-- recent',
                    metadata: {
                        backupId: 'recent',
                        createdAt: recentDate.toISOString(),
                        backupType: 'full',
                        tableCount: '1',
                        totalRows: '1',
                        contentHash: 'h',
                        durationMs: '1',
                        tables: '["t"]',
                    },
                },
            ]);

            const db = createMockD1({ users: [{ id: '1' }] });
            // retentionDays = 30, so 40-day-old backup should be deleted
            const service = createBackupService(db, r2, { retentionDays: 30, maxRetained: 100 });

            await service.createBackup();

            // The old backup should be deleted
            const deleteCalls = (r2.delete as any).mock.calls;
            const allDeletedKeys = deleteCalls.flatMap((c: any) => (Array.isArray(c[0]) ? c[0] : [c[0]]));
            expect(allDeletedKeys).toContain('backups/d1/old.sql');
        });
    });
});
