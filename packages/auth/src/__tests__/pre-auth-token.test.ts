import { describe, expect, it } from 'vitest';
import { signPreAuthToken, verifyPreAuthToken } from '../two-factor/pre-auth-token';

describe('pre-auth token', () => {
    it('round-trips valid payload', async () => {
        const env = { AUTH_SECRET: 'test-secret-key-for-unit-tests-only' };
        const token = await signPreAuthToken(env, { sub: 'user-1', email: 'a@b.com' });
        const payload = await verifyPreAuthToken(token, env);
        expect(payload?.sub).toBe('user-1');
        expect(payload?.email).toBe('a@b.com');
        expect(payload?.typ).toBe('2fa-ok');
    });

    it('rejects tampered token', async () => {
        const env = { AUTH_SECRET: 'test-secret-key-for-unit-tests-only' };
        const token = await signPreAuthToken(env, { sub: 'user-1', email: 'a@b.com' });
        const bad = token.slice(0, -4) + 'xxxx';
        expect(await verifyPreAuthToken(bad, env)).toBeNull();
    });
});
