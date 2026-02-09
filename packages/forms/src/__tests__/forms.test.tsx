import { describe, it, expect } from 'vitest';
import { buildZodSchema, validateField, validateWithSchema, ValidationError } from '@ottabase/ottaorm';
import type { ModelFieldDescriptor, ModelFields } from '@ottabase/ottaorm';
import { createModelConfig, defineModelConfig } from '../utils/modelConfig';

// ============================================================
// Test field definitions (reusable)
// ============================================================

const testFields: ModelFields = {
    id: { type: 'id', primaryKey: true, editable: false },
    name: {
        type: 'string',
        editable: true,
        validation: { rules: 'required', messages: { required: 'Name is required' } },
    },
    email: {
        type: 'string',
        editable: true,
        validation: {
            rules: 'required|email',
            messages: { required: 'Email is required', email: 'Invalid email' },
        },
    },
    bio: { type: 'string', editable: true },
    age: {
        type: 'integer',
        editable: true,
        validation: { rules: 'required|min:0|max:150' },
    },
    website: {
        type: 'string',
        editable: true,
        validation: { rules: 'url', messages: { url: 'Must be a valid URL' } },
    },
    isActive: { type: 'boolean', editable: true },
    metadata: { type: 'json', editable: true },
    tags: { type: 'array', editable: true },
    createdAt: { type: 'date', editable: false },
    role: {
        type: 'string',
        editable: true,
        formConfig: {
            fieldType: 'select',
            visible: true,
            options: [
                { id: 'admin', name: 'Admin' },
                { id: 'user', name: 'User' },
            ],
        },
    },
};

// ============================================================
// Zod Schema Builder Tests
// ============================================================

describe('buildZodSchema', () => {
    it('should build schema from field metadata', () => {
        const schema = buildZodSchema(testFields, 'create');
        expect(schema).toBeDefined();
        expect(schema.shape).toBeDefined();
    });

    it('should skip primary keys in create mode', () => {
        const schema = buildZodSchema(testFields, 'create');
        expect(schema.shape.id).toBeUndefined();
    });

    it('should skip non-editable fields', () => {
        const schema = buildZodSchema(testFields, 'create');
        expect(schema.shape.createdAt).toBeUndefined();
    });

    it('should validate required string fields', () => {
        const schema = buildZodSchema(testFields, 'create');
        const result = schema.safeParse({ name: '', email: 'test@test.com', age: 25 });
        expect(result.success).toBe(false);
        if (!result.success) {
            const errors = result.error.flatten().fieldErrors;
            expect(errors.name).toBeDefined();
        }
    });

    it('should validate email fields', () => {
        const schema = buildZodSchema(testFields, 'create');
        const result = schema.safeParse({ name: 'John', email: 'not-an-email', age: 25 });
        expect(result.success).toBe(false);
        if (!result.success) {
            const errors = result.error.flatten().fieldErrors;
            expect(errors.email).toBeDefined();
        }
    });

    it('should validate URL fields', () => {
        const schema = buildZodSchema(testFields, 'create');
        const result = schema.safeParse({ name: 'John', email: 'j@j.com', age: 25, website: 'not-a-url' });
        expect(result.success).toBe(false);
    });

    it('should accept valid URLs', () => {
        const schema = buildZodSchema(testFields, 'create');
        const result = schema.safeParse({ name: 'John', email: 'j@j.com', age: 25, website: 'https://example.com' });
        expect(result.success).toBe(true);
    });

    it('should validate number min/max', () => {
        const schema = buildZodSchema(testFields, 'create');
        const result = schema.safeParse({ name: 'John', email: 'j@j.com', age: 200 });
        expect(result.success).toBe(false);
    });

    it('should coerce numbers from strings', () => {
        const schema = buildZodSchema(testFields, 'create');
        const result = schema.safeParse({ name: 'John', email: 'j@j.com', age: '25' });
        expect(result.success).toBe(true);
    });

    it('should make all fields optional in update mode', () => {
        const schema = buildZodSchema(testFields, 'update');
        const result = schema.safeParse({ name: 'Updated' });
        expect(result.success).toBe(true);
    });

    it('should respect writable allowlist', () => {
        const schema = buildZodSchema(testFields, 'create', {
            create: ['name', 'email'],
        });
        // Should only have name and email
        expect(schema.shape.name).toBeDefined();
        expect(schema.shape.email).toBeDefined();
        expect(schema.shape.age).toBeUndefined();
        expect(schema.shape.bio).toBeUndefined();
    });

    it('should pass valid complete data', () => {
        const schema = buildZodSchema(testFields, 'create');
        const result = schema.safeParse({
            name: 'John Doe',
            email: 'john@example.com',
            age: 30,
            bio: 'A developer',
            website: 'https://john.dev',
            isActive: true,
            metadata: { key: 'value' },
            tags: ['dev', 'js'],
        });
        expect(result.success).toBe(true);
    });
});

// ============================================================
// validateField Tests
// ============================================================

describe('validateField', () => {
    it('should return null for valid values', () => {
        const field: ModelFieldDescriptor = {
            type: 'string',
            validation: { rules: 'required' },
        };
        expect(validateField(field, 'hello')).toBeNull();
    });

    it('should return error for empty required field', () => {
        const field: ModelFieldDescriptor = {
            type: 'string',
            validation: { rules: 'required', messages: { required: 'Name is required' } },
        };
        expect(validateField(field, '')).toBe('Name is required');
    });

    it('should return error for invalid email', () => {
        const field: ModelFieldDescriptor = {
            type: 'string',
            validation: { rules: 'required|email', messages: { email: 'Bad email' } },
        };
        expect(validateField(field, 'not-email')).toBe('Bad email');
    });

    it('should return null for valid email', () => {
        const field: ModelFieldDescriptor = {
            type: 'string',
            validation: { rules: 'required|email' },
        };
        expect(validateField(field, 'test@example.com')).toBeNull();
    });

    it('should return null for optional empty field', () => {
        const field: ModelFieldDescriptor = {
            type: 'string',
        };
        expect(validateField(field, '')).toBeNull();
    });

    it('should validate numbers', () => {
        const field: ModelFieldDescriptor = {
            type: 'number',
            validation: { rules: 'required|min:0|max:100' },
        };
        expect(validateField(field, 50)).toBeNull();
        expect(validateField(field, 200)).not.toBeNull();
    });
});

// ============================================================
// validateWithSchema Tests
// ============================================================

describe('validateWithSchema', () => {
    it('should return success for valid data', () => {
        const schema = buildZodSchema(testFields, 'create');
        const result = validateWithSchema(schema, {
            name: 'John',
            email: 'john@test.com',
            age: 25,
        });
        expect(result.success).toBe(true);
        expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should return flat error map for invalid data', () => {
        const schema = buildZodSchema(testFields, 'create');
        const result = validateWithSchema(schema, {
            name: '',
            email: 'bad',
            age: -5,
        });
        expect(result.success).toBe(false);
        expect(result.errors.name).toBeDefined();
        expect(result.errors.email).toBeDefined();
    });
});

// ============================================================
// createModelConfig Tests
// ============================================================

describe('createModelConfig', () => {
    const mockModel = {
        entity: 'users',
        primaryKey: 'id',
        displayName: 'User',
        displayNamePlural: 'Users',
        defaultSort: 'createdAt',
        defaultSortDirection: 'desc' as const,
        defaults: { status: 'active' },
        getFields: () => testFields,
        getModelConfig: () => ({
            entity: 'users',
            primaryKey: 'id',
            fields: testFields,
            displayName: 'User',
            displayNamePlural: 'Users',
            defaultSort: 'createdAt',
            defaultSortDirection: 'desc' as const,
            defaults: { status: 'active' },
        }),
    };

    it('should create config from model', () => {
        const config = createModelConfig(mockModel);
        expect(config.entity).toBe('users');
        expect(config.displayName).toBe('User');
        expect(config.fields).toBe(testFields);
        expect(config.defaults).toEqual({ status: 'active' });
    });

    it('should auto-build Zod schemas', () => {
        const config = createModelConfig(mockModel);
        expect(config.zodCreateSchema).toBeDefined();
        expect(config.zodUpdateSchema).toBeDefined();
    });

    it('should allow overrides via options', () => {
        const config = createModelConfig(mockModel, { displayName: 'Member' });
        expect(config.displayName).toBe('Member');
    });

    it('should detect searchable fields', () => {
        const fieldsWithSearch: ModelFields = {
            ...testFields,
            name: { ...testFields.name, searchable: true },
            email: { ...testFields.email, searchable: true },
        };
        const model = {
            ...mockModel,
            getFields: () => fieldsWithSearch,
            getModelConfig: () => ({
                entity: 'users',
                primaryKey: 'id',
                fields: fieldsWithSearch,
                displayName: 'User',
                displayNamePlural: 'Users',
            }),
        };
        const config = createModelConfig(model);
        expect(config.searchFields).toContain('name');
        expect(config.searchFields).toContain('email');
    });
});

// ============================================================
// defineModelConfig Tests
// ============================================================

describe('defineModelConfig', () => {
    it('should create config from plain object', () => {
        const config = defineModelConfig({
            entity: 'products',
            displayName: 'Product',
            defaults: { status: 'active' },
            fields: {
                id: { type: 'id', primaryKey: true },
                name: { type: 'string', editable: true, validation: { rules: 'required' } },
                price: { type: 'number', editable: true },
            },
        });
        expect(config.entity).toBe('products');
        expect(config.displayName).toBe('Product');
        expect(config.zodCreateSchema).toBeDefined();
        expect(config.defaults).toEqual({ status: 'active' });
    });

    it('should auto-generate display name from entity', () => {
        const config = defineModelConfig({
            entity: 'products',
            fields: { id: { type: 'id', primaryKey: true } },
        });
        expect(config.displayName).toBe('Product');
    });

    it('standalone config validates correctly', () => {
        const config = defineModelConfig({
            entity: 'todos',
            fields: {
                id: { type: 'id', primaryKey: true },
                title: { type: 'string', editable: true, validation: { rules: 'required' } },
                done: { type: 'boolean', editable: true },
            },
        });

        // Create schema should validate
        const result = config.zodCreateSchema!.safeParse({ title: '' });
        expect(result.success).toBe(false);

        const result2 = config.zodCreateSchema!.safeParse({ title: 'My todo' });
        expect(result2.success).toBe(true);
    });
});

// ============================================================
// ValidationError Tests
// ============================================================

describe('ValidationError', () => {
    it('should be an instance of Error', () => {
        const err = new ValidationError({ email: 'Already exists' });
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('ValidationError');
    });

    it('should contain field errors', () => {
        const fieldErrors = { email: 'Already exists', name: 'Too short' };
        const err = new ValidationError(fieldErrors);
        expect(err.fieldErrors).toEqual(fieldErrors);
    });

    it('should set message from first field error', () => {
        const err = new ValidationError({ email: 'Email already exists' });
        expect(err.message).toBe('Validation failed: Email already exists');
    });

    it('should be catchable and field errors extractable (server error mapping pattern)', () => {
        // Simulates what API routes do: catch ValidationError, return fieldErrors as JSON
        try {
            throw new ValidationError({ email: 'Taken', name: 'Required' });
        } catch (error: unknown) {
            if (error instanceof ValidationError) {
                // API route would return json({ error: error.message, errors: error.fieldErrors }, 422)
                expect(error.fieldErrors.email).toBe('Taken');
                expect(error.fieldErrors.name).toBe('Required');
            } else {
                throw new Error('Should have been caught as ValidationError');
            }
        }
    });
});
