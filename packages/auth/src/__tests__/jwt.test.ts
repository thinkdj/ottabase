import { describe, expect, it } from 'vitest';
import { signJwt, verifyJwt } from '../jwt';

describe('compact JWT (HS256)', () => {
    it('round-trips a payload', async () => {
        const token = await signJwt({ sub: 'user-1', role: 'owner' }, 'secret', { expiresInSeconds: 60 });
        const payload = await verifyJwt<{ sub: string; role: string; iat?: number; exp?: number }>(token, 'secret');

        expect(payload).not.toBeNull();
        expect(payload?.sub).toBe('user-1');
        expect(payload?.role).toBe('owner');
        expect(typeof payload?.iat).toBe('number');
        expect(typeof payload?.exp).toBe('number');
    });

    it('rejects a token verified with the wrong secret', async () => {
        const token = await signJwt({ sub: 'user-1' }, 'secret', { expiresInSeconds: 60 });
        await expect(verifyJwt(token, 'wrong-secret')).resolves.toBeNull();
    });

    it('rejects a token with a tampered payload', async () => {
        const token = await signJwt({ sub: 'user-1' }, 'secret', { expiresInSeconds: 60 });
        const [header, payload, signature] = token.split('.');
        const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'attacker' })).toString('base64url');
        const tampered = `${header}.${tamperedPayload}.${signature}`;

        await expect(verifyJwt(tampered, 'secret')).resolves.toBeNull();
    });

    it('rejects an expired token', async () => {
        const token = await signJwt({ sub: 'user-1' }, 'secret', { expiresInSeconds: -1 });
        await expect(verifyJwt(token, 'secret')).resolves.toBeNull();
    });

    it('rejects a header claiming a different algorithm ("alg confusion")', async () => {
        const token = await signJwt({ sub: 'user-1' }, 'secret', { expiresInSeconds: 60 });
        const [, payload, signature] = token.split('.');
        const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');

        await expect(verifyJwt(`${noneHeader}.${payload}.${signature}`, 'secret')).resolves.toBeNull();
    });

    it('rejects structurally malformed tokens without throwing', async () => {
        await expect(verifyJwt('', 'secret')).resolves.toBeNull();
        await expect(verifyJwt('not-a-jwt', 'secret')).resolves.toBeNull();
        await expect(verifyJwt('a.b.c.d', 'secret')).resolves.toBeNull();
        // @ts-expect-error -- deliberately passing a non-string to prove it's handled defensively
        await expect(verifyJwt(undefined, 'secret')).resolves.toBeNull();
    });
});
