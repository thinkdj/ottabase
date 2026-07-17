import { describe, expect, it } from 'vitest';
import { parseCookies } from '../cookies';
import { signJwt } from '../jwt';
import {
    createSessionCookieForUser,
    createSessionForUser,
    getSession,
    resolveAuthSecret,
    resolveSessionCookieName,
    resolveSessionMaxAge,
    revokeAllUserSessions,
    revokeSession,
    SESSION_COOKIE_BASE,
} from '../session-store';
import type { AuthEnv } from '../types';

const TEST_SECRET = 'test-secret-at-least-32-chars-long!!';

/** Minimal in-memory KVNamespace stand-in -- just enough of the surface `session-store.ts` uses. */
function createFakeKv() {
    const store = new Map<string, string>();
    return {
        store,
        async get(key: string) {
            return store.get(key) ?? null;
        },
        async put(key: string, value: string) {
            store.set(key, value);
        },
        async delete(key: string) {
            store.delete(key);
        },
    } as any;
}

function createEnv(overrides: Partial<AuthEnv> = {}): AuthEnv {
    return {
        AUTH_SECRET: TEST_SECRET,
        ENVIRONMENT: 'test',
        OBCF_KV: createFakeKv(),
        ...overrides,
    } as AuthEnv;
}

function cookieHeaderRequest(cookieHeader: string) {
    return new Request('https://app.example.com/api/auth/session', { headers: { Cookie: cookieHeader } });
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('resolveAuthSecret', () => {
    it('returns the configured secret', () => {
        expect(resolveAuthSecret(createEnv({ AUTH_SECRET: 'a-sufficiently-long-secret-value' }))).toBe(
            'a-sufficiently-long-secret-value',
        );
    });

    it('rejects a too-short secret', () => {
        expect(() => resolveAuthSecret(createEnv({ AUTH_SECRET: 'short' }))).toThrow(/too short/);
    });

    it('uses the insecure default ONLY with a dev env AND the explicit opt-in flag', () => {
        expect(
            resolveAuthSecret(
                createEnv({
                    AUTH_SECRET: undefined,
                    ENVIRONMENT: 'development',
                    AUTH_ALLOW_INSECURE_DEV_SECRET: 'true',
                }),
            ),
        ).toBe('dev-secret-change-in-production');
    });

    it('fails closed when the opt-in flag is absent even in a dev env', () => {
        expect(() => resolveAuthSecret(createEnv({ AUTH_SECRET: undefined, ENVIRONMENT: 'development' }))).toThrow(
            /AUTH_SECRET is required/,
        );
    });

    it('fails closed when ENVIRONMENT is unset (treated as production)', () => {
        expect(() =>
            resolveAuthSecret(
                createEnv({ AUTH_SECRET: undefined, ENVIRONMENT: undefined, AUTH_ALLOW_INSECURE_DEV_SECRET: 'true' }),
            ),
        ).toThrow(/AUTH_SECRET is required/);
    });

    it('throws when missing in production', () => {
        expect(() => resolveAuthSecret(createEnv({ AUTH_SECRET: undefined, ENVIRONMENT: 'production' }))).toThrow(
            /AUTH_SECRET is required/,
        );
    });
});

describe('resolveSessionMaxAge', () => {
    it('defaults to 30 days', () => {
        expect(resolveSessionMaxAge(createEnv())).toBe(30 * 24 * 60 * 60);
    });

    it('honors an explicit option over the environment', () => {
        expect(resolveSessionMaxAge(createEnv({ AUTH_SESSION_MAX_AGE: '3600' }), { sessionMaxAge: 60 })).toBe(60);
    });

    it('falls back to AUTH_SESSION_MAX_AGE when no option is given', () => {
        expect(resolveSessionMaxAge(createEnv({ AUTH_SESSION_MAX_AGE: '3600' }))).toBe(3600);
    });
});

describe('cookie name hardening', () => {
    it('uses no prefix in a dev/test environment', () => {
        expect(resolveSessionCookieName(createEnv({ ENVIRONMENT: 'test' }))).toBe(SESSION_COOKIE_BASE);
    });

    it('applies the __Host- prefix in production', () => {
        expect(resolveSessionCookieName(createEnv({ ENVIRONMENT: 'production' }))).toBe(
            `__Host-${SESSION_COOKIE_BASE}`,
        );
    });

    it('honors a custom cookie name from AUTH_COOKIE_NAME', () => {
        expect(resolveSessionCookieName(createEnv({ AUTH_COOKIE_NAME: 'my-app.session' }))).toBe('my-app.session');
    });
});

describe('createSessionForUser + getSession round-trip', () => {
    it('carries org/roles/permissions via the KV snapshot, not the cookie', async () => {
        const env = createEnv();
        const created = await createSessionForUser(
            {
                id: 'user-1',
                email: 'user@example.com',
                name: 'User One',
                organizationId: 'org-1',
                roles: ['owner'],
                permissions: ['*:*'],
            },
            env,
        );

        expect(created.user.roles).toEqual(['owner']);
        // The heavy claims must NOT be embedded in the cookie JWT (4KB cap protection).
        const jwtPayload = JSON.parse(atob(created.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        expect(jwtPayload.permissions).toBeUndefined();
        expect(jwtPayload.roles).toBeUndefined();

        const request = cookieHeaderRequest(`${SESSION_COOKIE_BASE}=${created.token}`);
        const session = await getSession(request, env);

        expect(session?.user.id).toBe('user-1');
        expect(session?.user.email).toBe('user@example.com');
        expect(session?.user.roles).toEqual(['owner']);
        expect(session?.user.permissions).toEqual(['*:*']);
        expect(session?.user.organizationId).toBe('org-1');
        // Fast path (explicit roles/permissions) can't infer scope, so platformAdmin is false —
        // a merged '*:*' here does NOT imply a system-scoped platform grant. Platform-admin
        // sessions omit explicit roles/permissions and derive it via loadUserContext.
        expect(session?.user.platformAdmin).toBe(false);
    });

    it('reflects a profile edit via the refreshed KV snapshot, not the stale JWT copy', async () => {
        const env = createEnv();
        const created = await createSessionForUser(
            { id: 'user-1', email: 'u@e.com', name: 'Old Name', organizationId: null, roles: [], permissions: [] },
            env,
        );

        // The cookie JWT still carries the name captured at issue time...
        const jwtPayload = JSON.parse(atob(created.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        expect(jwtPayload.name).toBe('Old Name');

        // ...but a profile edit rewrites the KV registry snapshot (same profile version) with the new
        // name. Simulate that by overwriting the single registry record in the fake KV.
        const store = (env.OBCF_KV as any).store as Map<string, string>;
        const entry = [...store.entries()].find(([, value]) => value.includes('"roles"'));
        const [registryKey, registryRaw] = entry!;
        const snapshot = JSON.parse(registryRaw);
        snapshot.name = 'New Name';
        store.set(registryKey, JSON.stringify(snapshot));

        const request = cookieHeaderRequest(`${SESSION_COOKIE_BASE}=${created.token}`);
        const session = await getSession(request, env);

        // getSession MUST prefer the snapshot's fresh name over the JWT's stale copy, so a profile
        // edit reflects everywhere (e.g. the top-right user name) without re-issuing the cookie.
        expect(session?.user.name).toBe('New Name');
    });

    it('returns null when there is no session cookie', async () => {
        const request = new Request('https://app.example.com/api/auth/session');
        await expect(getSession(request, createEnv())).resolves.toBeNull();
    });

    it('returns null for a token signed with a different secret', async () => {
        const env = createEnv({ AUTH_SECRET: 'secret-a-least-32-characters-long!!' });
        const created = await createSessionForUser(
            { id: 'user-1', email: 'u@e.com', organizationId: null, roles: [], permissions: [] },
            env,
        );
        const otherEnv = createEnv({ AUTH_SECRET: 'secret-b-least-32-characters-long!!', OBCF_KV: env.OBCF_KV });
        const request = cookieHeaderRequest(`${SESSION_COOKIE_BASE}=${created.token}`);
        await expect(getSession(request, otherEnv)).resolves.toBeNull();
    });
});

describe('KV eventual-consistency grace window', () => {
    it('tolerates a missing registry record for a freshly-issued session (self-heal window)', async () => {
        const env = createEnv();
        const created = await createSessionForUser(
            { id: 'user-1', email: 'u@e.com', organizationId: null, roles: [], permissions: [] },
            env,
        );

        // Simulate the registry write not having propagated to this colo yet.
        (env.OBCF_KV as any).store.clear();

        const request = cookieHeaderRequest(`${SESSION_COOKIE_BASE}=${created.token}`);
        // Within grace + no D1 to self-heal from -> still a valid session built from the JWT identity.
        await expect(getSession(request, env)).resolves.not.toBeNull();
    });

    it('rejects a session past the grace window whose registry record is gone', async () => {
        const env = createEnv();
        // Hand-sign a token with an old iat (issued ~10 minutes ago), no registry record.
        const oldIat = Math.floor(Date.now() / 1000) - 600;
        const token = await signJwt({ sub: 'user-1', jti: 'jti-old', email: 'u@e.com', iat: oldIat }, TEST_SECRET, {
            expiresInSeconds: 3600,
        });
        const request = cookieHeaderRequest(`${SESSION_COOKIE_BASE}=${token}`);
        await expect(getSession(request, env)).resolves.toBeNull();
    });
});

describe('session revocation', () => {
    it('revokeSession invalidates only that session (per-jti tombstone)', async () => {
        const env = createEnv();
        const a = await createSessionForUser(
            { id: 'user-1', email: 'u@e.com', organizationId: null, roles: [], permissions: [] },
            env,
        );
        const b = await createSessionForUser(
            { id: 'user-1', email: 'u@e.com', organizationId: null, roles: [], permissions: [] },
            env,
        );

        await revokeSession('user-1', a.jti, env);

        await expect(getSession(cookieHeaderRequest(`${SESSION_COOKIE_BASE}=${a.token}`), env)).resolves.toBeNull();
        await expect(getSession(cookieHeaderRequest(`${SESSION_COOKIE_BASE}=${b.token}`), env)).resolves.not.toBeNull();
    });

    it('the sign-out tombstone wins even inside the grace window', async () => {
        const env = createEnv();
        const a = await createSessionForUser(
            { id: 'user-1', email: 'u@e.com', organizationId: null, roles: [], permissions: [] },
            env,
        );
        await revokeSession('user-1', a.jti, env); // deletes registry, writes tombstone
        // Freshly issued + registry gone would normally be tolerated by the grace window,
        // but the tombstone must still reject it.
        await expect(getSession(cookieHeaderRequest(`${SESSION_COOKIE_BASE}=${a.token}`), env)).resolves.toBeNull();
    });

    it('revokeAllUserSessions invalidates sessions issued before the call', async () => {
        const env = createEnv();
        const session = await createSessionForUser(
            { id: 'user-1', email: 'u@e.com', organizationId: null, roles: [], permissions: [] },
            env,
        );
        await delay(3); // ensure the revoke timestamp is strictly after creation
        await revokeAllUserSessions('user-1', env);
        await expect(
            getSession(cookieHeaderRequest(`${SESSION_COOKIE_BASE}=${session.token}`), env),
        ).resolves.toBeNull();
    });

    it('a session reissued after revoke-all survives (ms granularity, strict comparison)', async () => {
        const env = createEnv();
        await revokeAllUserSessions('user-1', env);
        await delay(3);
        const reissued = await createSessionForUser(
            { id: 'user-1', email: 'u@e.com', organizationId: null, roles: [], permissions: [] },
            env,
        );
        await expect(
            getSession(cookieHeaderRequest(`${SESSION_COOKIE_BASE}=${reissued.token}`), env),
        ).resolves.not.toBeNull();
    });

    it('fails closed when OBCF_KV is not bound', async () => {
        const env = createEnv();
        const session = await createSessionForUser(
            { id: 'user-1', email: 'u@e.com', organizationId: null, roles: [], permissions: [] },
            env,
        );
        const envWithoutKv = createEnv({ OBCF_KV: undefined });
        await expect(
            getSession(cookieHeaderRequest(`${SESSION_COOKIE_BASE}=${session.token}`), envWithoutKv),
        ).resolves.toBeNull();
    });

    it('fails closed when the KV read throws', async () => {
        const env = createEnv();
        const session = await createSessionForUser(
            { id: 'user-1', email: 'u@e.com', organizationId: null, roles: [], permissions: [] },
            env,
        );
        const throwingKv = {
            get: async () => {
                throw new Error('KV outage');
            },
            put: async () => {},
            delete: async () => {},
        };
        const flakyEnv = createEnv({ OBCF_KV: throwingKv as any });
        await expect(
            getSession(cookieHeaderRequest(`${SESSION_COOKIE_BASE}=${session.token}`), flakyEnv),
        ).resolves.toBeNull();
    });
});

describe('createSessionCookieForUser', () => {
    it('builds a Set-Cookie with the token and security flags over https', async () => {
        const env = createEnv();
        const { cookie } = await createSessionCookieForUser(
            { id: 'user-1', email: 'u@e.com', organizationId: null, roles: [], permissions: [] },
            env,
            new Request('https://app.example.com/'),
        );
        expect(cookie).toContain(`${SESSION_COOKIE_BASE}=`);
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('Secure');
        expect(cookie).toContain('SameSite=Lax');

        const token = cookie.split('=')[1].split(';')[0];
        expect(parseCookies(`${SESSION_COOKIE_BASE}=${token}`)[SESSION_COOKIE_BASE]).toBe(token);
    });

    it('omits Secure over a plain-http request in a dev env', async () => {
        const env = createEnv();
        const { cookie } = await createSessionCookieForUser(
            { id: 'user-1', email: 'u@e.com', organizationId: null, roles: [], permissions: [] },
            env,
            new Request('http://localhost:3004/'),
        );
        expect(cookie).not.toContain('Secure');
    });

    it('forces Secure in production even over a plain-http (proxied) request', async () => {
        const env = createEnv({ ENVIRONMENT: 'production' });
        const { cookie } = await createSessionCookieForUser(
            { id: 'user-1', email: 'u@e.com', organizationId: null, roles: [], permissions: [] },
            env,
            new Request('http://internal/'),
        );
        expect(cookie).toContain('Secure');
        expect(cookie).toContain(`__Host-${SESSION_COOKIE_BASE}=`);
    });
});
