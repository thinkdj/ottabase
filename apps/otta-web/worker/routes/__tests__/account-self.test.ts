import { Account, OrganizationMember, Session, User, UserRole, VerificationToken } from '@ottabase/ottaorm/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();

vi.mock('@ottabase/auth/backend', () => ({
    getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('../../lib/auth-utils', () => ({
    getAuthOptions: () => ({}),
}));

vi.mock('../../lib/db-utils', () => ({
    initDbConnection: vi.fn(),
}));

vi.mock('@ottabase/cf', () => ({
    userKey: (...parts: string[]) => parts.join(':'),
}));

import { handleAccountDelete, handleAccountExport } from '../account-self';

function createKV(): {
    kv: { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };
    store: Map<string, string>;
} {
    const store = new Map<string, string>();
    return {
        store,
        kv: {
            get: vi.fn(async (key: string) => store.get(key) ?? null),
            put: vi.fn(async (key: string, value: string) => {
                store.set(key, value);
            }),
        },
    };
}

function makeContext(url: string, method: string, env: Record<string, unknown> = { OBCF_D1: {} }) {
    const request = new Request(url, { method });
    return {
        request,
        env: env as any,
        url: new URL(request.url),
    };
}

function mockUser(overrides: Record<string, any> = {}) {
    const attrs = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User One',
        createdAt: Date.now(),
        ...overrides,
    };
    return {
        get: (key: string) => (attrs as any)[key],
        toJson: () => ({ ...attrs }),
        destroy: vi.fn(async () => true),
        accounts: vi.fn(async () => []),
        auditLogs: vi.fn(async () => []),
    } as any;
}

describe('handleAccountExport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 when there is no session', async () => {
        mockGetSession.mockResolvedValue(null);
        const response = await handleAccountExport(makeContext('http://localhost/api/account/export', 'GET'));
        expect(response.status).toBe(401);
    });

    it('returns 500 when D1 is not configured', async () => {
        const response = await handleAccountExport(makeContext('http://localhost/api/account/export', 'GET', {}));
        expect(response.status).toBe(500);
    });

    it('returns 404 when the user is missing from the database', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
        vi.spyOn(User, 'find').mockResolvedValue(null as any);

        const response = await handleAccountExport(makeContext('http://localhost/api/account/export', 'GET'));
        expect(response.status).toBe(404);
    });

    it('returns a JSON attachment with profile, linkedAccounts, organizations, and auditLogs', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
        const user = mockUser();
        user.accounts = vi.fn(async () => [
            { get: (k: string) => ({ provider: 'google', type: 'oauth', createdAt: 123 })[k] },
        ]);
        user.auditLogs = vi.fn(async () => [
            {
                get: (k: string) =>
                    ({
                        action: 'login',
                        resourceType: 'user',
                        resourceId: 'user-1',
                        organizationId: 'org-1',
                        metadata: null,
                        createdAt: 456,
                    })[k],
            },
        ]);
        vi.spyOn(User, 'find').mockResolvedValue(user);
        vi.spyOn(OrganizationMember, 'getUserOrganizations').mockResolvedValue([
            {
                organizationId: 'org-1',
                role: 'member',
                status: 'active',
                joinedAt: 789,
                organization: { name: 'Acme' },
            } as any,
        ]);

        const response = await handleAccountExport(makeContext('http://localhost/api/account/export', 'GET'));
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(response.headers.get('Content-Disposition')).toContain('attachment');

        const body = (await response.json()) as any;
        expect(body.profile.id).toBe('user-1');
        expect(body.linkedAccounts[0]).toMatchObject({ provider: 'google', type: 'oauth' });
        expect(body.organizations[0]).toMatchObject({ organizationId: 'org-1', organizationName: 'Acme' });
        expect(body.auditLogs[0]).toMatchObject({ action: 'login', resourceId: 'user-1' });
    });
});

describe('handleAccountDelete', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 when there is no session', async () => {
        mockGetSession.mockResolvedValue(null);
        const response = await handleAccountDelete(makeContext('http://localhost/api/account', 'DELETE'));
        expect(response.status).toBe(401);
    });

    it('returns 404 when the user record has already been removed', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
        vi.spyOn(User, 'find').mockResolvedValue(null as any);

        const response = await handleAccountDelete(makeContext('http://localhost/api/account', 'DELETE'));
        expect(response.status).toBe(404);
    });

    it('returns 409 when the user is the sole active owner of an organization', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
        vi.spyOn(User, 'find').mockResolvedValue(mockUser());
        vi.spyOn(OrganizationMember, 'getUserOrganizations').mockResolvedValue([
            {
                organizationId: 'org-1',
                role: 'owner',
                status: 'active',
                organization: { name: 'Acme' },
            } as any,
        ]);
        vi.spyOn(OrganizationMember, 'isLastActiveOwner').mockResolvedValue(true);

        const response = await handleAccountDelete(makeContext('http://localhost/api/account', 'DELETE'));
        expect(response.status).toBe(409);
        const body = (await response.json()) as any;
        expect(body.code).toBe('LAST_ACTIVE_OWNER_GUARD');
        expect(body.details.organizations).toContain('Acme');
    });

    it('tears down memberships, roles, accounts, sessions, tokens, and the user, then revokes KV', async () => {
        mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
        const user = mockUser();
        vi.spyOn(User, 'find').mockResolvedValue(user);
        vi.spyOn(OrganizationMember, 'getUserOrganizations').mockResolvedValue([
            { organizationId: 'org-1', role: 'member', status: 'active', organization: { name: 'Acme' } } as any,
        ]);
        vi.spyOn(OrganizationMember, 'isLastActiveOwner').mockResolvedValue(false);
        const removeMember = vi.spyOn(OrganizationMember, 'removeMember').mockResolvedValue(true);

        const userRole = { destroy: vi.fn(async () => true) };
        const account = { destroy: vi.fn(async () => true) };
        const session = { destroy: vi.fn(async () => true) };
        const token = { destroy: vi.fn(async () => true) };
        vi.spyOn(UserRole, 'where').mockResolvedValue([userRole] as any);
        vi.spyOn(Account, 'where').mockResolvedValue([account] as any);
        vi.spyOn(Session, 'where').mockResolvedValue([session] as any);
        vi.spyOn(VerificationToken, 'where').mockResolvedValue([token] as any);

        const { kv, store } = createKV();
        const response = await handleAccountDelete(
            makeContext('http://localhost/api/account', 'DELETE', { OBCF_D1: {}, OBCF_KV: kv }),
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.success).toBe(true);

        expect(removeMember).toHaveBeenCalledWith('user-1', 'org-1');
        expect(userRole.destroy).toHaveBeenCalled();
        expect(account.destroy).toHaveBeenCalled();
        expect(session.destroy).toHaveBeenCalled();
        expect(token.destroy).toHaveBeenCalled();
        expect(user.destroy).toHaveBeenCalled();

        const revoked = Array.from(store.entries()).find(([k]) => k.endsWith(':revoked'));
        expect(revoked).toBeDefined();
    });
});
