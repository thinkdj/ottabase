import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAuthRegister, handleVerifyEmail } from '../auth';

const mocks = vi.hoisted(() => ({
    userFirst: vi.fn(),
    userCreate: vi.fn(),
    userDelete: vi.fn(),
    provisionOrganization: vi.fn(),
    enforceRateLimit: vi.fn(),
    sendDemoWelcomeEmail: vi.fn(),
    emitAccountEvent: vi.fn(),
    consumeToken: vi.fn(),
}));

vi.mock('@ottabase/auth/backend', () => ({
    createSessionCookieForUser: vi.fn(),
    getSession: vi.fn(),
    handleAuthRequest: vi.fn(),
    hashPassword: vi.fn(async () => 'hashed-password'),
    hashToken: vi.fn(),
    requestLocaleDefaults: vi.fn(() => ({ timezone: null, locale: null })),
    revokeAllUserSessions: vi.fn(),
    verifyPassword: vi.fn(),
}));

vi.mock('@ottabase/auth/config', () => ({
    getLoginConfig: vi.fn(() => ({})),
}));

vi.mock('@ottabase/db/drizzle-d1', () => ({
    createD1Driver: vi.fn(() => ({})),
}));

vi.mock('@ottabase/email', () => ({
    sendTemplatedEmail: vi.fn(),
}));

vi.mock('@ottabase/ottaorm', () => ({
    registerConnection: vi.fn(),
}));

vi.mock('@ottabase/ottaorm/models', () => ({
    OrganizationMember: {},
    User: {
        first: mocks.userFirst,
        create: mocks.userCreate,
        delete: mocks.userDelete,
    },
    VerificationToken: { consumeByIdentifierAndToken: mocks.consumeToken },
}));

vi.mock('../../../ottabase/config.loader', () => ({
    getOttabaseConfig: vi.fn(() => ({ features: { referrals: { enabled: false } } })),
}));

// otta:begin referrals
vi.mock('../../../ottabase/helpers/referral-attribution', () => ({
    processReferralAttribution: vi.fn(),
}));
// otta:end referrals

vi.mock('../../../src/email/templates', () => ({
    registerAppEmailTemplates: vi.fn(),
}));

vi.mock('../../lib/auth-utils', () => ({
    bumpProfileVersion: vi.fn(),
    createVerificationToken: vi.fn(),
    emitAccountEvent: mocks.emitAccountEvent,
    getAuthOptions: vi.fn(() => ({})),
    getUserLinkedAccounts: vi.fn(),
    resolveMailer: vi.fn(),
    sendDemoWelcomeEmail: mocks.sendDemoWelcomeEmail,
}));

vi.mock('../../lib/rate-limiting', () => ({
    enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('../../lib/user-provisioning', () => ({
    provisionDefaultOrganizationForUser: mocks.provisionOrganization,
}));

function createUserModel() {
    const values: Record<string, unknown> = {
        id: 'user-1',
        email: 'founder@example.com',
        name: 'Founder',
    };
    return {
        get: (key: string) => values[key],
        toJson: () => ({ ...values }),
    };
}

describe('handleAuthRegister provisioning boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.enforceRateLimit.mockResolvedValue(null);
        mocks.userFirst.mockResolvedValue(null);
        mocks.userCreate.mockResolvedValue(createUserModel());
        mocks.userDelete.mockResolvedValue(true);
        mocks.provisionOrganization.mockRejectedValue(new Error('simulated organization failure'));
    });

    it('rolls back the new user and returns a structured failure instead of a partial success', async () => {
        const request = new Request('https://app.example.com/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'founder@example.com',
                password: 'Str0ng!Password',
                name: 'Founder',
            }),
        });

        const response = await handleAuthRegister({
            request,
            env: {
                OBCF_D1: {},
                APP_ID: 'otta-web',
            } as any,
            url: new URL(request.url),
            withAuthCors: (value) => value,
        });
        const body = (await response.json()) as { error?: string; code?: string; success?: boolean };

        expect(response.status).toBe(500);
        expect(body).toMatchObject({
            error: 'Account workspace setup could not be completed. Please try again.',
            code: 'ACCOUNT_PROVISIONING_FAILED',
        });
        expect(body.success).not.toBe(true);
        expect(mocks.userDelete).toHaveBeenCalledWith('user-1');
    });

    it('sends the demo welcome once the workspace is provisioned (a no-op outside DEMO_MODE)', async () => {
        mocks.provisionOrganization.mockResolvedValue({
            organizationId: 'org-1',
            organizationRole: 'owner',
            assignedRole: 'owner',
        });
        const request = new Request('https://app.example.com/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'founder@example.com', password: 'Str0ng!Password', name: 'Founder' }),
        });

        const response = await handleAuthRegister({
            request,
            env: { OBCF_D1: {}, APP_ID: 'otta-web' } as any,
            url: new URL(request.url),
            withAuthCors: (value) => value,
        });

        expect(response.status).toBe(200);
        expect(mocks.sendDemoWelcomeEmail).toHaveBeenCalledWith(expect.anything(), 'founder@example.com');
    });
});

describe('account events from the app’s own auth routes', () => {
    const registerRequest = () =>
        new Request('https://app.example.com/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'founder@example.com', password: 'Str0ng!Password', name: 'Founder' }),
        });
    const route = (request: Request) => ({
        request,
        env: { OBCF_D1: {}, APP_ID: 'otta-web' } as any,
        url: new URL(request.url),
        withAuthCors: (value: Response) => value,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.enforceRateLimit.mockResolvedValue(null);
        mocks.userFirst.mockResolvedValue(null);
        mocks.userCreate.mockResolvedValue(createUserModel());
    });

    it('a credentials sign-up announces user.created once, with its workspace', async () => {
        mocks.provisionOrganization.mockResolvedValue({
            organizationId: 'org-1',
            organizationRole: 'owner',
            assignedRole: 'owner',
        });

        expect((await handleAuthRegister(route(registerRequest()))).status).toBe(200);

        expect(mocks.emitAccountEvent).toHaveBeenCalledTimes(1);
        expect(mocks.emitAccountEvent).toHaveBeenCalledWith(expect.anything(), 'user.created', {
            userId: 'user-1',
            email: 'founder@example.com',
            name: 'Founder',
            organizationId: 'org-1',
            method: 'credentials',
            at: expect.any(Number),
        });
    });

    it('a sign-up rolled back for its workspace announces nothing', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mocks.provisionOrganization.mockRejectedValue(new Error('simulated organization failure'));

        expect((await handleAuthRegister(route(registerRequest()))).status).toBe(500);
        expect(mocks.emitAccountEvent).not.toHaveBeenCalled();
    });

    it('the verify link announces user.verified on the first verification only', async () => {
        const verify = () =>
            handleVerifyEmail(
                route(new Request('https://app.example.com/api/auth/verify-email?token=t&email=founder@example.com')),
            );
        mocks.consumeToken.mockResolvedValue({ get: () => Date.now() + 60_000 });
        const values: Record<string, unknown> = { id: 'user-1', emailVerified: null };
        const user = {
            get: (key: string) => values[key],
            set: (key: string, value: unknown) => (values[key] = value),
            save: vi.fn(async () => undefined),
        };
        mocks.userFirst.mockResolvedValue(user);

        expect((await verify()).status).toBe(200);
        expect(mocks.emitAccountEvent).toHaveBeenCalledWith(expect.anything(), 'user.verified', {
            userId: 'user-1',
            email: 'founder@example.com',
            at: values.emailVerified,
        });

        // A second link (sign-up's, after a resent one was used) keeps the first time and says nothing.
        const first = values.emailVerified;
        expect((await verify()).status).toBe(200);
        expect(mocks.emitAccountEvent).toHaveBeenCalledTimes(1);
        expect(user.save).toHaveBeenCalledTimes(1);
        expect(values.emailVerified).toBe(first);
    });
});
