import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportConfig, ParsedRow } from '../types';

// Mock @ottabase/ottaorm
vi.mock('@ottabase/ottaorm', () => {
    const mockRecords = new Map<string, Record<string, unknown>>();

    const MockModel = {
        entity: 'test_entity',
        primaryKey: 'id',
        first: vi.fn(async (where: Record<string, unknown>) => {
            for (const [, record] of mockRecords) {
                const matches = Object.entries(where).every(([k, v]) => record[k] === v);
                if (matches) {
                    return {
                        get: (key: string) => record[key],
                    };
                }
            }
            return null;
        }),
        create: vi.fn(async (data: Record<string, unknown>) => {
            const id = data.id || `generated-${mockRecords.size + 1}`;
            const record = { ...data, id };
            mockRecords.set(String(id), record);
            return { get: (key: string) => (record as Record<string, unknown>)[key] };
        }),
        update: vi.fn(async (id: string, data: Record<string, unknown>) => {
            const existing = mockRecords.get(id);
            if (existing) {
                Object.assign(existing, data);
            }
            return { get: (key: string) => existing?.[key] };
        }),
        _mockRecords: mockRecords,
    };

    return {
        hasModel: vi.fn((entity: string) => entity === 'test_entity'),
        getModel: vi.fn((entity: string) => (entity === 'test_entity' ? MockModel : null)),
        _MockModel: MockModel,
    };
});

describe('Import Handler', () => {
    let processImport: typeof import('../server/import-handler').processImport;
    let mockOttaorm: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockOttaorm = await import('@ottabase/ottaorm');
        mockOttaorm._MockModel._mockRecords.clear();

        const module = await import('../server/import-handler');
        processImport = module.processImport;
    });

    const baseConfig: ImportConfig = {
        modelEntity: 'test_entity',
        fieldMappings: [
            { sourceColumn: 'Name', targetField: 'name' },
            { sourceColumn: 'Email', targetField: 'email' },
        ],
        uniqueField: 'email',
        batchSize: 10,
    };

    it('should create new records when no match exists', async () => {
        const rows: ParsedRow[] = [
            { Name: 'Alice', Email: 'alice@test.com' },
            { Name: 'Bob', Email: 'bob@test.com' },
        ];

        const result = await processImport(rows, baseConfig);

        expect(result.status).toBe('completed');
        expect(result.totalCreated).toBe(2);
        expect(result.totalUpdated).toBe(0);
        expect(result.totalFailed).toBe(0);
        expect(result.totalRows).toBe(2);
    });

    it('should update existing records when match exists', async () => {
        // Pre-populate a record
        mockOttaorm._MockModel._mockRecords.set('existing-1', {
            id: 'existing-1',
            name: 'Old Name',
            email: 'alice@test.com',
        });

        const rows: ParsedRow[] = [{ Name: 'Alice Updated', Email: 'alice@test.com' }];

        const result = await processImport(rows, baseConfig);

        expect(result.status).toBe('completed');
        expect(result.totalCreated).toBe(0);
        expect(result.totalUpdated).toBe(1);
    });

    it('should handle missing unique field', async () => {
        const rows: ParsedRow[] = [{ Name: 'Alice', Email: '' }];

        const result = await processImport(rows, baseConfig);

        expect(result.totalFailed).toBe(1);
        expect(result.errors[0].message).toContain("Missing required unique field 'email'");
    });

    it('should fail for unregistered model', async () => {
        const rows: ParsedRow[] = [{ Name: 'Alice', Email: 'alice@test.com' }];

        const result = await processImport(rows, {
            ...baseConfig,
            modelEntity: 'nonexistent',
        });

        expect(result.status).toBe('failed');
        expect(result.errors[0].message).toContain("Model 'nonexistent' not registered");
    });

    it('should process in batches', async () => {
        const rows: ParsedRow[] = Array.from({ length: 25 }, (_, i) => ({
            Name: `User ${i}`,
            Email: `user${i}@test.com`,
        }));

        const result = await processImport(rows, { ...baseConfig, batchSize: 10 });

        expect(result.batches).toHaveLength(3); // 10 + 10 + 5
        expect(result.batches[0].totalInBatch).toBe(10);
        expect(result.batches[1].totalInBatch).toBe(10);
        expect(result.batches[2].totalInBatch).toBe(5);
        expect(result.totalCreated).toBe(25);
    });

    it('should return partial status on mixed results', async () => {
        const rows: ParsedRow[] = [
            { Name: 'Alice', Email: 'alice@test.com' },
            { Name: 'Missing Email', Email: '' },
        ];

        const result = await processImport(rows, baseConfig);

        expect(result.status).toBe('partial');
        expect(result.totalCreated).toBe(1);
        expect(result.totalFailed).toBe(1);
    });
});
