import { describe, expect, it } from 'vitest';
import { PolarProvider } from '../providers/polar';

// Build a Standard-Webhooks compatible signature for testing.
async function sign(secret: string, id: string, timestamp: string, body: string) {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
    return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

describe('PolarProvider.verifyWebhook', () => {
    const secret = 'test-secret-1234567890';
    const provider = new PolarProvider({ accessToken: 'pk_test', webhookSecret: secret });

    it('accepts a valid signature', async () => {
        const id = 'msg_1';
        const timestamp = '1700000000';
        const body = JSON.stringify({ type: 'subscription.created', data: { id: 'sub_1' } });
        const sig = await sign(secret, id, timestamp, body);

        await expect(
            provider.verifyWebhook({
                rawBody: body,
                headers: {
                    'webhook-id': id,
                    'webhook-timestamp': timestamp,
                    'webhook-signature': `v1,${sig}`,
                },
            }),
        ).resolves.toBeUndefined();
    });

    it('rejects a bad signature', async () => {
        await expect(
            provider.verifyWebhook({
                rawBody: '{}',
                headers: {
                    'webhook-id': 'msg_x',
                    'webhook-timestamp': '1700000000',
                    'webhook-signature': 'v1,deadbeef',
                },
            }),
        ).rejects.toThrow(/Webhook signature mismatch/);
    });

    it('rejects when signature header is missing', async () => {
        await expect(
            provider.verifyWebhook({
                rawBody: '{}',
                headers: { 'webhook-id': 'm', 'webhook-timestamp': '1' },
            }),
        ).rejects.toThrow(/Missing webhook signature header/);
    });
});

describe('PolarProvider.handleWebhook', () => {
    const provider = new PolarProvider({ accessToken: 'x', webhookSecret: 's' });

    it('normalizes subscription.created to payment.subscription.created', async () => {
        const result = await provider.handleWebhook({
            rawBody: JSON.stringify({
                id: 'evt_123',
                type: 'subscription.created',
                data: { id: 'sub_abc', status: 'active', product_id: 'prod_x' },
            }),
            headers: { 'webhook-id': 'evt_123' },
        });
        expect(result.externalEventId).toBe('evt_123');
        expect(result.events[0]?.type).toBe('payment.subscription.created');
    });

    it('returns empty events for unmapped types', async () => {
        const result = await provider.handleWebhook({
            rawBody: JSON.stringify({ id: 'evt_999', type: 'totally.unknown', data: {} }),
            headers: { 'webhook-id': 'evt_999' },
        });
        expect(result.events).toHaveLength(0);
    });
});
