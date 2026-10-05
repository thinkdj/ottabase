import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleUserAccountUnlink, handleUserSessionRevoke, handleUserSessionsList } from '../auth';

const mocks = vi.hoisted(() => ({
    getSession: vi.fn(),
    listUserSessions: vi.fn(),
    revokeSession: vi.fn(),
    revokeOtherSessions: vi.fn(),
    userFind: vi.fn(),
    accountsForUser: vi.fn(),
    accountDelete: vi.fn(),
    linkedAccounts: vi.fn(),
}));

vi.mock('@ottabase/auth/backend', () => ({
    createSessionCookieForUser: vi.fn(),
    getSession: mocks.getSession,
    handleAuthRequest: vi.fn(),
    hashPassword: vi.fn(),
    hashToken: vi.fn(),
    listUserSessions: mocks.listUserSessions,
    revokeAllUserSessions: vi.fn(),
    revokeOtherSessions: mocks.revokeOtherSessions,
    revokeSession: mocks.revokeSession,
    verifyPassword: vi.fn(),
}));
vi.mock('@ottabase/auth/config', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/auth/config')>()),
    getLoginConfig: vi.fn(() => ({})),
}));
vi.mock('@ottabase/db/drizzle-d1', () => ({ createD1Driver: vi.fn(() => ({})) }));
vi.mock('@ottabase/email', () => ({ sendTemplatedEmail: vi.fn() }));
vi.mock('@ottabase/ottaorm', () => ({ registerConnection: vi.fn() }));
vi.mock('@ottabase/ottaorm/models', () => ({
    Account: { forUser: mocks.accountsForUser, delete: mocks.accountDelete },
    OrganizationMember: {},
    User: { find: mocks.userFind },
    VerificationToken: {},
}));
vi.mock('../../../ottabase/config.loader', () => ({ getOttabaseConfig: vi.fn(() => ({ packages: {} })) }));
vi.mock('../../../ottabase/helpers/referral-attribution', () => ({ processReferralAttribution: vi.fn() }));
vi.mock('../../../src/email/templates', () => ({ registerAppEmailTemplates: vi.fn() }));
vi.mock('../../lib/auth-utils', () => ({
    getAuthOptions: vi.fn(() => ({})),
    getUserLinkedAccounts: mocks.linkedAccounts,
    bumpProfileVersion: vi.fn(),
    createVerificationToken: vi.fn(),
    resolveMailer: vi.fn(),
}));
vi.mock('../../lib/rate-limiting', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('../../lib/user-provisioning', () => ({ provisionDefaultOrganizationForUser: vi.fn() }));

const ctx = (path: string, method = 'GET') =>
    ({
        request: new Request(`http://x${path}`, { method }),
        env: { OBCF_D1: {} },
        url: new URL(`http://x${path}`),
        withAuthCors: (r: Response) => r,
    }) as any;
const account = (id: string, provider: string) => ({ get: (k: string) => ({ id, provider })[k] });

describe('account sessions and sign-in methods', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getSession.mockResolvedValue({ user: { id: 'u1' }, expires: 0, sessionId: 'current' });
    });

    it('lists sessions with the current one marked', async () => {
        mocks.listUserSessions.mockResolvedValue([
            { id: 'current', createdAt: 2, userAgent: 'Chrome', expiresAt: null },
            { id: 'other', createdAt: 1, userAgent: 'Safari', expiresAt: null },
        ]);
        const body = (await (await handleUserSessionsList(ctx('/api/users/me/sessions'))).json()) as any;
        expect(body.data.map((s: any) => [s.id, s.current])).toEqual([
            ['current', true],
            ['other', false],
        ]);
    });

    it('signs out one other device, never the current one through this route', async () => {
        const ok = await handleUserSessionRevoke(ctx('/api/users/me/sessions/other', 'DELETE'), 'other');
        expect(ok.status).toBe(200);
        expect(mocks.revokeSession).toHaveBeenCalledWith('u1', 'other', expect.anything(), expect.anything());

        const refused = await handleUserSessionRevoke(ctx('/api/users/me/sessions/current', 'DELETE'), 'current');
        expect(refused.status).toBe(400);
    });

    it('signs out everywhere else', async () => {
        mocks.revokeOtherSessions.mockResolvedValue(3);
        const body = (await (
            await handleUserSessionRevoke(ctx('/api/users/me/sessions', 'DELETE'), null)
        ).json()) as any;
        expect(mocks.revokeOtherSessions).toHaveBeenCalledWith('u1', 'current', expect.anything(), expect.anything());
        expect(body.revoked).toBe(3);
    });

    it('refuses to drop the only way to sign in', async () => {
        mocks.userFind.mockResolvedValue({ get: (k: string) => (k === 'passwordHash' ? null : null) });
        mocks.accountsForUser.mockResolvedValue([account('a1', 'github')]);
        const res = await handleUserAccountUnlink(ctx('/api/users/me/accounts/github', 'DELETE'), 'github');
        expect(res.status).toBe(400);
        expect(mocks.accountDelete).not.toHaveBeenCalled();
    });

    it('disconnects a provider when a password or another account remains', async () => {
        mocks.userFind.mockResolvedValue({ get: (k: string) => (k === 'passwordHash' ? 'hash' : null) });
        mocks.accountsForUser.mockResolvedValue([account('a1', 'github'), account('a2', 'google')]);
        mocks.linkedAccounts.mockResolvedValue([{ provider: 'google', type: 'oauth', createdAt: 1 }]);
        const res = await handleUserAccountUnlink(ctx('/api/users/me/accounts/github', 'DELETE'), 'github');
        const body = (await res.json()) as any;
        expect(res.status).toBe(200);
        expect(mocks.accountDelete).toHaveBeenCalledWith('a1');
        expect(body.linkedAccounts).toEqual([{ provider: 'google', type: 'oauth', createdAt: 1 }]);
    });
});
