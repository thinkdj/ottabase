/**
 * Tenant isolation through the REAL path: request → getSecurityContext → RLS engine.
 *
 * Route tests elsewhere stub getSecurityContext and executeSecureCrudRequest to test routing; this
 * suite is where the authorization seam itself runs unmocked, through @ottabase/ottaorm's PUBLIC
 * API only. The membership lookups (OrganizationMember / UserGroup) are the only stubs.
 *
 * - Allowed cases assert the scope the engine applies (`applyReadFilter` / `validateWrite`).
 * - Denied cases go through `executeSecureCrudRequest`, which refuses before touching the database;
 *   no DB is registered, so a wrongly-allowed request would surface as a non-403 and fail the test.
 */
import { executeSecureCrudRequest, globalRLS, RLSPolicies, type SecurityContext } from '@ottabase/ottaorm';
import { AuditLog, OrganizationMember, UserGroup } from '@ottabase/ottaorm/models';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSecurityContext } from '../auth-utils';

// The env has no KV binding, so membership resolves straight from (stubbed) D1 on every request.
const env = { ENVIRONMENT: 'test' } as unknown as CloudflareEnv;

const memberOfA = { user: { id: 'user-a' } };

function contextFor(session: unknown, headers: Record<string, string> = {}) {
    return getSecurityContext(new Request('http://localhost/api/ottaorm/notes', { headers }), session, env);
}

beforeEach(() => {
    globalRLS.clear();
    globalRLS.register({ model: 'notes', policy: RLSPolicies.TenantScoped(false) });
    vi.spyOn(OrganizationMember, 'organizationIdsForUser').mockImplementation(async (userId: string) =>
        userId === 'user-a' ? ['org-a'] : [],
    );
    vi.spyOn(UserGroup, 'groupIdsForUser').mockResolvedValue([]);
    // Denials are audit-logged at the CRUD boundary; keep that off the (absent) database.
    vi.spyOn(AuditLog, 'log').mockResolvedValue(undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    globalRLS.clear();
    vi.restoreAllMocks();
});

describe('tenant isolation (real context → real RLS)', () => {
    it("scopes a member to their session's org", async () => {
        const context = await contextFor({ user: { id: 'user-a', organizationId: 'org-a' } });

        expect(globalRLS.applyReadFilter('notes', context, { organizationId: 'org-b' })).toEqual({
            organizationId: 'org-a',
        });
    });

    it('honours x-org-id only for an org the caller belongs to', async () => {
        const context = await contextFor(memberOfA, { 'x-org-id': 'org-a' });

        expect(globalRLS.applyReadFilter('notes', context)).toEqual({ organizationId: 'org-a' });
    });

    it('stamps the verified org on a write that names none', async () => {
        const context = await contextFor(memberOfA, { 'x-org-id': 'org-a' });
        const data: Record<string, unknown> = { title: 'x' };

        globalRLS.validateWrite('notes', context, data, 'create');

        expect(data.organizationId).toBe('org-a');
    });

    it('denies a forged x-org-id for an org the caller does not belong to', async () => {
        const context = await contextFor(memberOfA, { 'x-org-id': 'org-b' });

        await expect(executeSecureCrudRequest({ method: 'GET', model: 'notes' }, context)).resolves.toMatchObject({
            success: false,
            status: 403,
            code: 'FORBIDDEN',
        });
    });

    it('denies a stale session org the caller has since been removed from', async () => {
        const context = await contextFor({ user: { id: 'user-a', organizationId: 'org-b' } });

        await expect(executeSecureCrudRequest({ method: 'GET', model: 'notes' }, context)).resolves.toMatchObject({
            success: false,
            status: 403,
        });
    });

    it('never gives an anonymous caller an org partition, whatever it claims', async () => {
        const context = await contextFor(null, { 'x-org-id': 'org-a' });

        await expect(executeSecureCrudRequest({ method: 'GET', model: 'notes' }, context)).resolves.toMatchObject({
            success: false,
            status: 401,
            code: 'UNAUTHORIZED',
        });
    });

    it('denies a write stamped with another org', async () => {
        const context = await contextFor(memberOfA, { 'x-org-id': 'org-a' });

        await expect(
            executeSecureCrudRequest(
                { method: 'POST', model: 'notes', body: { title: 'x', organizationId: 'org-b' } },
                context,
            ),
        ).resolves.toMatchObject({ success: false, status: 403 });
    });

    it('denies a hand-built context that skipped membership resolution (engine backstop)', async () => {
        // A custom route that builds its own context and forgets memberOrganizationIds must not
        // get a tenant-scoped query just because it named an org.
        const handBuilt: SecurityContext = { userId: 'user-a', organizationId: 'org-a', appId: 'otta-web' };

        await expect(executeSecureCrudRequest({ method: 'GET', model: 'notes' }, handBuilt)).resolves.toMatchObject({
            success: false,
            status: 403,
        });
    });
});
