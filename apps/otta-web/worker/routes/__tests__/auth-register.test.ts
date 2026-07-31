import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAuthRegister } from '../auth';

const mocks = vi.hoisted(() => ({
    userFirst: vi.fn(),
    userCreate: vi.fn(),
    userDelete: vi.fn(),
    provisionOrganization: vi.fn(),
    enforceRateLimit: vi.fn(),
}));

vi.mock('@ottabase/auth/backend', () => ({
    createSessionCookieForUser: vi.fn(),
    getSession: vi.fn(),
    handleAuthRequest: vi.fn(),
    hashPassword: vi.fn(async () => 'hashed-password'),
    hashToken: vi.fn(),
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
    VerificationToken: {},
}));

vi.mock('../../../ottabase/config.loader', () => ({
    getOttabaseConfig: vi.fn(() => ({ packages: { referrals: false } })),
}));

vi.mock('../../../ottabase/helpers/referral-attribution', () => ({
    processReferralAttribution: vi.fn(),
}));

vi.mock('../../../src/email/templates', () => ({
    registerAppEmailTemplates: vi.fn(),
}));

vi.mock('../../lib/auth-utils', () => ({
    bumpProfileVersion: vi.fn(),
    createVerificationToken: vi.fn(),
    getAuthOptions: vi.fn(() => ({})),
    getUserLinkedAccounts: vi.fn(),
    resolveMailer: vi.fn(),
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
});
