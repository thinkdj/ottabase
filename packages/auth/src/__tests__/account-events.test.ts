/**
 * The account events @ottabase/auth hands to `options.emit`: `user.created` once per account it
 * creates (OAuth, magic link), `user.verified` only when `emailVerified` goes from null to a time.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signJwt } from '../jwt';
import type { AuthEnv, CreateAuthConfigOptions } from '../types';

const m = vi.hoisted(() => ({
    userFirst: vi.fn(),
    userFind: vi.fn(),
    userCreate: vi.fn(),
    userUpdate: vi.fn(),
    userDelete: vi.fn(),
    accountFirst: vi.fn(),
    accountCreate: vi.fn(),
    consumeToken: vi.fn(),
    fetchUserProfile: vi.fn(),
}));

vi.mock('@ottabase/ottaorm/models', () => ({
    User: { first: m.userFirst, find: m.userFind, create: m.userCreate, update: m.userUpdate, delete: m.userDelete },
    Account: { first: m.accountFirst, create: m.accountCreate },
    VerificationToken: { consumeByIdentifierAndToken: m.consumeToken },
}));
vi.mock('../bootstrap', () => ({
    bootstrapFirstUser: vi.fn(async () => ({ isPlatformOwner: false, organizationId: null })),
    provisionPlatformOwnerOrganization: vi.fn(),
}));
vi.mock('../providers/presets', () => ({ getConfiguredProvider: () => ({ id: 'github' }) }));
vi.mock('../providers/oauth-client', () => ({
    exchangeCodeForTokens: vi.fn(async () => ({ access_token: 'token' })),
    fetchUserProfile: m.fetchUserProfile,
    buildAuthorizationUrl: vi.fn(),
    createPkcePair: vi.fn(),
}));
vi.mock('../session-store', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../session-store')>()),
    createSessionCookieForUser: vi.fn(async () => ({ cookie: 'ottabase.session-token=s', session: {} })),
}));

const { handleAuthRequest } = await import('../backend-handler');

const env = { AUTH_SECRET: 'test-secret-at-least-32-chars-long!!', ENVIRONMENT: 'test', OBCF_D1: {} } as AuthEnv;
const row = (values: Record<string, unknown>) => ({
    get: (key: string) => values[key],
    imageUrl: () => (values.image as string | undefined) ?? null,
});

function options(): CreateAuthConfigOptions & { emit: ReturnType<typeof vi.fn> } {
    return { emit: vi.fn(async () => undefined) };
}

async function magicLink(opts: CreateAuthConfigOptions) {
    m.consumeToken.mockResolvedValue(row({ expires: Date.now() + 60_000 }));
    return handleAuthRequest(
        new Request('https://app.example.com/api/auth/callback/email?token=t&email=Ada@Example.com'),
        env,
        opts,
    );
}

async function oauth(opts: CreateAuthConfigOptions) {
    const state = await signJwt(
        { state: 's', codeVerifier: 'v', callbackUrl: '/', providerId: 'github', purpose: 'oauth-state' },
        env.AUTH_SECRET!,
        { expiresInSeconds: 600 },
    );
    return handleAuthRequest(
        new Request('https://app.example.com/api/auth/callback/github?code=c&state=s', {
            headers: { Cookie: `ottabase.oauth-state=${state}` },
        }),
        env,
        opts,
    );
}

describe('account events', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        m.userCreate.mockImplementation(async (data: Record<string, unknown>) => row({ id: 'user-1', ...data }));
        m.fetchUserProfile.mockResolvedValue({
            providerAccountId: 'gh-1',
            email: 'ada@example.com',
            name: 'Ada',
            image: null,
            emailVerified: true,
        });
    });

    it('a magic link that creates an account announces it created and verified, once', async () => {
        m.userFirst.mockResolvedValue(null);
        const opts = options();

        expect((await magicLink(opts)).status).toBe(302);

        const verifiedAt = m.userCreate.mock.calls[0][0].emailVerified;
        expect(opts.emit.mock.calls).toEqual([
            [
                env,
                'user.created',
                {
                    userId: 'user-1',
                    email: 'ada@example.com',
                    name: null,
                    organizationId: null,
                    method: 'magic-link',
                    at: expect.any(Number),
                },
            ],
            [env, 'user.verified', { userId: 'user-1', email: 'ada@example.com', at: verifiedAt }],
        ]);
    });

    it('a magic link verifies an unverified account, and says nothing for a verified one', async () => {
        const opts = options();
        m.userFirst.mockResolvedValue(row({ id: 'user-1', emailVerified: null }));
        await magicLink(opts);
        expect(opts.emit.mock.calls.map(([, name]) => name)).toEqual(['user.verified']);
        expect(opts.emit.mock.calls[0][2].at).toBe(m.userUpdate.mock.calls[0][1].emailVerified);

        opts.emit.mockClear();
        m.userFirst.mockResolvedValue(row({ id: 'user-1', emailVerified: 1_700_000_000_000 }));
        await magicLink(opts);
        expect(opts.emit).not.toHaveBeenCalled();
        expect(m.userUpdate).toHaveBeenCalledTimes(1);
    });

    it('a first OAuth sign-in announces the account, and its verification only when the provider vouches', async () => {
        m.accountFirst.mockResolvedValue(null);
        m.userFirst.mockResolvedValue(null);
        const opts = options();
        await oauth(opts);
        expect(opts.emit.mock.calls.map(([, name, payload]) => [name, payload.method ?? null])).toEqual([
            ['user.created', 'oauth'],
            ['user.verified', null],
        ]);
        expect(opts.emit.mock.calls[0][2]).toMatchObject({ name: 'Ada', organizationId: null });

        opts.emit.mockClear();
        m.fetchUserProfile.mockResolvedValue({ providerAccountId: 'gh-2', email: 'b@example.com', name: 'B' });
        await oauth(opts);
        expect(opts.emit.mock.calls.map(([, name]) => name)).toEqual(['user.created']);
    });

    it('a returning OAuth account is verified once, when the provider first vouches', async () => {
        m.accountFirst.mockResolvedValue(row({ userId: 'user-1' }));
        m.userFind.mockResolvedValue(row({ id: 'user-1', email: 'ada@example.com', emailVerified: null }));
        const opts = options();
        await oauth(opts);
        expect(opts.emit.mock.calls).toEqual([
            [env, 'user.verified', { userId: 'user-1', email: 'ada@example.com', at: expect.any(Number) }],
        ]);

        opts.emit.mockClear();
        m.userFind.mockResolvedValue(row({ id: 'user-1', email: 'ada@example.com', emailVerified: 1 }));
        await oauth(opts);
        expect(opts.emit).not.toHaveBeenCalled();
    });

    it('announces nothing for an OAuth account rolled back, and a broken listener never fails a sign-in', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        m.accountFirst.mockResolvedValue(null);
        m.userFirst.mockResolvedValue(null);
        m.accountCreate.mockRejectedValueOnce(new Error('insert failed'));
        const opts = options();
        expect((await oauth(opts)).headers.get('Location')).toContain('notice=auth.oauth-callback');
        expect(m.userDelete).toHaveBeenCalledWith('user-1');
        expect(opts.emit).not.toHaveBeenCalled();

        opts.emit.mockRejectedValue(new Error('listener down'));
        const response = await oauth(opts);
        expect(response.headers.get('Location')).toBe('http://127.0.0.1:3003/');
        expect(opts.emit).toHaveBeenCalledTimes(2);
    });
});
