import { describe, expect, it } from 'vitest';
import { parseCookies } from '../cookies';
import {
    createSessionCookieForUser,
    createSessionForUser,
    getSession,
    resolveAuthSecret,
    resolveSessionCookieName,
    resolveSessionMaxAge,
    revokeAllUserSessions,
    revokeSession,
    SESSION_COOKIE_DEFAULT,
} from '../session-store';
import type { AuthEnv } from '../types';

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
        AUTH_SECRET: 'test-secret',
        ENVIRONMENT: 'test',
        OBCF_KV: createFakeKv(),
        ...overrides,
    } as AuthEnv;
}

function cookieHeaderRequest(cookieHeader: string) {
    return new Request('https://app.example.com/api/auth/session', { headers: { Cookie: cookieHeader } });
}

describe('resolveAuthSecret', () => {
    it('returns the configured secret', () => {
        expect(resolveAuthSecret(createEnv({ AUTH_SECRET: 'my-secret' }))).toBe('my-secret');
    });

    it('falls back to an insecure default outside production', () => {
        expect(resolveAuthSecret(createEnv({ AUTH_SECRET: undefined, ENVIRONMENT: 'development' }))).toBe(
            'dev-secret-change-in-production',
        );
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

describe('createSessionForUser + getSession round-trip', () => {
    it('creates a verifiable session carrying the provided org/roles/permissions', async () => {
        const env = createEnv();
        const created = await createSessionForUser(
            { id: 'user-1', email: 'user@example.com', name: 'User One', organizationId: 'org-1', roles: ['owner'], permissions: ['*:*'] },
            env,
        );

        expect(created.user.id).toBe('user-1');
        expect(created.user.organizationId).toBe('org-1');
        expect(created.user.roles).toEqual(['owner']);

        const request = cookieHeaderRequest(`${SESSION_COOKIE_DEFAULT}=${created.token}`);
        const session = await getSession(request, env);

        expect(session).not.toBeNull();
        expect(session?.user.id).toBe('user-1');
        expect(session?.user.email).toBe('user@example.com');
        expect(session?.user.roles).toEqual(['owner']);
    });

    it('returns null when there is no session cookie', async () => {
        const env = createEnv();
        const request = new Request('https://app.example.com/api/auth/session');
        await expect(getSession(request, env)).resolves.toBeNull();
    });

    it('returns null for a token signed with a different secret', async () => {
        const env = createEnv({ AUTH_SECRET: 'secret-a' });
        const created = await createSessionForUser(
            { id: 'user-1', email: 'user@example.com', organizationId: null, roles: [], permissions: [] },
            env,
        );

        const otherEnv = createEnv({ AUTH_SECRET: 'secret-b', OBCF_KV: env.OBCF_KV });
        const request = cookieHeaderRequest(`${SESSION_COOKIE_DEFAULT}=${created.token}`);
        await expect(getSession(request, otherEnv)).resolves.toBeNull();
    });

    it('honors a custom cookie name from AUTH_COOKIE_NAME', async () => {
        const env = createEnv({ AUTH_COOKIE_NAME: 'my-app.session' });
        const created = await createSessionForUser(
            { id: 'user-1', email: 'user@example.com', organizationId: null, roles: [], permissions: [] },
            env,
        );

        expect(resolveSessionCookieName(env)).toBe('my-app.session');
        const request = cookieHeaderRequest(`my-app.session=${created.token}`);
        await expect(getSession(request, env)).resolves.not.toBeNull();
    });
});

describe('session revocation', () => {
    it('revokeSession invalidates only that session, not other sessions for the same user', async () => {
        const env = createEnv();
        const sessionA = await createSessionForUser(
            { id: 'user-1', email: 'user@example.com', organizationId: null, roles: [], permissions: [] },
            env,
        );
        const sessionB = await createSessionForUser(
            { id: 'user-1', email: 'user@example.com', organizationId: null, roles: [], permissions: [] },
            env,
        );

        await revokeSession('user-1', sessionA.jti, env);

        const requestA = cookieHeaderRequest(`${SESSION_COOKIE_DEFAULT}=${sessionA.token}`);
        const requestB = cookieHeaderRequest(`${SESSION_COOKIE_DEFAULT}=${sessionB.token}`);

        await expect(getSession(requestA, env)).resolves.toBeNull();
        await expect(getSession(requestB, env)).resolves.not.toBeNull();
    });

    it('revokeAllUserSessions invalidates every session issued before the call', async () => {
        const env = createEnv();
        const session = await createSessionForUser(
            { id: 'user-1', email: 'user@example.com', organizationId: null, roles: [], permissions: [] },
            env,
        );

        await revokeAllUserSessions('user-1', env);

        const request = cookieHeaderRequest(`${SESSION_COOKIE_DEFAULT}=${session.token}`);
        await expect(getSession(request, env)).resolves.toBeNull();
    });

    it('fails closed (rejects the session) when OBCF_KV is not bound', async () => {
        const env = createEnv();
        const session = await createSessionForUser(
            { id: 'user-1', email: 'user@example.com', organizationId: null, roles: [], permissions: [] },
            env,
        );

        const envWithoutKv = createEnv({ OBCF_KV: undefined });
        const request = cookieHeaderRequest(`${SESSION_COOKIE_DEFAULT}=${session.token}`);
        await expect(getSession(request, envWithoutKv)).resolves.toBeNull();
    });

    it('fails closed (rejects the session) when the KV registry read throws', async () => {
        const env = createEnv();
        const session = await createSessionForUser(
            { id: 'user-1', email: 'user@example.com', organizationId: null, roles: [], permissions: [] },
            env,
        );

        const throwingKv = {
            ...env.OBCF_KV,
            get: async () => {
                throw new Error('KV outage');
            },
        };
        const flakyEnv = createEnv({ OBCF_KV: throwingKv as any });
        const request = cookieHeaderRequest(`${SESSION_COOKIE_DEFAULT}=${session.token}`);
        await expect(getSession(request, flakyEnv)).resolves.toBeNull();
    });
});

describe('createSessionCookieForUser', () => {
    it('builds a Set-Cookie string with the session token and security flags', async () => {
        const env = createEnv();
        const request = new Request('https://app.example.com/');
        const { cookie } = await createSessionCookieForUser(
            { id: 'user-1', email: 'user@example.com', organizationId: null, roles: [], permissions: [] },
            env,
            request,
        );

        expect(cookie).toContain(`${SESSION_COOKIE_DEFAULT}=`);
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('Secure');
        expect(cookie).toContain('SameSite=Lax');

        const [, tokenPart] = cookie.split('=');
        const token = tokenPart.split(';')[0];
        expect(parseCookies(`${SESSION_COOKIE_DEFAULT}=${token}`)[SESSION_COOKIE_DEFAULT]).toBe(token);
    });

    it('omits Secure over a plain-http request', async () => {
        const env = createEnv();
        const request = new Request('http://localhost:3004/');
        const { cookie } = await createSessionCookieForUser(
            { id: 'user-1', email: 'user@example.com', organizationId: null, roles: [], permissions: [] },
            env,
            request,
        );

        expect(cookie).not.toContain('Secure');
    });
});
