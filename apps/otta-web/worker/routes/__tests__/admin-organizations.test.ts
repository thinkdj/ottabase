import { Organization } from '@ottabase/ottaorm/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAccountOnboardingOrganizationCreate } from '../account-organizations';
import { handleCurrentOrganizationUpdate } from '../current-organization';

vi.mock('@ottabase/auth/backend', () => ({
    getSession: vi.fn(),
}));

vi.mock('../../lib/auth-utils', () => ({
    getAuthOptions: vi.fn(() => ({})),
}));

vi.mock('../../lib/db-utils', () => ({
    initDbConnection: vi.fn(),
}));

vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn(),
}));

vi.mock('../../lib/organization-admin', () => ({
    resolveTenantOrganizationId: vi.fn(),
    syncMembershipRoleToTenantRBAC: vi.fn(),
}));

vi.mock('../../lib/org-audit', () => ({
    auditOrganizationAction: vi.fn(),
}));

import { getSession } from '@ottabase/auth/backend';
import { requireAdminAccess } from '../../lib/admin-guard';
import { resolveTenantOrganizationId, syncMembershipRoleToTenantRBAC } from '../../lib/organization-admin';

describe('organization route handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates an onboarding organization for the authenticated user', async () => {
        vi.mocked(getSession).mockResolvedValue({
            user: { id: 'user-1', email: 'owner@example.com', name: 'Owner' },
        } as any);

        vi.spyOn(Organization, 'createWithOwner').mockResolvedValue({
            get: (key: string) => (key === 'id' ? 'org-new' : null),
            toJson: () => ({ id: 'org-new', name: 'Acme', slug: 'acme', plan: 'free', status: 'active' }),
        } as any);

        const response = await handleAccountOnboardingOrganizationCreate({
            request: new Request('http://localhost/api/onboarding/organizations', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'Acme', slug: 'acme' }),
            }),
            env: { OBCF_D1: {} },
            route: '/api/onboarding/organizations',
        } as any);

        expect(response.status).toBe(201);
        expect(syncMembershipRoleToTenantRBAC).toHaveBeenCalledWith({
            userId: 'user-1',
            organizationId: 'org-new',
            membershipRole: 'owner',
            membershipStatus: 'active',
            assignedBy: 'user-1',
        });
    });

    it('rejects platform-only fields on the current-organization update route', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({
            user: { id: 'admin-1', email: 'admin@example.com' },
            organizationId: 'org-1',
            appId: 'web',
            rbac: { organizationId: 'org-1' } as any,
            session: {},
        });
        vi.mocked(resolveTenantOrganizationId).mockReturnValue('org-1');

        const response = await handleCurrentOrganizationUpdate({
            request: new Request('http://localhost/api/admin/organization', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ slug: 'nope' }),
            }),
            env: { OBCF_D1: {} },
            route: '/api/admin/organization',
        } as any);

        expect(response.status).toBe(403);
        const body = (await response.json()) as any;
        expect(body.code).toBe('FORBIDDEN');
    });
});
