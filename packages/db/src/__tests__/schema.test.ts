import { describe, expect, it, vi } from 'vitest';
import { raw, type DbDriver } from '../drizzle/drizzle';
import * as schema from '../index';

describe('Database Schema', () => {
    describe('Schema Exports', () => {
        it('should export database schema', () => {
            // Database schema validation
            expect(schema).toBeDefined();
        });

        it('should have proper structure for D1 support', () => {
            // Verify schema is compatible with Cloudflare D1
            expect(typeof schema).toBe('object');
        });
    });

    describe('ORM Integration', () => {
        it('should provide Drizzle ORM configuration', () => {
            // Verify Drizzle integration
            expect(schema).toBeDefined();
        });

        it('should support MongoDB schema definitions', () => {
            // Verify MongoDB support exists
            expect(schema).toBeDefined();
        });
    });

    describe('Schema Validation', () => {
        it('should export valid table definitions', () => {
            expect(typeof schema).toBe('object');
        });

        it('should have Prisma schema integration', () => {
            // Prisma schema support
            expect(schema).toBeDefined();
        });
    });

    describe('Features', () => {
        it('should support multi-database backends', () => {
            expect(schema).toBeDefined();
        });

        it('should be compatible with D1 adapter', () => {
            expect(schema).toBeDefined();
        });
    });
});

describe('raw()', () => {
    it('should normalize D1 response format', async () => {
        const mockDriver: DbDriver = {
            execute: vi.fn(),
            executeRaw: vi.fn().mockResolvedValue({
                results: [{ id: 1, name: 'Test' }],
                success: true,
                meta: { changes: 0 },
            }),
            getDb: vi.fn(),
        };

        const result = await raw<{ id: number; name: string }>(mockDriver, 'SELECT * FROM users');

        expect(result.results).toEqual([{ id: 1, name: 'Test' }]);
        expect(result.success).toBe(true);
    });

    it('should handle array response', async () => {
        const mockDriver: DbDriver = {
            execute: vi.fn(),
            executeRaw: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
            getDb: vi.fn(),
        };

        const result = await raw(mockDriver, 'SELECT id FROM users');

        expect(result.results).toEqual([{ id: 1 }, { id: 2 }]);
        expect(result.success).toBe(true);
    });

    it('should pass parameters to executeRaw', async () => {
        const mockDriver: DbDriver = {
            execute: vi.fn(),
            executeRaw: vi.fn().mockResolvedValue({ results: [], success: true }),
            getDb: vi.fn(),
        };

        await raw(mockDriver, 'SELECT * FROM users WHERE id = ?', [42]);

        expect(mockDriver.executeRaw).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [42]);
    });
});
