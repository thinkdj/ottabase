import { TURNSTILE_HEADER } from '@ottabase/cf/turnstile';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    handleAuthApiRequest,
    handleAuthRegister,
    handlePasswordResetRequest,
    handleVerifyEmailResend,
    type AuthRouteContext,
} from '../auth';

// The bot check on the five public auth forms (worker/lib/turnstile.ts is real; Cloudflare's
// siteverify is the mocked fetch), and the per-address mail cooldown behind three of them.

const mocks = vi.hoisted(() => ({
    enforceRateLimit: vi.fn(),
    handleAuthRequest: vi.fn(),
    getSession: vi.fn(),
    requireCsrf: vi.fn(),
    completeSignIn: vi.fn(),
    userFirst: vi.fn(),
    userCreate: vi.fn(),
    provisionOrganization: vi.fn(),
    sendTemplatedEmail: vi.fn(),
    resolveMailer: vi.fn(),
}));

vi.mock('@ottabase/auth/backend', () => ({
    completeSignIn: mocks.completeSignIn,
    createSessionCookieForUser: vi.fn(),
    getSession: mocks.getSession,
    handleAuthRequest: mocks.handleAuthRequest,
    hashPassword: vi.fn(async () => 'hashed-password'),
    hashToken: vi.fn(async (value: string) => `sha:${value}`),
    requestLocaleDefaults: vi.fn(() => ({ timezone: null, locale: null })),
    requireCsrf: mocks.requireCsrf,
    revokeAllUserSessions: vi.fn(),
    verifyPassword: vi.fn(),
}));
vi.mock('@ottabase/auth/config', () => ({ getLoginConfig: vi.fn(() => ({})) }));
vi.mock('@ottabase/db/drizzle-d1', () => ({ createD1Driver: vi.fn(() => ({})) }));
vi.mock('@ottabase/email', () => ({ sendTemplatedEmail: mocks.sendTemplatedEmail }));
vi.mock('@ottabase/ottaorm', () => ({ registerConnection: vi.fn() }));
vi.mock('@ottabase/ottaorm/models', () => ({
    OrganizationMember: {},
    User: { first: mocks.userFirst, create: mocks.userCreate, delete: vi.fn() },
    VerificationToken: {},
}));
vi.mock('../../../ottabase/config.loader', () => ({
    getOttabaseConfig: vi.fn(() => ({ features: { referrals: { enabled: false } } })),
}));
// otta:begin referrals
vi.mock('../../../ottabase/helpers/referral-attribution', () => ({ processReferralAttribution: vi.fn() }));
// otta:end referrals
vi.mock('../../../src/email/templates', () => ({ registerAppEmailTemplates: vi.fn() }));
vi.mock('../../lib/auth-utils', () => ({
    bumpProfileVersion: vi.fn(),
    createVerificationToken: vi.fn(async () => ({ token: 'mail-token' })),
    emitAccountEvent: vi.fn(),
    getAuthOptions: vi.fn(() => ({})),
    getUserLinkedAccounts: vi.fn(),
    resolveMailer: mocks.resolveMailer,
    sendDemoWelcomeEmail: vi.fn(),
}));
vi.mock('../../lib/rate-limiting', () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock('../../lib/user-provisioning', () => ({
    provisionDefaultOrganizationForUser: mocks.provisionOrganization,
    signupRoleFallbacks: () => ['member', 'viewer'],
}));

const KEYS = { TURNSTILE_SITE_KEY: '0x4AAAAAAA-site_key', TURNSTILE_SECRET_KEY: 'real-secret' };

/** A KV namespace in memory: enough for the mail cooldown. */
function memoryKv() {
    const store = new Map<string, string>();
    return {
        store,
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => void store.set(key, value)),
    };
}

/** Cloudflare's siteverify, answering success for `action` on app.example.com. */
function siteverify(action: string) {
    return vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(
            async () => new Response(JSON.stringify({ success: true, action, hostname: 'app.example.com' })),
        );
}

function context(path: string, body: object, options: { token?: string; env?: object } = {}): AuthRouteContext {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (options.token) headers.set(TURNSTILE_HEADER, options.token);
    const request = new Request(`https://app.example.com${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    return {
        request,
        env: { OBCF_D1: {}, APP_ID: 'otta-web', ...options.env } as any,
        url: new URL(request.url),
        withAuthCors: (response) => response,
    };
}

function userModel(values: Record<string, unknown>) {
    return { get: (key: string) => values[key], toJson: () => ({ ...values }) };
}

const PASSWORD = 'Str0ng!Password';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.handleAuthRequest.mockImplementation(async () => new Response(JSON.stringify({ success: true })));
    mocks.getSession.mockResolvedValue(null);
    mocks.requireCsrf.mockResolvedValue(null);
    mocks.completeSignIn.mockResolvedValue({
        cookie: 'ottabase.session-token=jwt',
        session: { user: { id: 'user-1', email: 'new@example.com' }, expires: 123 },
    });
    mocks.userFirst.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue(userModel({ id: 'user-1', email: 'new@example.com', name: 'New' }));
    mocks.provisionOrganization.mockResolvedValue({
        organizationId: 'org-1',
        organizationRole: 'owner',
        assignedRole: 'owner',
    });
    mocks.resolveMailer.mockResolvedValue({ mailer: {}, from: 'app@example.com' });
});
afterEach(() => vi.restoreAllMocks());

// Each public form: refused without a token when keys are set, through with a token minted for
// its own action, and untouched (no call to Cloudflare) when keys are unset.
const forms: Array<{
    name: string;
    action: string;
    call: (token?: string, env?: object) => Promise<Response>;
}> = [
    {
        name: 'password sign-in',
        action: 'signin',
        call: (token, env) =>
            handleAuthApiRequest(
                context('/api/auth/callback/credentials', { email: 'a@example.com', password: 'x' }, { token, env }),
            ),
    },
    {
        name: 'magic link',
        action: 'signin',
        call: (token, env) =>
            handleAuthApiRequest(context('/api/auth/signin/email', { email: 'a@example.com' }, { token, env })),
    },
    {
        name: 'register',
        action: 'register',
        call: (token, env) =>
            handleAuthRegister(
                context('/api/auth/register', { email: 'new@example.com', password: PASSWORD }, { token, env }),
            ),
    },
    {
        name: 'password reset request',
        action: 'password-reset',
        call: (token, env) =>
            handlePasswordResetRequest(
                context('/api/auth/password/reset/request', { email: 'a@example.com' }, { token, env }),
            ),
    },
    {
        name: 'verification resend',
        action: 'verify-resend',
        call: (token, env) =>
            handleVerifyEmailResend(
                context('/api/auth/verify-email/resend', { email: 'a@example.com' }, { token, env }),
            ),
    },
];

describe.each(forms)('Turnstile on $name', ({ action, call }) => {
    it('answers 403 TURNSTILE_FAILED without a token when both keys are set', async () => {
        const fetch = siteverify(action);
        const response = await call(undefined, KEYS);

        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ code: 'TURNSTILE_FAILED' });
        expect(fetch).not.toHaveBeenCalled();
        expect(mocks.handleAuthRequest).not.toHaveBeenCalled();
    });

    it('passes with a token minted for its action', async () => {
        const fetch = siteverify(action);
        const response = await call('token', KEYS);

        expect(response.status).toBe(200);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('refuses a token minted for another form', async () => {
        siteverify('comment');
        expect((await call('token', KEYS)).status).toBe(403);
    });

    it('is unchanged when the keys are unset', async () => {
        const fetch = siteverify(action);
        expect((await call()).status).toBe(200);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('rate limits before asking Cloudflare', async () => {
        const fetch = siteverify(action);
        mocks.enforceRateLimit.mockResolvedValue(new Response('{}', { status: 429 }));

        expect((await call('token', KEYS)).status).toBe(429);
        expect(fetch).not.toHaveBeenCalled();
    });
});

describe('password sign-in when Cloudflare is unreachable', () => {
    it('lets the sign-in through (the rate limit still holds), while a magic link is refused', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

        const signIn = await forms[0].call('token', KEYS);
        const magicLink = await forms[1].call('token', KEYS);

        expect(signIn.status).toBe(200);
        expect(magicLink.status).toBe(503);
    });
});

describe('verification resend for a signed-in user', () => {
    it('skips Turnstile: the profile page renders no widget', async () => {
        const fetch = siteverify('verify-resend');
        mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });

        expect((await forms[4].call(undefined, KEYS)).status).toBe(200);
        expect(fetch).not.toHaveBeenCalled();
    });
});

describe('the per-address mail cooldown', () => {
    const unverified = () =>
        mocks.userFirst.mockResolvedValue(userModel({ id: 'user-1', email: 'a@example.com', emailVerified: null }));

    it.each([
        ['password reset', 'password-reset', forms[3], () => mocks.sendTemplatedEmail],
        ['verification resend', 'verify-resend', forms[4], () => mocks.sendTemplatedEmail],
        ['magic link', 'magic-link', forms[1], () => mocks.handleAuthRequest],
    ] as const)(
        '%s mails once a minute and answers a repeat exactly as if it had sent',
        async (_n, kind, form, sent) => {
            unverified();
            const kv = memoryKv();

            const first = await form.call(undefined, { OBCF_KV: kv });
            const second = await form.call(undefined, { OBCF_KV: kv });

            expect(sent()).toHaveBeenCalledTimes(1);
            expect(second.status).toBe(first.status);
            expect(await second.json()).toEqual(await first.json());
            // The key holds the address's hash, never the address, and expires on its own.
            expect(kv.put).toHaveBeenCalledWith(`auth:cooldown:${kind}:sha:a@example.com`, '1', { expirationTtl: 60 });
        },
    );

    it('treats the address case-insensitively', async () => {
        unverified();
        const kv = memoryKv();
        const reset = (email: string) =>
            handlePasswordResetRequest(
                context('/api/auth/password/reset/request', { email }, { env: { OBCF_KV: kv } }),
            );

        await reset('a@example.com');
        await reset(' A@Example.com ');
        expect(mocks.sendTemplatedEmail).toHaveBeenCalledTimes(1);
    });

    it('starts no cooldown when the magic link was not sent', async () => {
        const kv = memoryKv();
        mocks.handleAuthRequest.mockImplementation(
            async () => new Response(JSON.stringify({ error: 'Failed to send magic link' }), { status: 502 }),
        );

        await forms[1].call(undefined, { OBCF_KV: kv });
        await forms[1].call(undefined, { OBCF_KV: kv });

        expect(mocks.handleAuthRequest).toHaveBeenCalledTimes(2);
        expect(kv.put).not.toHaveBeenCalled();
    });
});

describe('register signs the new account in itself', () => {
    it('returns the session and its cookie, from the shared sign-in tail', async () => {
        const response = await forms[2].call();
        const body = (await response.json()) as { session?: unknown };

        expect(response.status).toBe(200);
        expect(response.headers.get('Set-Cookie')).toBe('ottabase.session-token=jwt');
        expect(body.session).toEqual({ user: { id: 'user-1', email: 'new@example.com' }, expires: 123 });
        expect(mocks.completeSignIn).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'user-1', email: 'new@example.com' }),
            expect.anything(),
            expect.any(Request),
            expect.anything(),
        );
    });

    it('issues no session when email verification is required', async () => {
        const response = await forms[2].call(undefined, { AUTH_REQUIRE_EMAIL_VERIFIED: 'true' });
        const body = (await response.json()) as { session?: unknown; requiresEmailVerification?: boolean };

        expect(response.status).toBe(200);
        expect(body).toMatchObject({ session: null, requiresEmailVerification: true });
        expect(response.headers.get('Set-Cookie')).toBeNull();
        expect(mocks.completeSignIn).not.toHaveBeenCalled();
    });

    it('answers 500 without a session when the sign-in tail fails', async () => {
        mocks.completeSignIn.mockResolvedValue(null);
        const response = await forms[2].call();

        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({ code: 'ACCOUNT_PROVISIONING_FAILED' });
        expect(response.headers.get('Set-Cookie')).toBeNull();
    });

    it('holds the same CSRF line as sign-in, before creating anything', async () => {
        mocks.requireCsrf.mockResolvedValue(new Response('{"error":"Invalid or missing CSRF token"}', { status: 403 }));

        expect((await forms[2].call()).status).toBe(403);
        expect(mocks.userCreate).not.toHaveBeenCalled();
    });
});
