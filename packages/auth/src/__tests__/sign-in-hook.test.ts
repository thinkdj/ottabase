import { describe, expect, it, vi } from 'vitest';
import type { AuthEnv } from '../types';

// First-user bootstrap is covered in bootstrap.test.ts; here it always succeeds, so the only
// thing deciding the outcome is the app's onSignIn hook.
vi.mock('../bootstrap', () => ({
    bootstrapFirstUser: vi.fn(async () => ({ isPlatformOwner: false, organizationId: null })),
    provisionPlatformOwnerOrganization: vi.fn(),
}));

const { handleAuthRequest } = await import('../backend-handler');

function createEnv(): AuthEnv {
    return {
        AUTH_SECRET: 'test-secret-at-least-32-chars-long!!',
        ENVIRONMENT: 'test',
        OBCF_D1: {} as any,
    } as AuthEnv;
}

function request(path: string, init?: RequestInit) {
    return new Request(`https://app.example.com${path}`, init);
}

async function signIn(onSignIn: () => Promise<void>) {
    const env = createEnv();
    const csrf = await handleAuthRequest(request('/api/auth/csrf'), env);
    const token = (await csrf.json()).csrfToken as string;
    const cookie = (csrf.headers.get('Set-Cookie') || '').split(';')[0];

    return handleAuthRequest(
        request('/api/auth/callback/credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'https://app.example.com' },
            body: JSON.stringify({ email: 'new@example.com', password: 'irrelevant', csrfToken: token }),
        }),
        env,
        {
            authorize: async () => ({ id: 'user-1', email: 'new@example.com', name: 'New' }),
            onSignIn,
        },
    );
}

describe('onSignIn hook', () => {
    it('refuses the sign-in, issuing no session, when the hook throws', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const response = await signIn(async () => {
            throw new Error('workspace provisioning failed');
        });

        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({ code: 'ACCOUNT_PROVISIONING_FAILED' });
        expect(response.headers.get('Set-Cookie')).toBeNull();
    });

    it('hands the hook the signed-in user', async () => {
        const onSignIn = vi.fn(async () => undefined);
        // Session issuance needs KV, which this env leaves out; the hook runs before it either way.
        await signIn(onSignIn).catch(() => undefined);

        expect(onSignIn).toHaveBeenCalledWith({ userId: 'user-1', email: 'new@example.com' });
    });
});
