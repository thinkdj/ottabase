import { describe, expect, it } from 'vitest';
import {
    base64UrlDecode,
    base64UrlEncode,
    getDummyPasswordHash,
    hashPassword,
    hashToken,
    hmacSign,
    hmacVerify,
    randomBytes,
    randomToken,
    sha256Base64Url,
    timingSafeEqual,
    timingSafeEqualString,
    verifyPassword,
} from '../crypto';

describe('password hashing (PBKDF2-SHA256)', () => {
    it('produces a hash in the expected format', async () => {
        const hash = await hashPassword('Sup3r$ecret!');
        const parts = hash.split('$');
        expect(parts).toHaveLength(4);
        expect(parts[0]).toBe('pbkdf2');
        expect(Number(parts[1])).toBeGreaterThanOrEqual(100_000);
    });

    it('verifies the correct password', async () => {
        const hash = await hashPassword('correct horse battery staple');
        await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
    });

    it('returns false (never throws) for malformed / corrupt hashes', async () => {
        await expect(verifyPassword('x', '')).resolves.toBe(false);
        await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
        await expect(verifyPassword('x', 'pbkdf2$100000$notbase64!!!$alsobad')).resolves.toBe(false);
        await expect(verifyPassword('x', 'pbkdf2$abc$AAAA$BBBB')).resolves.toBe(false); // non-numeric iterations
        await expect(verifyPassword('x', 'pbkdf2$999999999$AAAA$BBBB')).resolves.toBe(false); // over the 100k cap
        await expect(verifyPassword('x', 'pbkdf2$1.5$AAAA$BBBB')).resolves.toBe(false); // float iterations
    });

    it('provides a stable, valid dummy hash for timing equalization', async () => {
        const dummy = await getDummyPasswordHash();
        expect(dummy.startsWith('pbkdf2$')).toBe(true);
        // It is a real (always-failing) hash: verifying any password against it returns false, not throws.
        await expect(verifyPassword('anything', dummy)).resolves.toBe(false);
        // Memoized: same reference/value across calls.
        expect(await getDummyPasswordHash()).toBe(dummy);
    });

    it('rejects an incorrect password', async () => {
        const hash = await hashPassword('correct horse battery staple');
        await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
    });

    it('produces a different salt (and hash) on every call', async () => {
        const a = await hashPassword('same-password');
        const b = await hashPassword('same-password');
        expect(a).not.toBe(b);
    });

    it('rejects malformed or empty hashes without throwing', async () => {
        await expect(verifyPassword('x', '')).resolves.toBe(false);
        await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
        await expect(verifyPassword('x', 'pbkdf2$abc$def')).resolves.toBe(false);
        await expect(verifyPassword('x', 'bcrypt$10$somesalt$somehash')).resolves.toBe(false);
    });
});

describe('HMAC-SHA256', () => {
    it('produces a verifiable signature', async () => {
        const signature = await hmacSign('payload', 'secret');
        await expect(hmacVerify('payload', signature, 'secret')).resolves.toBe(true);
    });

    it('rejects a signature for tampered data', async () => {
        const signature = await hmacSign('payload', 'secret');
        await expect(hmacVerify('tampered-payload', signature, 'secret')).resolves.toBe(false);
    });

    it('rejects a signature verified with the wrong secret', async () => {
        const signature = await hmacSign('payload', 'secret');
        await expect(hmacVerify('payload', signature, 'wrong-secret')).resolves.toBe(false);
    });

    it('rejects garbage signatures without throwing', async () => {
        await expect(hmacVerify('payload', 'not-base64url!!!', 'secret')).resolves.toBe(false);
    });
});

describe('random values', () => {
    it('randomBytes returns the requested length', () => {
        expect(randomBytes(16)).toHaveLength(16);
        expect(randomBytes(32)).toHaveLength(32);
    });

    it('randomToken is url-safe and unique across calls', () => {
        const a = randomToken(24);
        const b = randomToken(24);
        expect(a).not.toBe(b);
        expect(a).not.toMatch(/[+/=]/);
    });
});

describe('base64url encoding', () => {
    it('round-trips arbitrary bytes', () => {
        const bytes = randomBytes(40);
        const encoded = base64UrlEncode(bytes);
        expect(encoded).not.toMatch(/[+/=]/);
        expect(base64UrlDecode(encoded)).toEqual(bytes);
    });
});

describe('sha256Base64Url', () => {
    it('is deterministic for the same input', async () => {
        const a = await sha256Base64Url('code-verifier');
        const b = await sha256Base64Url('code-verifier');
        expect(a).toBe(b);
    });

    it('differs for different input', async () => {
        const a = await sha256Base64Url('a');
        const b = await sha256Base64Url('b');
        expect(a).not.toBe(b);
    });
});

describe('hashToken', () => {
    it('is deterministic and URL-safe (for at-rest token hashing)', async () => {
        const a = await hashToken('verification-token-abc');
        const b = await hashToken('verification-token-abc');
        expect(a).toBe(b);
        expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('differs for different tokens', async () => {
        expect(await hashToken('token-a')).not.toBe(await hashToken('token-b'));
    });
});

describe('timingSafeEqual', () => {
    it('matches equal buffers', () => {
        const encoder = new TextEncoder();
        expect(timingSafeEqual(encoder.encode('abc'), encoder.encode('abc'))).toBe(true);
    });

    it('rejects buffers of different length or content', () => {
        const encoder = new TextEncoder();
        expect(timingSafeEqual(encoder.encode('abc'), encoder.encode('abcd'))).toBe(false);
        expect(timingSafeEqual(encoder.encode('abc'), encoder.encode('abd'))).toBe(false);
    });

    it('timingSafeEqualString mirrors the same semantics for strings', () => {
        expect(timingSafeEqualString('token', 'token')).toBe(true);
        expect(timingSafeEqualString('token', 'wrong')).toBe(false);
    });
});
