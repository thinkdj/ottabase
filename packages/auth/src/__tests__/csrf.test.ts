import { describe, expect, it } from 'vitest';
import { createCsrfCookiePair, verifyCsrfToken } from '../csrf';

describe('CSRF double-submit cookie', () => {
    it('accepts a token that matches its signed cookie', async () => {
        const { token, cookieValue } = await createCsrfCookiePair('secret');
        await expect(verifyCsrfToken(cookieValue, token, 'secret')).resolves.toBe(true);
    });

    it('rejects when the submitted token does not match the cookie', async () => {
        const { cookieValue } = await createCsrfCookiePair('secret');
        await expect(verifyCsrfToken(cookieValue, 'attacker-guessed-token', 'secret')).resolves.toBe(false);
    });

    it('rejects a forged cookie signed with a different secret', async () => {
        const { token } = await createCsrfCookiePair('secret');
        const { cookieValue: forgedCookie } = await createCsrfCookiePair('attacker-secret');
        await expect(verifyCsrfToken(forgedCookie, token, 'secret')).resolves.toBe(false);
    });

    it('rejects missing cookie or token', async () => {
        const { token, cookieValue } = await createCsrfCookiePair('secret');
        await expect(verifyCsrfToken(undefined, token, 'secret')).resolves.toBe(false);
        await expect(verifyCsrfToken(cookieValue, undefined, 'secret')).resolves.toBe(false);
    });

    it('rejects a cookie value with no signature separator', async () => {
        await expect(verifyCsrfToken('just-a-token-no-signature', 'just-a-token-no-signature', 'secret')).resolves.toBe(
            false,
        );
    });
});
