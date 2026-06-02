import { afterEach, describe, expect, it } from 'vitest';
import { clearProviders, getProvider, listProviders, registerProvider, setActiveProvider } from '../core/registry';
import type { PaymentProvider } from '../provider';

function makeFakeProvider(name: PaymentProvider['name']): PaymentProvider {
    return {
        name,
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
            return { checkoutUrl: 'https://example.com', externalCheckoutId: 'co_1' };
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
            return { portalUrl: 'https://example.com' };
        },
        verifyWebhook() {},
        async handleWebhook() {
            return { externalEventId: 'x', events: [] };
        },
    };
}

describe('provider registry', () => {
    afterEach(() => clearProviders());

    it('uses the first registered provider as active by default', () => {
        registerProvider(makeFakeProvider('polar'));
        expect(getProvider().name).toBe('polar');
        expect(listProviders()).toEqual(['polar']);
    });

    it('throws when no provider is registered', () => {
        expect(() => getProvider()).toThrow(/No provider registered/);
    });

    it('allows switching active provider', () => {
        registerProvider(makeFakeProvider('polar'));
        registerProvider(makeFakeProvider('stripe'));
        setActiveProvider('stripe');
        expect(getProvider().name).toBe('stripe');
    });

    it('rejects activating an unknown provider', () => {
        registerProvider(makeFakeProvider('polar'));
        expect(() => setActiveProvider('stripe')).toThrow(/unknown provider/);
    });
});
