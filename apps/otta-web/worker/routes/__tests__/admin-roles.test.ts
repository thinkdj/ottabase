import { Role } from '@ottabase/ottaorm/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    handleAdminRoleCreate,
    handleAdminRoleDelete,
    handleAdminRolesList,
    handleAdminRoleUpdate,
} from '../admin-roles';

vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn(),
    SYSTEM_ORGANIZATION_ID: 'system',
}));

import { requireAdminAccess } from '../../lib/admin-guard';

function mockAuth(organizationId: string) {
    vi.mocked(requireAdminAccess).mockResolvedValue({
        user: { id: 'admin-1' },
        organizationId,
        appId: 'web',
        rbac: { organizationId } as any,
        session: {},
    } as any);
}

function fakeRole(attrs: Record<string, unknown>) {
    const data = { ...attrs };
    return {
        get: (k: string) => (data as any)[k],
        set: (k: string, v: unknown) => {
            (data as any)[k] = v;
        },
        save: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(true),
        toJson: () => ({ ...data }),
    };
}

function req(method: string, body?: unknown) {
    return {
        request: new Request('http://localhost/api/rbac/roles', {
            method,
            headers: { 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        }),
        env: {},
    } as any;
}

describe('admin roles — per-org scoping', () => {
    beforeEach(() => vi.clearAllMocks());

    it('an org admin creates a role owned by their organization (server-controlled scope)', async () => {
        mockAuth('org-a');
        vi.spyOn(Role, 'findByName').mockResolvedValue(null as any);
        const createSpy = vi
            .spyOn(Role, 'create')
            .mockResolvedValue(fakeRole({ id: 'r1', name: 'Support', organizationId: 'org-a' }) as any);

        const res = await handleAdminRoleCreate(req('POST', { name: 'Support', organizationId: 'org-evil' }));
        expect(res.status).toBe(200);
        // organizationId comes from the caller's scope, NOT the client-supplied 'org-evil'.
        expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Support', organizationId: 'org-a' }));
    });

    it('a system admin creates a GLOBAL role (organizationId null)', async () => {
        mockAuth('system');
        vi.spyOn(Role, 'findByName').mockResolvedValue(null as any);
        const createSpy = vi
            .spyOn(Role, 'create')
            .mockResolvedValue(fakeRole({ id: 'r2', name: 'auditor', organizationId: null }) as any);

        await handleAdminRoleCreate(req('POST', { name: 'auditor' }));
        expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ organizationId: null }));
    });

    it('rejects a duplicate role name within the same scope', async () => {
        mockAuth('org-a');
        vi.spyOn(Role, 'findByName').mockResolvedValue(fakeRole({ id: 'r1', name: 'Support' }) as any);
        const createSpy = vi.spyOn(Role, 'create');

        const res = await handleAdminRoleCreate(req('POST', { name: 'Support' }));
        expect(res.status).toBe(409);
        expect(createSpy).not.toHaveBeenCalled();
    });

    it("an org admin cannot update another org's role (reported as not found)", async () => {
        mockAuth('org-a');
        const otherOrgRole = fakeRole({ id: 'r9', name: 'x', organizationId: 'org-b' });
        vi.spyOn(Role, 'find').mockResolvedValue(otherOrgRole as any);

        const res = await handleAdminRoleUpdate(req('PATCH', { description: 'hijack' }), 'r9');
        expect(res.status).toBe(404);
        expect(otherOrgRole.save).not.toHaveBeenCalled();
    });

    it('an org admin cannot delete a global/system role (reported as not found)', async () => {
        mockAuth('org-a');
        const globalRole = fakeRole({ id: 'r0', name: 'admin', organizationId: null, isSystem: true });
        vi.spyOn(Role, 'find').mockResolvedValue(globalRole as any);

        const res = await handleAdminRoleDelete(req('DELETE'), 'r0');
        expect(res.status).toBe(404);
        expect(globalRole.destroy).not.toHaveBeenCalled();
    });

    it('a system admin cannot delete a system role (403)', async () => {
        mockAuth('system');
        const sysRole = fakeRole({ id: 'r0', name: 'admin', organizationId: null, isSystem: true });
        vi.spyOn(Role, 'find').mockResolvedValue(sysRole as any);

        const res = await handleAdminRoleDelete(req('DELETE'), 'r0');
        expect(res.status).toBe(403);
        expect(sysRole.destroy).not.toHaveBeenCalled();
    });

    it('an org admin deletes their own non-system role', async () => {
        mockAuth('org-a');
        const ownRole = fakeRole({ id: 'r5', name: 'Support', organizationId: 'org-a', isSystem: false });
        vi.spyOn(Role, 'find').mockResolvedValue(ownRole as any);

        const res = await handleAdminRoleDelete(req('DELETE'), 'r5');
        expect(res.status).toBe(200);
        expect(ownRole.destroy).toHaveBeenCalled();
    });

    it('list returns global roles plus the org admin’s own org roles', async () => {
        mockAuth('org-a');
        const whereSpy = vi
            .spyOn(Role, 'where')
            .mockResolvedValueOnce([fakeRole({ id: 'g1', name: 'admin', organizationId: null })] as any)
            .mockResolvedValueOnce([fakeRole({ id: 'o1', name: 'Support', organizationId: 'org-a' })] as any);

        const res = await handleAdminRolesList(req('GET'));
        const payload = (await res.json()) as { data: Array<{ name: string }> };
        expect(res.status).toBe(200);
        expect(payload.data.map((r) => r.name).sort()).toEqual(['Support', 'admin']);
        expect(whereSpy).toHaveBeenCalledWith({ organizationId: null }, expect.anything());
        expect(whereSpy).toHaveBeenCalledWith({ organizationId: 'org-a' }, expect.anything());
    });
});
