// ============================================================
// Stage 2 — Provider capability gating + new event mappings
// ============================================================
//
// Verifies that core services throw `ProviderCapabilityError`
// when the active adapter does not implement an optional
// capability (Meters, Refunds, Discounts, License Keys), and
// that the Polar event map covers the new advanced events.
// ============================================================

import { afterEach, describe, expect, it } from 'vitest';
import { ProviderCapabilityError } from '../core/capabilities';
import { createDiscount } from '../core/discounts';
import { validateLicenseKey } from '../core/licenses';
import { recordUsage } from '../core/meters';
import { createRefund } from '../core/refunds';
import { clearProviders, registerProvider } from '../core/registry';
import { createSubscriptionForUser } from '../core/subscriptions';
import type { PaymentProvider } from '../provider';
import { PolarProvider } from '../providers/polar';

// Minimal provider with NO optional capabilities — every advanced call must reject.
function makeBareProvider(): PaymentProvider {
    return {
        name: 'polar',
        capabilities: {},
        async createCustomer() {
            throw new Error('not implemented');
        },
        async getCustomer() {
            return null;
        },
        async listProducts() {
            return [];
        },
        async createCheckout() {
            return { checkoutUrl: '', externalCheckoutId: '' };
        },
        async getSubscription() {
            return null;
        },
        async updateSubscription() {
            throw new Error('nope');
        },
        async cancelSubscription() {
            throw new Error('nope');
        },
        async resumeSubscription() {
            throw new Error('nope');
        },
        async createBillingPortalSession() {
            return { portalUrl: '' };
        },
        verifyWebhook() {},
        async handleWebhook() {
            return { externalEventId: 'x', events: [] };
        },
    };
}

describe('provider capability gating', () => {
    afterEach(() => clearProviders());

    it('recordUsage rejects when provider lacks meter support', async () => {
        registerProvider(makeBareProvider());
        await expect(recordUsage({ userId: 'u_1', meter: 'tokens', value: 10 })).rejects.toBeInstanceOf(
            ProviderCapabilityError,
        );
    });

    it('createRefund rejects when provider lacks refund support', async () => {
        registerProvider(makeBareProvider());
        await expect(createRefund({ userId: 'u_1', orderId: 'ord_1' })).rejects.toBeInstanceOf(ProviderCapabilityError);
    });

    it('createDiscount rejects when provider lacks discount support', async () => {
        registerProvider(makeBareProvider());
        await expect(createDiscount({ name: 'Launch', type: 'percentage', amount: 1000 })).rejects.toBeInstanceOf(
            ProviderCapabilityError,
        );
    });

    it('validateLicenseKey rejects when provider lacks license support', async () => {
        registerProvider(makeBareProvider());
        await expect(validateLicenseKey({ key: 'XXXX-YYYY' })).rejects.toBeInstanceOf(ProviderCapabilityError);
    });

    it('createSubscriptionForUser rejects when provider lacks server-side sub creation', async () => {
        registerProvider(makeBareProvider());
        await expect(createSubscriptionForUser({ userId: 'u_1', plan: 'pro' })).rejects.toBeInstanceOf(
            ProviderCapabilityError,
        );
    });
});

describe('Polar adapter capability flags', () => {
    it('declares all advanced capabilities', () => {
        const provider = new PolarProvider({ accessToken: 'pk_test', webhookSecret: 's' });
        const caps = provider.capabilities ?? {};
        expect(caps.meters).toBe(true);
        expect(caps.refunds).toBe(true);
        expect(caps.discounts).toBe(true);
        expect(caps.licenseKeys).toBe(true);
        expect(caps.serverSideSubscriptions).toBe(true);
    });
});

describe('Polar adapter — new event mappings', () => {
    const provider = new PolarProvider({ accessToken: 'pk_test', webhookSecret: 's' });
    // Sign helper duplicated locally to avoid cross-file coupling.
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

    async function dispatch(eventType: string, data: Record<string, unknown>) {
        const id = `evt_${eventType.replace(/\./g, '_')}`;
        const ts = '1700000000';
        const body = JSON.stringify({ id, type: eventType, data });
        const sig = await sign('s', id, ts, body);
        return provider.handleWebhook({
            rawBody: body,
            headers: {
                'webhook-id': id,
                'webhook-timestamp': ts,
                'webhook-signature': `v1,${sig}`,
            },
        });
    }

    it('maps meter.created → payment.meter.created', async () => {
        const r = await dispatch('meter.created', { id: 'm_1', slug: 'tokens' });
        expect(r.events[0]?.type).toBe('payment.meter.created');
    });

    it('maps discount.created → payment.discount.created', async () => {
        const r = await dispatch('discount.created', { id: 'd_1', code: 'LAUNCH' });
        expect(r.events[0]?.type).toBe('payment.discount.created');
    });

    it('maps benefit_grant.created → payment.license_key.created', async () => {
        const r = await dispatch('benefit_grant.created', { id: 'bg_1', benefit_id: 'b_1' });
        expect(r.events[0]?.type).toBe('payment.license_key.created');
    });

    it('maps benefit_grant.revoked → payment.license_key.revoked', async () => {
        const r = await dispatch('benefit_grant.revoked', { id: 'bg_1' });
        expect(r.events[0]?.type).toBe('payment.license_key.revoked');
    });

    it('maps customer.state_changed → payment.customer.updated', async () => {
        const r = await dispatch('customer.state_changed', { id: 'c_1' });
        expect(r.events[0]?.type).toBe('payment.customer.updated');
    });
});
