import { describe, expect, it } from 'vitest';
import { getSession, handleAuthRequest, hashPassword, verifyPassword } from '../backend-handler';
import type { AuthEnv } from '../types';

function createFakeD1() {
    // None of the routes exercised in this file (csrf/session/404/missing-binding) need real
    // query results -- a truthy placeholder is enough to get past the `env.OBCF_D1` guard.
    return {} as any;
}

function createEnv(overrides: Partial<AuthEnv> = {}): AuthEnv {
    return {
        AUTH_SECRET: 'test-secret-at-least-32-chars-long!!',
        ENVIRONMENT: 'test',
        OBCF_D1: createFakeD1(),
        ...overrides,
    } as AuthEnv;
}

function request(path: string, init?: RequestInit) {
    return new Request(`https://app.example.com${path}`, init);
}

describe('handleAuthRequest', () => {
    it('marks every auth response as non-cacheable', async () => {
        const env = createEnv();
        const response = await handleAuthRequest(request('/api/auth/session'), env);

        expect(response.headers.get('cache-control')).toBe('no-store, private');
        expect(response.headers.get('pragma')).toBe('no-cache');
        expect(response.headers.get('expires')).toBe('0');
    });

    it('returns 500 when the D1 binding is missing', async () => {
        const env = createEnv({ OBCF_D1: undefined });
        const response = await handleAuthRequest(request('/api/auth/session'), env);
        expect(response.status).toBe(500);
    });

    it('returns 404 for an unknown auth sub-route', async () => {
        const env = createEnv();
        const response = await handleAuthRequest(request('/api/auth/nope'), env);
        expect(response.status).toBe(404);
    });

    it('issues a CSRF token with a paired Set-Cookie header', async () => {
        const env = createEnv();
        const response = await handleAuthRequest(request('/api/auth/csrf'), env);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(typeof body.csrfToken).toBe('string');
        expect(body.csrfToken.length).toBeGreaterThan(0);

        const setCookie = response.headers.get('Set-Cookie');
        expect(setCookie).toContain('ottabase.csrf-token=');
        expect(setCookie).toContain('HttpOnly');
    });

    it('returns null for /session when there is no session cookie', async () => {
        const env = createEnv();
        const response = await handleAuthRequest(request('/api/auth/session'), env);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toBeNull();
    });

    it('rejects a credentials sign-in with a missing/invalid CSRF token', async () => {
        const env = createEnv();
        const response = await handleAuthRequest(
            request('/api/auth/callback/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com', password: 'whatever', csrfToken: 'guessed' }),
            }),
            env,
        );

        expect(response.status).toBe(403);
    });

    it('rejects credentials sign-in outright when credentials are disabled', async () => {
        const env = createEnv();
        const response = await handleAuthRequest(
            request('/api/auth/callback/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com', password: 'whatever' }),
            }),
            env,
            { disableCredentials: true },
        );

        expect(response.status).toBe(403);
    });

    it('redirects unknown/unconfigured OAuth providers to the error page', async () => {
        const env = createEnv();
        const response = await handleAuthRequest(request('/api/auth/signin/not-a-real-provider'), env);

        expect(response.status).toBe(302);
        const location = response.headers.get('Location');
        expect(location).toContain('/login');
        expect(location).toContain('error=OAuthSignin');
    });

    // --- CSRF + Origin backstop -------------------------------------------------------
    async function getCsrf(env: AuthEnv) {
        const res = await handleAuthRequest(request('/api/auth/csrf'), env);
        const token = (await res.json()).csrfToken as string;
        const setCookie = res.headers.get('Set-Cookie') || '';
        const cookie = setCookie.split(';')[0]; // "ottabase.csrf-token=token.sig"
        return { token, cookie };
    }

    it('accepts a state-changing POST with a valid CSRF token + same-origin Origin', async () => {
        const env = createEnv();
        const { token, cookie } = await getCsrf(env);
        // /signout is CSRF-protected but touches no DB, so a valid token yields success.
        const res = await handleAuthRequest(
            request('/api/auth/signout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'https://app.example.com' },
                body: JSON.stringify({ csrfToken: token }),
            }),
            env,
        );
        expect(res.status).toBe(200);
    });

    it('rejects a state-changing POST whose Origin is not allowlisted, even with a valid CSRF token', async () => {
        const env = createEnv();
        const { token, cookie } = await getCsrf(env);
        const res = await handleAuthRequest(
            request('/api/auth/signout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'https://evil.example.com' },
                body: JSON.stringify({ csrfToken: token }),
            }),
            env,
        );
        expect(res.status).toBe(403);
    });

    it('rejects a state-changing POST with a mismatched CSRF token', async () => {
        const env = createEnv();
        const { cookie } = await getCsrf(env);
        const res = await handleAuthRequest(
            request('/api/auth/signout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'https://app.example.com' },
                body: JSON.stringify({ csrfToken: 'not-the-real-token' }),
            }),
            env,
        );
        expect(res.status).toBe(403);
    });
});

describe('re-exported crypto helpers', () => {
    it('hashPassword/verifyPassword round-trip through the backend entry point', async () => {
        const hash = await hashPassword('Sup3r$ecret!');
        await expect(verifyPassword('Sup3r$ecret!', hash)).resolves.toBe(true);
    });
});

describe('getSession re-export', () => {
    it('returns null without a session cookie', async () => {
        const env = createEnv();
        await expect(getSession(request('/api/auth/session'), env)).resolves.toBeNull();
    });
});
