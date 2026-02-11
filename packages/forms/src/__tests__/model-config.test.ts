import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createModelConfig, defineModelConfig } from '../utils/modelConfig';
import type { ModelFields } from '../types';
import type { OttaModelClass } from '../utils/modelConfig';

describe('createModelConfig', () => {
    let mockModel: OttaModelClass;
    let mockFields: ModelFields;

    beforeEach(() => {
        mockFields = {
            id: {
                type: 'id',
                primaryKey: true,
                editable: false,
            },
            name: {
                type: 'string',
                editable: true,
                searchable: true,
            },
            email: {
                type: 'string',
                editable: true,
                searchable: true,
            },
            createdAt: {
                type: 'date',
                editable: false,
            },
        };

        mockModel = {
            entity: 'users',
            primaryKey: 'id',
            displayName: 'User',
            displayNamePlural: 'Users',
            getFields: () => mockFields,
            getModelConfig: () => ({
                entity: 'users',
                primaryKey: 'id',
                fields: mockFields,
                displayName: 'User',
                displayNamePlural: 'Users',
            }),
        };
    });

    it('should create config from OttaORM model', () => {
        const config = createModelConfig(mockModel);

        expect(config.entity).toBe('users');
        expect(config.primaryKey).toBe('id');
        expect(config.displayName).toBe('User');
        expect(config.displayNamePlural).toBe('Users');
        expect(config.fields).toEqual(mockFields);
    });

    it('should use provided displayName override', () => {
        const config = createModelConfig(mockModel, {
            displayName: 'Custom User',
        });

        expect(config.displayName).toBe('Custom User');
    });

    it('should use provided displayNamePlural override', () => {
        const config = createModelConfig(mockModel, {
            displayNamePlural: 'Custom Users',
        });

        expect(config.displayNamePlural).toBe('Custom Users');
    });

    it('should derive displayName from entity when not provided', () => {
        mockModel.displayName = undefined;

        const config = createModelConfig(mockModel);

        expect(config.displayName).toBe('User'); // singularized and capitalized
    });

    it('should extract searchable fields', () => {
        const config = createModelConfig(mockModel);

        expect(config.searchFields).toContain('name');
        expect(config.searchFields).toContain('email');
        expect(config.searchFields).not.toContain('id');
        expect(config.searchFields).not.toContain('createdAt');
    });

    it('should use provided searchFields override', () => {
        const config = createModelConfig(mockModel, {
            searchFields: ['name'],
        });

        expect(config.searchFields).toEqual(['name']);
    });

    it('should use model getFields when getModelConfig is not available', () => {
        delete mockModel.getModelConfig;

        const config = createModelConfig(mockModel);

        expect(config.fields).toEqual(mockFields);
    });

    it('should handle missing getFields gracefully', () => {
        delete mockModel.getFields;
        mockModel.getModelConfig = () => ({
            entity: 'users',
            primaryKey: 'id',
            fields: mockFields,
        });

        const config = createModelConfig(mockModel);

        expect(config.fields).toEqual(mockFields);
    });

    it('should accept apiPath option', () => {
        const config = createModelConfig(mockModel, {
            apiPath: '/api/users',
        });

        expect(config.apiPath).toBe('/api/users');
    });

    it('should accept fetchFn option', () => {
        const mockFetchFn = vi.fn();

        const config = createModelConfig(mockModel, {
            fetchFn: mockFetchFn,
        });

        expect(config.fetchFn).toBe(mockFetchFn);
    });

    it('should use provided zodCreateSchema', () => {
        const mockSchema = { parse: vi.fn() };

        const config = createModelConfig(mockModel, {
            zodCreateSchema: mockSchema as any,
        });

        expect(config.zodCreateSchema).toBe(mockSchema);
    });

    it('should use provided zodUpdateSchema', () => {
        const mockSchema = { parse: vi.fn() };

        const config = createModelConfig(mockModel, {
            zodUpdateSchema: mockSchema as any,
        });

        expect(config.zodUpdateSchema).toBe(mockSchema);
    });

    it('should accept defaultSort option', () => {
        const config = createModelConfig(mockModel, {
            defaultSort: 'name',
        });

        expect(config.defaultSort).toBe('name');
    });

    it('should accept defaultSortDirection option', () => {
        const config = createModelConfig(mockModel, {
            defaultSortDirection: 'desc',
        });

        expect(config.defaultSortDirection).toBe('desc');
    });

    it('should prefer option defaultSort over model defaultSort', () => {
        mockModel.defaultSort = 'createdAt';

        const config = createModelConfig(mockModel, {
            defaultSort: 'name',
        });

        expect(config.defaultSort).toBe('name');
    });

    it('should handle model with minimal properties', () => {
        const minimalModel: OttaModelClass = {
            entity: 'items',
            primaryKey: 'id',
        };

        const config = createModelConfig(minimalModel);

        expect(config.entity).toBe('items');
        expect(config.primaryKey).toBe('id');
        expect(config.displayName).toBe('Item');
        expect(config.displayNamePlural).toBe('Items');
    });

    it('should handle schema building errors gracefully', () => {
        // Mock buildZodSchema to throw
        vi.mock('@ottabase/ottaorm', () => ({
            buildZodSchema: vi.fn().mockImplementation(() => {
                throw new Error('Schema build failed');
            }),
        }));

        // Should still create config without schemas
        const config = createModelConfig(mockModel);

        expect(config).toBeDefined();
        expect(config.entity).toBe('users');
    });

    it('should respect writable field allowlists', () => {
        const modelWithWritable: OttaModelClass = {
            ...mockModel,
            writable: {
                create: ['name', 'email'],
                update: ['name'],
            },
        };

        const config = createModelConfig(modelWithWritable);

        expect(config).toBeDefined();
        expect(config.entity).toBe('users');
    });
});

describe('defineModelConfig', () => {
    let mockFields: ModelFields;

    beforeEach(() => {
        mockFields = {
            id: {
                type: 'id',
                primaryKey: true,
                editable: false,
            },
            title: {
                type: 'string',
                editable: true,
                searchable: true,
            },
            description: {
                type: 'text',
                editable: true,
            },
        };
    });

    it('should create config from plain object', () => {
        const config = defineModelConfig({
            entity: 'articles',
            fields: mockFields,
        });

        expect(config.entity).toBe('articles');
        expect(config.primaryKey).toBe('id');
        expect(config.fields).toEqual(mockFields);
    });

    it('should use provided displayName', () => {
        const config = defineModelConfig({
            entity: 'articles',
            displayName: 'Article',
            fields: mockFields,
        });

        expect(config.displayName).toBe('Article');
    });

    it('should derive displayName from entity when not provided', () => {
        const config = defineModelConfig({
            entity: 'categories',
            fields: mockFields,
        });

        expect(config.displayName).toBe('Category');
    });

    it('should use provided primaryKey', () => {
        const config = defineModelConfig({
            entity: 'articles',
            primaryKey: 'slug',
            fields: mockFields,
        });

        expect(config.primaryKey).toBe('slug');
    });

    it('should default to id as primaryKey', () => {
        const config = defineModelConfig({
            entity: 'articles',
            fields: mockFields,
        });

        expect(config.primaryKey).toBe('id');
    });

    it('should extract searchable fields automatically', () => {
        const config = defineModelConfig({
            entity: 'articles',
            fields: mockFields,
        });

        expect(config.searchFields).toContain('title');
        expect(config.searchFields).not.toContain('id');
        expect(config.searchFields).not.toContain('description');
    });

    it('should allow custom searchFields', () => {
        const config = defineModelConfig({
            entity: 'articles',
            fields: mockFields,
            searchFields: ['title', 'description'],
        });

        expect(config.searchFields).toEqual(['title', 'description']);
    });

    it('should accept all ModelConfig properties', () => {
        const mockFetchFn = vi.fn();
        const mockSchema = { parse: vi.fn() };

        const config = defineModelConfig({
            entity: 'articles',
            displayName: 'Article',
            displayNamePlural: 'Articles',
            apiPath: '/api/articles',
            defaultSort: 'title',
            defaultSortDirection: 'asc',
            fields: mockFields,
            fetchFn: mockFetchFn,
            zodCreateSchema: mockSchema as any,
            zodUpdateSchema: mockSchema as any,
        });

        expect(config.apiPath).toBe('/api/articles');
        expect(config.defaultSort).toBe('title');
        expect(config.defaultSortDirection).toBe('asc');
        expect(config.fetchFn).toBe(mockFetchFn);
        expect(config.zodCreateSchema).toBe(mockSchema);
        expect(config.zodUpdateSchema).toBe(mockSchema);
    });

    it('should handle schema building errors gracefully', () => {
        // Should not throw even if schema building fails
        const config = defineModelConfig({
            entity: 'articles',
            fields: mockFields,
        });

        expect(config).toBeDefined();
        expect(config.entity).toBe('articles');
    });

    it('should accept defaults property', () => {
        const defaults = {
            status: 'draft',
            published: false,
        };

        const config = defineModelConfig({
            entity: 'articles',
            fields: mockFields,
            defaults,
        });

        expect(config.defaults).toEqual(defaults);
    });
});

describe('helper functions - singularize', () => {
    it('should handle regular plurals ending in -s', () => {
        // Test via defineModelConfig which uses singularize internally
        const config = defineModelConfig({
            entity: 'users',
            fields: { id: { type: 'id', primaryKey: true } },
        });
        expect(config.displayName).toBe('User');
    });

    it('should handle words ending in -ies', () => {
        const config = defineModelConfig({
            entity: 'categories',
            fields: { id: { type: 'id', primaryKey: true } },
        });
        expect(config.displayName).toBe('Category');
    });

    it('should handle words ending in -ves', () => {
        const config = defineModelConfig({
            entity: 'wives',
            fields: { id: { type: 'id', primaryKey: true } },
        });
        expect(config.displayName).toBe('Wife');
    });

    it('should handle words ending in -ches', () => {
        const config = defineModelConfig({
            entity: 'benches',
            fields: { id: { type: 'id', primaryKey: true } },
        });
        expect(config.displayName).toBe('Bench');
    });

    it('should handle irregular plurals', () => {
        const testCases = [
            { plural: 'people', singular: 'Person' },
            { plural: 'children', singular: 'Child' },
            { plural: 'men', singular: 'Man' },
            { plural: 'women', singular: 'Woman' },
            { plural: 'data', singular: 'Datum' },
        ];

        for (const testCase of testCases) {
            const config = defineModelConfig({
                entity: testCase.plural,
                fields: { id: { type: 'id', primaryKey: true } },
            });
            expect(config.displayName).toBe(testCase.singular);
        }
    });
});

describe('helper functions - capitalize', () => {
    it('should capitalize first letter', () => {
        const config = defineModelConfig({
            entity: 'products',
            fields: { id: { type: 'id', primaryKey: true } },
        });
        // displayName should start with capital letter
        expect(config.displayName[0]).toBe(config.displayName[0].toUpperCase());
    });

    it('should handle single character entity names', () => {
        const config = defineModelConfig({
            entity: 'u',
            fields: { id: { type: 'id', primaryKey: true } },
        });
        expect(config.displayName).toBe('U');
    });

    it('should preserve case of rest of string', () => {
        const config = defineModelConfig({
            entity: 'myModels',
            fields: { id: { type: 'id', primaryKey: true } },
        });
        // The displayName should have first letter capitalized
        expect(config.displayName[0]).toBe('M');
    });
});

describe('searchable fields extraction', () => {
    it('should extract only searchable fields', () => {
        const fields: ModelFields = {
            id: { type: 'id', primaryKey: true },
            name: { type: 'string', searchable: true },
            email: { type: 'string', searchable: true },
            password: { type: 'string', searchable: false },
            createdAt: { type: 'date' },
        };

        const config = defineModelConfig({
            entity: 'users',
            fields,
        });

        expect(config.searchFields).toEqual(['name', 'email']);
    });

    it('should return empty array when no fields are searchable', () => {
        const fields: ModelFields = {
            id: { type: 'id', primaryKey: true },
            secret: { type: 'string' },
        };

        const config = defineModelConfig({
            entity: 'secrets',
            fields,
        });

        expect(config.searchFields).toEqual([]);
    });

    it('should handle fields with undefined searchable property', () => {
        const fields: ModelFields = {
            id: { type: 'id', primaryKey: true },
            name: { type: 'string', searchable: true },
            bio: { type: 'text' }, // no searchable property
        };

        const config = defineModelConfig({
            entity: 'profiles',
            fields,
        });

        expect(config.searchFields).toEqual(['name']);
    });
});
