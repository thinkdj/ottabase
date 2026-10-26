// ============================================================
// Signing: the only thing that lets a receiver trust a delivery.
//
// The HMAC scheme is tested where it lives (`@ottabase/utils/hmac-signature`). These pin
// what this package promises receivers: the header names, the secret prefix, and a round
// trip through the functions it exports.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
    DELIVERY_HEADER,
    EVENT_HEADER,
    SIGNATURE_HEADER,
    buildSignatureHeader,
    generateSigningSecret,
    verifySignatureHeader,
} from '../signing';

const NOW = 1_800_000_000;
const BODY = JSON.stringify({ event: 'todo.created', data: { id: 1 } });

describe('webhook signing', () => {
    it('keeps the header names receivers route on', () => {
        expect([SIGNATURE_HEADER, EVENT_HEADER, DELIVERY_HEADER]).toEqual([
            'X-Ottabase-Signature',
            'X-Ottabase-Event',
            'X-Ottabase-Delivery',
        ]);
    });

    it('issues whsec_ secrets', () => {
        expect(generateSigningSecret()).toMatch(/^whsec_[0-9a-f]{64}$/);
    });

    it('verifies its own signature and refuses a tampered body', async () => {
        const secret = generateSigningSecret();
        const header = await buildSignatureHeader(secret, BODY, NOW);
        await expect(verifySignatureHeader(secret, BODY, header, { now: NOW })).resolves.toBe(true);
        await expect(verifySignatureHeader(secret, `${BODY} `, header, { now: NOW })).resolves.toBe(false);
    });
});
