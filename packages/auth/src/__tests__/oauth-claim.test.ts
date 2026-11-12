/**
 * `oauthClaimsUnclaimedUsers`: an OAuth sign-in may take over an existing user row only when the
 * option is on, the provider verified the email, and nobody has claimed the row yet (no password,
 * no linked sign-in). Everything else keeps `OAuthAccountNotLinked`.
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
    fetchUserProfile: vi.fn(),
}));

vi.mock('@ottabase/ottaorm/models', () => ({
    User: { first: m.userFirst, find: m.userFind, create: m.userCreate, update: m.userUpdate, delete: m.userDelete },
    Account: { first: m.accountFirst, create: m.accountCreate },
    VerificationToken: { consumeByIdentifierAndToken: vi.fn() },
}));
vi.mock('../bootstrap', () => ({
    bootstrapFirstUser: vi.fn(async () => ({ isPlatformOwner: false, organizationId: null })),
    provisionPlatformOwnerOrganization: vi.fn(),
}));
vi.mock('../providers/presets', () => ({ getConfiguredProvider: () => ({ id: 'google' }) }));
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

async function oauth(opts: CreateAuthConfigOptions) {
    const state = await signJwt(
        { state: 's', codeVerifier: 'v', callbackUrl: '/', providerId: 'google', purpose: 'oauth-state' },
        env.AUTH_SECRET!,
        { expiresInSeconds: 600 },
    );
    return handleAuthRequest(
        new Request('https://app.example.com/api/auth/callback/google?code=c&state=s', {
            headers: { Cookie: `ottabase.oauth-state=${state}` },
        }),
        env,
        opts,
    );
}

const notLinked = (res: Response) => (res.headers.get('Location') ?? '').includes('oauth-account-not-linked');

describe('OAuth sign-in for an existing email', () => {
    let stub: Record<string, unknown>;
    let linkedAccount: unknown;

    beforeEach(() => {
        vi.clearAllMocks();
        stub = { id: 'stub-1', email: 'ada@example.com', name: 'ada', emailVerified: null, passwordHash: null };
        linkedAccount = null;
        m.userFirst.mockImplementation(async () => row(stub));
        // First lookup: this provider identity (never seen). Second: any sign-in linked to the user.
        m.accountFirst.mockImplementation(async (where: Record<string, unknown>) =>
            'userId' in where ? linkedAccount : null,
        );
        m.fetchUserProfile.mockResolvedValue({
            providerAccountId: 'g-1',
            email: 'ada@example.com',
            name: 'Ada Lovelace',
            image: null,
            emailVerified: true,
        });
    });

    it('is refused by default', async () => {
        const res = await oauth({});
        expect(notLinked(res)).toBe(true);
        expect(m.accountCreate).not.toHaveBeenCalled();
    });

    it('claims an unclaimed user when the option is on and the provider verified the email', async () => {
        const res = await oauth({ oauthClaimsUnclaimedUsers: true });

        expect(res.status).toBe(302);
        expect(notLinked(res)).toBe(false);
        expect(m.userCreate).not.toHaveBeenCalled();
        expect(m.accountCreate).toHaveBeenCalledWith({
            userId: 'stub-1',
            type: 'oauth',
            provider: 'google',
            providerAccountId: 'g-1',
        });
        expect(m.userUpdate).toHaveBeenCalledWith('stub-1', { emailVerified: expect.any(Number) });
    });

    it.each([
        ['the user has a password', () => (stub.passwordHash = 'hash')],
        ['the user already has a linked sign-in', () => (linkedAccount = row({ id: 'acc-1' }))],
        [
            'the provider did not verify the email',
            () =>
                m.fetchUserProfile.mockResolvedValue({
                    providerAccountId: 'g-1',
                    email: 'ada@example.com',
                    name: 'Ada',
                    image: null,
                    emailVerified: false,
                }),
        ],
    ])('is refused when %s', async (_label, arrange) => {
        arrange();
        const res = await oauth({ oauthClaimsUnclaimedUsers: true });
        expect(notLinked(res)).toBe(true);
        expect(m.accountCreate).not.toHaveBeenCalled();
    });
});
