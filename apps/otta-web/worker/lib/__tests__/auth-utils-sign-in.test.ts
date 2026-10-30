import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    ensurePersonalOrganization: vi.fn(),
    activateOrgInvites: vi.fn(),
    activateGroupInvites: vi.fn(),
    sendTemplatedEmail: vi.fn(),
    resolveAppMailer: vi.fn(),
    emit: vi.fn(),
}));

vi.mock('../user-provisioning', () => ({ ensurePersonalOrganization: mocks.ensurePersonalOrganization }));
vi.mock('../email-provider', () => ({ resolveAppMailer: mocks.resolveAppMailer }));
vi.mock('@ottabase/email', () => ({ sendTemplatedEmail: mocks.sendTemplatedEmail }));
vi.mock('../../../src/email/templates', () => ({ registerAppEmailTemplates: vi.fn() }));
vi.mock('@ottabase/ottaorm', () => ({ registerConnection: vi.fn() }));
vi.mock('@ottabase/db/drizzle-d1', () => ({ createD1Driver: vi.fn() }));
vi.mock('@ottabase/ottaorm/models', () => ({
    Account: {},
    OrganizationMember: { activatePendingInvites: mocks.activateOrgInvites },
    UserGroup: {},
    UserGroupMember: { activatePendingInvites: mocks.activateGroupInvites },
    VerificationToken: {},
}));
vi.mock('../../../ottabase/config.loader', () => ({
    getOttabaseConfig: vi.fn(() => ({ appId: 'test-app', appName: 'Demo App' })),
}));
vi.mock('../../../ottabase/events', () => ({ events: { emit: mocks.emit } }));

import { getAuthOptions } from '../auth-utils';

function env(overrides: Record<string, unknown> = {}) {
    return { OBCF_D1: {}, AUTH_URL: 'https://demo.example.com', ...overrides } as any;
}

describe('onSignIn: every account gets a workspace', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.activateOrgInvites.mockResolvedValue(undefined);
        mocks.activateGroupInvites.mockResolvedValue(undefined);
        mocks.resolveAppMailer.mockResolvedValue({
            mailer: { provider: 'resend', send: vi.fn() },
            from: 'noreply@example.com',
        });
        mocks.emit.mockResolvedValue({ delivered: 0 });
    });

    it('tells the bus about every sign-in, after the workspace exists', async () => {
        mocks.ensurePersonalOrganization.mockResolvedValue('org-new');

        await getAuthOptions(env()).onSignIn!({ userId: 'user-1', email: 'new@example.com' });

        expect(mocks.emit).toHaveBeenCalledWith(
            expect.anything(),
            'user.signed-in',
            { userId: 'user-1', email: 'new@example.com', organizationId: 'org-new' },
            { actor: { userId: 'user-1', organizationId: 'org-new', appId: 'test-app' } },
        );
        expect(mocks.emit.mock.invocationCallOrder[0]).toBeGreaterThan(
            mocks.ensurePersonalOrganization.mock.invocationCallOrder[0]!,
        );
    });

    it('never fails the sign-in over a listener', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        mocks.ensurePersonalOrganization.mockResolvedValue(null);
        mocks.emit.mockRejectedValue(new Error('listener down'));

        await expect(
            getAuthOptions(env()).onSignIn!({ userId: 'user-1', email: 'new@example.com' }),
        ).resolves.toBeUndefined();
        expect(mocks.emit).toHaveBeenCalledWith(
            expect.anything(),
            'user.signed-in',
            expect.objectContaining({ organizationId: null }),
            expect.anything(),
        );
    });

    it('provisions a workspace for an account with none, after activating its invites', async () => {
        mocks.ensurePersonalOrganization.mockResolvedValue('org-new');

        await getAuthOptions(env()).onSignIn!({ userId: 'user-1', email: 'new@example.com' });

        expect(mocks.activateOrgInvites).toHaveBeenCalledWith('user-1', 'new@example.com');
        expect(mocks.ensurePersonalOrganization).toHaveBeenCalledWith({
            userId: 'user-1',
            email: 'new@example.com',
            appId: 'test-app',
        });
        // Outside DEMO_MODE there is no welcome mail.
        expect(mocks.sendTemplatedEmail).not.toHaveBeenCalled();
    });

    it('still provisions when invite activation fails', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        mocks.activateOrgInvites.mockRejectedValue(new Error('invites down'));
        mocks.ensurePersonalOrganization.mockResolvedValue('org-new');

        await getAuthOptions(env()).onSignIn!({ userId: 'user-1', email: 'new@example.com' });

        expect(mocks.ensurePersonalOrganization).toHaveBeenCalled();
    });

    it('propagates a provisioning failure, so @ottabase/auth refuses the sign-in', async () => {
        mocks.ensurePersonalOrganization.mockRejectedValue(new Error('provisioning failed'));

        await expect(getAuthOptions(env()).onSignIn!({ userId: 'user-1', email: 'new@example.com' })).rejects.toThrow(
            'provisioning failed',
        );
    });

    it('welcomes a newly provisioned account on a public demo, linking the demo and the call to action', async () => {
        mocks.ensurePersonalOrganization.mockResolvedValue('org-new');

        await getAuthOptions(
            env({ DEMO_MODE: 'true', DEMO_CTA_LABEL: 'Get Pro', DEMO_CTA_URL: 'https://example.com/pro' }),
        ).onSignIn!({ userId: 'user-1', email: 'new@example.com' });

        expect(mocks.sendTemplatedEmail).toHaveBeenCalledOnce();
        const [, input] = mocks.sendTemplatedEmail.mock.calls[0];
        expect(input.to).toBe('new@example.com');
        expect(input.variables.body).toContain('https://demo.example.com/demo');
        expect(input.variables.body).toContain('https://example.com/pro');
    });

    it('sends nothing to a returning account, even on a demo', async () => {
        mocks.ensurePersonalOrganization.mockResolvedValue(null);

        await getAuthOptions(env({ DEMO_MODE: 'true' })).onSignIn!({ userId: 'user-1', email: 'back@example.com' });

        expect(mocks.sendTemplatedEmail).not.toHaveBeenCalled();
    });

    it('never fails the sign-in over the welcome mail', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        mocks.ensurePersonalOrganization.mockResolvedValue('org-new');
        mocks.sendTemplatedEmail.mockRejectedValue(new Error('smtp down'));

        await expect(
            getAuthOptions(env({ DEMO_MODE: 'true' })).onSignIn!({ userId: 'user-1', email: 'new@example.com' }),
        ).resolves.toBeUndefined();
    });
});
