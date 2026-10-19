// ============================================================
// Signing — the only thing that lets a receiver trust a delivery.
// ============================================================

import { describe, expect, it } from 'vitest';
import { buildSignatureHeader, generateSigningSecret, signPayload, verifySignatureHeader } from '../signing';

const SECRET = 'whsec_test';
const BODY = JSON.stringify({ event: 'todo.created', data: { id: 1 } });
const NOW = 1_800_000_000;

describe('generateSigningSecret', () => {
    it('produces a recognisable, high-entropy secret', () => {
        const secret = generateSigningSecret();
        expect(secret).toMatch(/^whsec_[0-9a-f]{64}$/);
        expect(secret).not.toBe(generateSigningSecret());
    });
});

describe('signPayload', () => {
    it('is deterministic for the same secret, body and timestamp', async () => {
        const a = await signPayload(SECRET, BODY, NOW);
        const b = await signPayload(SECRET, BODY, NOW);
        expect(a).toBe(b);
        expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('changes when the timestamp changes — the binding that makes replay detectable', async () => {
        expect(await signPayload(SECRET, BODY, NOW)).not.toBe(await signPayload(SECRET, BODY, NOW + 1));
    });

    it('changes when the body changes', async () => {
        expect(await signPayload(SECRET, BODY, NOW)).not.toBe(await signPayload(SECRET, `${BODY} `, NOW));
    });

    it('changes when the secret changes', async () => {
        expect(await signPayload(SECRET, BODY, NOW)).not.toBe(await signPayload('whsec_other', BODY, NOW));
    });
});

describe('verifySignatureHeader', () => {
    it('accepts a signature it just produced', async () => {
        const header = await buildSignatureHeader(SECRET, BODY, NOW);
        await expect(verifySignatureHeader(SECRET, BODY, header, { now: NOW })).resolves.toBe(true);
    });

    it('rejects a signature made with a different secret', async () => {
        const header = await buildSignatureHeader('whsec_other', BODY, NOW);
        await expect(verifySignatureHeader(SECRET, BODY, header, { now: NOW })).resolves.toBe(false);
    });

    it('rejects a tampered body', async () => {
        const header = await buildSignatureHeader(SECRET, BODY, NOW);
        await expect(verifySignatureHeader(SECRET, '{"event":"admin.promote"}', header, { now: NOW })).resolves.toBe(
            false,
        );
    });

    it('rejects a replay outside the tolerance window', async () => {
        const header = await buildSignatureHeader(SECRET, BODY, NOW);
        await expect(verifySignatureHeader(SECRET, BODY, header, { now: NOW + 3600 })).resolves.toBe(false);
        await expect(verifySignatureHeader(SECRET, BODY, header, { now: NOW + 60 })).resolves.toBe(true);
    });

    it('rejects a forged timestamp — the signature covers it', async () => {
        const header = await buildSignatureHeader(SECRET, BODY, NOW);
        const forged = header.replace(`t=${NOW}`, `t=${NOW + 3000}`);
        await expect(verifySignatureHeader(SECRET, BODY, forged, { now: NOW + 3000 })).resolves.toBe(false);
    });

    it.each([
        ['missing', null],
        ['empty', ''],
        ['no v1', `t=${NOW}`],
        ['no timestamp', 'v1=abc'],
        ['garbage', 'not-a-signature'],
    ])('rejects a %s header without throwing', async (_label, header) => {
        await expect(verifySignatureHeader(SECRET, BODY, header, { now: NOW })).resolves.toBe(false);
    });
});
