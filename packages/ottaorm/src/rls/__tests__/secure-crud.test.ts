import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as crud from '../../crud';
import { globalRLS } from '../engine';
import { executeSecureCrudRequest, extractSecurityContext } from '../secure-crud';
import { RLSPolicies } from '../types';

describe('extractSecurityContext', () => {
    it('extracts userId, organizationId, appId from headers', () => {
        const request = new Request('https://api.example.com', {
            headers: {
                'x-user-id': 'user-123',
                'x-org-id': 'org-456',
                'x-app-id': 'app-789',
            },
        });
        const ctx = extractSecurityContext(request);
        expect(ctx.userId).toBe('user-123');
        expect(ctx.organizationId).toBe('org-456');
        expect(ctx.appId).toBe('app-789');
    });

    it('parses comma-separated roles and permissions', () => {
        const request = new Request('https://api.example.com', {
            headers: {
                'x-user-id': 'u1',
                'x-user-roles': 'admin, member',
                'x-user-permissions': 'posts:read, posts:write',
            },
        });
        const ctx = extractSecurityContext(request);
        expect(ctx.roles).toEqual(['admin', 'member']);
        expect(ctx.permissions).toEqual(['posts:read', 'posts:write']);
    });

    it('treats "null" organizationId as null', () => {
        const request = new Request('https://api.example.com', {
            headers: { 'x-org-id': 'null' },
        });
        const ctx = extractSecurityContext(request);
        expect(ctx.organizationId).toBeNull();
    });

    it('returns undefined for missing headers', () => {
        const request = new Request('https://api.example.com');
        const ctx = extractSecurityContext(request);
        expect(ctx.userId).toBeUndefined();
        expect(ctx.organizationId).toBeUndefined();
        expect(ctx.appId).toBeUndefined();
        expect(ctx.roles).toBeUndefined();
        expect(ctx.permissions).toBeUndefined();
    });
});

describe('executeSecureCrudRequest', () => {
    beforeEach(() => {
        globalRLS.clear();
    });

    afterEach(() => {
        globalRLS.clear();
        vi.restoreAllMocks();
    });

    it('GET: applies RLS filter and returns 403 when no policy', async () => {
        const context = { userId: 'u1', organizationId: 'org-1' };
        const result = await executeSecureCrudRequest({ method: 'GET', model: 'unknown_entity' }, context);
        expect(result.success).toBe(false);
        expect(result.status).toBe(403);
        expect(result.code).toBe('RLS_ERROR');
        expect(result.error).toMatch(/No RLS policy/);
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
        expect(result.code).toBe('RLS_ERROR');
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

    it('DELETE: returns 400 when id missing', async () => {
        globalRLS.register({ model: 'posts', policy: RLSPolicies.TenantScoped(false) });
        const result = await executeSecureCrudRequest(
            { method: 'DELETE', model: 'posts' },
            { organizationId: 'org-1' },
        );
        expect(result.success).toBe(false);
        expect(result.status).toBe(400);
    });
});
