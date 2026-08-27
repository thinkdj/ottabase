import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseModel } from '../../base/BaseModel';
import * as crud from '../../crud';
import { clearModelRegistry, registerModel } from '../../registry';
import { globalRLS } from '../engine';
import { executeSecureCrudRequest, parseSqliteUniqueConstraintForApi, secureCrud } from '../secure-crud';
import { RLSPolicies } from '../types';

describe('parseSqliteUniqueConstraintForApi', () => {
    it('prefers slug in composite constraint messages', () => {
        const msg = 'UNIQUE constraint failed: posts.organization_id, posts.app_id, posts.slug';
        expect(parseSqliteUniqueConstraintForApi(msg)).toBe('slug');
    });

    it('maps snake_case columns to API fields', () => {
        expect(parseSqliteUniqueConstraintForApi('UNIQUE constraint failed: users.email')).toBe('email');
        expect(parseSqliteUniqueConstraintForApi('UNIQUE constraint failed: posts.app_id')).toBe('appId');
    });
});

describe('secureCrud response boundary', () => {
    beforeEach(() => {
        globalRLS.clear();
    });

    afterEach(() => {
        globalRLS.clear();
        vi.restoreAllMocks();
    });

    it.each([
        {
            name: 'invalid JSON body',
            request: () =>
                new Request('https://api.example.com/api/ottaorm/posts', {
                    method: 'POST',
                    body: '{invalid',
                }),
            expected: { status: 400, code: 'INVALID_BODY', error: 'Invalid JSON body' },
        },
        {
            name: 'invalid where query',
            request: () => new Request('https://api.example.com/api/ottaorm/posts?where=%7Binvalid'),
            expected: { status: 400, code: 'INVALID_QUERY', error: 'Invalid JSON in where parameter' },
        },
        {
            name: 'missing model',
            request: () => new Request('https://api.example.com/api/ottaorm'),
            expected: { status: 404, code: 'MODEL_NOT_FOUND', error: 'Model not found' },
        },
    ])('returns the canonical ApiError shape for $name', async ({ request: makeRequest, expected }) => {
        const request = makeRequest();
        const response = await secureCrud({
            request,
            url: new URL(request.url),
            context: {},
        });

        expect(response.status).toBe(expected.status);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await response.json()).toEqual({
            error: expected.error,
            code: expected.code,
            messages: [expected.error],
        });
    });

    it('preserves safe structured 4xx fields from the CRUD result', async () => {
        globalRLS.register({
            model: 'posts',
            policy: RLSPolicies.TenantScoped(false),
        });
        vi.spyOn(crud, 'handleCrud').mockResolvedValue({
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            hint: 'Correct the highlighted fields',
            fieldErrors: { title: ['Title is required'] },
            status: 422,
        });
        const request = new Request('https://api.example.com/api/ottaorm/posts');

        const response = await secureCrud({
            request,
            url: new URL(request.url),
            context: { userId: 'u1', organizationId: 'org-1' },
        });

        expect(response.status).toBe(422);
        expect(await response.json()).toEqual({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            messages: ['Validation failed'],
            hint: 'Correct the highlighted fields',
            fieldErrors: { title: ['Title is required'] },
        });
    });
});

describe('executeSecureCrudRequest', () => {
    beforeEach(() => {
        globalRLS.clear();
        clearModelRegistry();
    });

    afterEach(() => {
        globalRLS.clear();
        clearModelRegistry();
        vi.restoreAllMocks();
    });

    it('GET: applies RLS filter and returns 403 when no policy', async () => {
        const context = { userId: 'u1', organizationId: 'org-1' };
        const result = await executeSecureCrudRequest({ method: 'GET', model: 'unknown_entity' }, context);
        expect(result.success).toBe(false);
        expect(result.status).toBe(403);
        expect(result).toMatchObject({
            error: 'Forbidden',
            code: 'FORBIDDEN',
        });
        expect(result.details).toBeUndefined();
        expect(result.hint).toBeUndefined();
    });

    it('GET: applies RLS filter and calls handleCrud with merged where', async () => {
        globalRLS.register({
            model: 'posts',
            policy: RLSPolicies.TenantScoped(false),
        });
        const handleCrudSpy = vi.spyOn(crud, 'handleCrud').mockResolvedValue({
            success: true,
            data: { data: [], pagination: { total: 0, page: 1, perPage: 15, totalPages: 0, next: null, prev: null } },
            status: 200,
        });

        const context = { userId: 'u1', organizationId: 'org-1' };
        const result = await executeSecureCrudRequest(
            { method: 'GET', model: 'posts', query: { where: { status: 'draft' } } },
            context,
        );

        expect(result.success).toBe(true);
        expect(handleCrudSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                model: 'posts',
                query: { where: { status: 'draft', organizationId: 'org-1' } },
            }),
        );
    });

    it('GET unique on posts strips userId from RLS so slug uniqueness is org+app scoped', async () => {
        globalRLS.register({
            model: 'posts',
            policy: RLSPolicies.Hierarchical(false),
            contextFields: ['organizationId', 'appId', 'userId'],
        });
        const handleCrudSpy = vi.spyOn(crud, 'handleCrud').mockResolvedValue({
            success: true,
            data: { unique: true },
            status: 200,
        });

        const context = { userId: 'u1', organizationId: 'org-1', appId: 'web' };
        const result = await executeSecureCrudRequest(
            {
                method: 'GET',
                model: 'posts',
                id: 'unique',
                query: { uniqueField: 'slug', uniqueValue: 'my-post' },
            },
            context,
        );

        expect(result.success).toBe(true);
        const passedWhere = handleCrudSpy.mock.calls[0]![0].query?.where as Record<string, unknown>;
        expect(passedWhere.userId).toBeUndefined();
        expect(passedWhere.organizationId).toBe('org-1');
        expect(passedWhere.appId).toBe('web');
    });

    it('returns 409 with slug fieldErrors for composite SQLite UNIQUE message', async () => {
        globalRLS.register({
            model: 'posts',
            policy: RLSPolicies.TenantScoped(false),
        });
        vi.spyOn(crud, 'handleCrud').mockRejectedValue(
            new Error('UNIQUE constraint failed: posts.organization_id, posts.app_id, posts.slug'),
        );

        const result = await executeSecureCrudRequest(
            { method: 'POST', model: 'posts', body: { title: 'x' } },
            { userId: 'u1', organizationId: 'org-1' },
        );

        expect(result.success).toBe(false);
        expect(result.status).toBe(409);
        expect(result.code).toBe('UNIQUE_CONSTRAINT_VIOLATION');
        expect(result.fieldErrors?.slug?.[0]).toMatch(/slug is already in use/i);
    });

    it('POST: validates write and returns 403 on cross-tenant body', async () => {
        globalRLS.register({
            model: 'posts',
            policy: RLSPolicies.TenantScoped(false),
        });
        const context = { userId: 'u1', organizationId: 'org-1' };
        const result = await executeSecureCrudRequest(
            { method: 'POST', model: 'posts', body: { organizationId: 'org-2', title: 'Hi' } },
            context,
        );
        expect(result.success).toBe(false);
        expect(result.status).toBe(403);
        expect(result).toMatchObject({
            error: 'Forbidden',
            code: 'FORBIDDEN',
        });
        expect(JSON.stringify(result)).not.toContain('org-2');
        expect(JSON.stringify(result)).not.toContain('Hi');
    });

    it('POST: injects organizationId and calls handleCrud', async () => {
        globalRLS.register({
            model: 'posts',
            policy: RLSPolicies.TenantScoped(false),
        });
        const handleCrudSpy = vi.spyOn(crud, 'handleCrud').mockResolvedValue({
            success: true,
            data: { id: 'p1', title: 'New', organizationId: 'org-1' },
            status: 201,
        });

        const context = { userId: 'u1', organizationId: 'org-1' };
        const result = await executeSecureCrudRequest(
            { method: 'POST', model: 'posts', body: { title: 'New' } },
            context,
        );

        expect(result.success).toBe(true);
        expect(handleCrudSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                model: 'posts',
                body: expect.objectContaining({ title: 'New', organizationId: 'org-1' }),
            }),
        );
    });

    it('PATCH: returns 400 when id missing', async () => {
        globalRLS.register({ model: 'posts', policy: RLSPolicies.TenantScoped(false) });
        const result = await executeSecureCrudRequest(
            { method: 'PATCH', model: 'posts', body: { title: 'Updated' } },
            { organizationId: 'org-1' },
        );
        expect(result.success).toBe(false);
        expect(result.status).toBe(400);
    });

    it('PATCH: reuses the authorized row for model normalization', async () => {
        globalRLS.register({ model: 'posts', policy: RLSPolicies.TenantScoped(false) });
        const postsTable = sqliteTable('posts', {
            id: text('id').primaryKey(),
            title: text('title'),
            organizationId: text('organization_id'),
            updatedAt: text('updated_at'),
        });
        class SecurePost extends BaseModel {
            static entity = 'posts';
            static table = postsTable;
        }
        registerModel(SecurePost);
        const currentData = {
            id: 'p1',
            title: 'Before',
            organizationId: 'org-1',
            updatedAt: 'snapshot-1',
            passwordHash: 'hidden',
        };
        vi.spyOn(SecurePost, 'readMutationSnapshot').mockResolvedValue(currentData);
        const handleCrudSpy = vi.spyOn(crud, 'handleCrud').mockResolvedValue({
            success: true,
            data: { ...currentData, title: 'After' },
            status: 200,
        });

        const result = await executeSecureCrudRequest(
            { method: 'PATCH', model: 'posts', id: 'p1', body: { title: 'After' } },
            { userId: 'u1', organizationId: 'org-1' },
        );

        expect(result.success).toBe(true);
        expect(handleCrudSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'PATCH',
                model: 'posts',
                id: 'p1',
                currentData,
                mutationGuard: {
                    where: { organizationId: 'org-1' },
                    expected: { updatedAt: 'snapshot-1' },
                },
            }),
        );
    });

    it('invokes the authorized mutation hook after the scoped snapshot read', async () => {
        globalRLS.register({ model: 'posts', policy: RLSPolicies.TenantScoped(false) });
        const postsTable = sqliteTable('posts_hook', {
            id: text('id').primaryKey(),
            organizationId: text('organization_id'),
            title: text('title'),
        });
        class SecurePost extends BaseModel {
            static entity = 'posts';
            static table = postsTable;
        }
        registerModel(SecurePost);
        const currentData = { id: 'p1', organizationId: 'org-1', passwordHash: 'hidden-hash' };
        vi.spyOn(SecurePost, 'readMutationSnapshot').mockResolvedValue(currentData);
        vi.spyOn(crud, 'handleCrud').mockResolvedValue({ success: true, data: {}, status: 200 });
        const prepareAuthorizedMutation = vi.fn(({ body }) => ({ body: { ...body, title: 'normalized' } }));

        const result = await executeSecureCrudRequest(
            { method: 'PATCH', model: 'posts', id: 'p1', body: { title: 'raw' } },
            { userId: 'u1', organizationId: 'org-1' },
            { prepareAuthorizedMutation },
        );

        expect(result.success).toBe(true);
        expect(prepareAuthorizedMutation).toHaveBeenCalledWith(
            expect.objectContaining({ currentData, body: { title: 'raw' } }),
        );
        expect(crud.handleCrud).toHaveBeenCalledWith(expect.objectContaining({ body: { title: 'normalized' } }));
    });

    it('DELETE: returns 400 when id missing', async () => {
        globalRLS.register({ model: 'posts', policy: RLSPolicies.TenantScoped(false) });
        const result = await executeSecureCrudRequest(
            { method: 'DELETE', model: 'posts' },
            { organizationId: 'org-1' },
        );
        expect(result.success).toBe(false);
        expect(result.status).toBe(400);
    });

    it('Hierarchical: denies with generic 401 (no 500, no query) when userId is missing from context', async () => {
        globalRLS.register({
            model: 'posts',
            policy: RLSPolicies.Hierarchical(false),
            contextFields: ['organizationId', 'appId', 'userId'],
        });
        const handleCrudSpy = vi.spyOn(crud, 'handleCrud');

        // Logged-out / missing userId — must fail closed, NOT emit eq(user_id, undefined) → 500.
        const result = await executeSecureCrudRequest(
            { method: 'GET', model: 'posts' },
            { organizationId: 'org-1', appId: 'web' },
        );

        expect(result.success).toBe(false);
        expect(result.status).toBe(401);
        expect(result).toMatchObject({
            error: 'Authentication required',
            code: 'UNAUTHORIZED',
        });
        expect(result.details).toBeUndefined();
        expect(result.hint).toBeUndefined();
        expect(handleCrudSpy).not.toHaveBeenCalled();
    });

    it('returns a generic 500 and logs only redacted structured error data', async () => {
        globalRLS.register({
            model: 'posts',
            policy: RLSPolicies.TenantScoped(false),
        });
        vi.spyOn(crud, 'handleCrud').mockRejectedValue(
            new Error('Database failed with password=super-secret and token=secret-token'),
        );
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const result = await executeSecureCrudRequest(
            { method: 'GET', model: 'posts' },
            { userId: 'u1', organizationId: 'org-1' },
        );

        expect(result).toEqual({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
            status: 500,
        });
        const logged = JSON.stringify(consoleSpy.mock.calls);
        expect(logged).not.toContain('super-secret');
        expect(logged).not.toContain('secret-token');
        expect(logged).toContain('[REDACTED]');
    });

    describe('parseError fail-closed behavior', () => {
        it('returns 400 INVALID_BODY without touching the model layer', async () => {
            const handleCrudSpy = vi.spyOn(crud, 'handleCrud');
            const context = { userId: 'u1', organizationId: 'org-1' };

            const result = await executeSecureCrudRequest(
                {
                    method: 'POST',
                    model: 'posts',
                    body: {},
                    parseError: { message: 'Invalid JSON in request body', code: 'INVALID_BODY' },
                },
                context,
            );

            expect(result.success).toBe(false);
            expect(result.status).toBe(400);
            expect(result.code).toBe('INVALID_BODY');
            // Must short-circuit before reaching handleCrud / model layer
            expect(handleCrudSpy).not.toHaveBeenCalled();
        });

        it('returns 400 INVALID_QUERY without touching the model layer', async () => {
            const handleCrudSpy = vi.spyOn(crud, 'handleCrud');
            const context = { userId: 'u1', organizationId: 'org-1' };

            const result = await executeSecureCrudRequest(
                {
                    method: 'GET',
                    model: 'posts',
                    parseError: { message: 'Invalid JSON in "where" query parameter', code: 'INVALID_QUERY' },
                },
                context,
            );

            expect(result.success).toBe(false);
            expect(result.status).toBe(400);
            expect(result.code).toBe('INVALID_QUERY');
            expect(handleCrudSpy).not.toHaveBeenCalled();
        });
    });
});

describe('RLS fails closed on misconfigured policy columns', () => {
    // notes has NO organizationId column, but the policy below filters by organizationId.
    const notesTable = sqliteTable('notes', { id: text('id').primaryKey(), body: text('body') });
    class NoteModel extends BaseModel {
        static entity = 'notes';
        static table = notesTable;
        static primaryKey = 'id';
    }

    const scopedTable = sqliteTable('scoped', {
        id: text('id').primaryKey(),
        organizationId: text('organization_id'),
    });
    class ScopedModel extends BaseModel {
        static entity = 'scoped';
        static table = scopedTable;
        static primaryKey = 'id';
    }

    beforeEach(() => {
        globalRLS.clear();
        clearModelRegistry();
    });
    afterEach(() => {
        globalRLS.clear();
        clearModelRegistry();
        vi.restoreAllMocks();
    });

    it('GET returns 403 when the policy field is not a real column (no silent unscoped query)', async () => {
        registerModel(NoteModel);
        globalRLS.register({ model: 'notes', policy: RLSPolicies.TenantScoped(false) });
        const handleCrudSpy = vi.spyOn(crud, 'handleCrud');

        const result = await executeSecureCrudRequest(
            { method: 'GET', model: 'notes' },
            { userId: 'u1', organizationId: 'org-1' },
        );

        expect(result.success).toBe(false);
        expect(result.status).toBe(403);
        expect(result).toMatchObject({
            error: 'Forbidden',
            code: 'FORBIDDEN',
        });
        expect(result.details).toBeUndefined();
        expect(result.hint).toBeUndefined();
        // Critically: it must NOT have reached the model/query layer with a dropped filter.
        expect(handleCrudSpy).not.toHaveBeenCalled();
    });

    it('GET proceeds with the scoped filter when the policy field IS a real column', async () => {
        registerModel(ScopedModel);
        globalRLS.register({ model: 'scoped', policy: RLSPolicies.TenantScoped(false) });
        const handleCrudSpy = vi.spyOn(crud, 'handleCrud').mockResolvedValue({
            success: true,
            data: { data: [], pagination: { total: 0, page: 1, perPage: 15, totalPages: 1, next: null, prev: null } },
            status: 200,
        });

        const result = await executeSecureCrudRequest({ method: 'GET', model: 'scoped' }, { organizationId: 'org-1' });

        expect(result.success).toBe(true);
        expect(handleCrudSpy).toHaveBeenCalledWith(
            expect.objectContaining({ query: { where: { organizationId: 'org-1' } } }),
        );
    });
});
