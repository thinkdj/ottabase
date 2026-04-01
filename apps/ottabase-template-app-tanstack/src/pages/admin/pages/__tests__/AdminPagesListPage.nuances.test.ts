import { describe, expect, it } from 'vitest';
import { extractCrudMutationRecord, normalizeCrudListPayload } from '../crudPayload';

describe('AdminPagesListPage payload normalization', () => {
    it('should return arrays for list hook and CRUD response shapes', () => {
        const plainList = [{ id: '1' }];
        const pagedList = { data: [{ id: '2' }], pagination: { page: 1 } };
        const nestedPagedList = { data: { data: [{ id: '3' }], pagination: { page: 1 } } };

        expect(normalizeCrudListPayload<{ id: string }>(plainList)).toEqual([{ id: '1' }]);
        expect(normalizeCrudListPayload<{ id: string }>(pagedList)).toEqual([{ id: '2' }]);
        expect(normalizeCrudListPayload<{ id: string }>(nestedPagedList)).toEqual([{ id: '3' }]);
    });

    it('should return empty list for unknown list payloads', () => {
        expect(normalizeCrudListPayload<{ id: string }>(null)).toEqual([]);
        expect(normalizeCrudListPayload<{ id: string }>({})).toEqual([]);
    });

    it('should extract mutation record from wrapped and plain payloads', () => {
        const plain = { id: 'plain' };
        const wrapped = { data: { id: 'wrapped' } };

        expect(extractCrudMutationRecord<{ id: string }>(plain)).toEqual({ id: 'plain' });
        expect(extractCrudMutationRecord<{ id: string }>(wrapped)).toEqual({ id: 'wrapped' });
    });

    it('should return null for invalid mutation payloads', () => {
        expect(extractCrudMutationRecord<{ id: string }>(null)).toBeNull();
        expect(extractCrudMutationRecord<{ id: string }>('invalid')).toBeNull();
    });
});
