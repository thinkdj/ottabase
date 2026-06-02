import { afterEach, describe, expect, it } from 'vitest';
import { definePlans, registerPlans, resolvePlanBySlug } from '../core/plans';
import { clearEventBus, emit, on } from '../core/events';
import type { PayportEvent } from '../types';

describe('plan catalog', () => {
    afterEach(() => registerPlans({}));

    it('registers plans and resolves by slug', () => {
        const plans = definePlans({
            free: { slug: 'free', name: 'Free', providerProductIds: {}, features: [] },
            pro: { slug: 'pro', name: 'Pro', providerProductIds: { polar: 'prod_123' }, features: ['ai'] },
        });
        registerPlans(plans);
        expect(resolvePlanBySlug('pro')?.providerProductIds.polar).toBe('prod_123');
        expect(resolvePlanBySlug('unknown')).toBeNull();
    });
});

describe('event bus', () => {
    afterEach(() => clearEventBus());

    it('dispatches typed events and wildcard listeners', async () => {
        const received: string[] = [];
        on('payment.subscription.activated', (e) => {
            received.push(`typed:${e.type}`);
        });
        on('*', (e) => {
            received.push(`star:${e.type}`);
        });

        const event: PayportEvent = {
            type: 'payment.subscription.activated',
            provider: 'polar',
            externalEventId: 'evt_1',
            data: {},
            occurredAt: new Date(),
        };
        await emit(event);

        expect(received).toContain('typed:payment.subscription.activated');
        expect(received).toContain('star:payment.subscription.activated');
    });

    it('swallows listener errors without breaking other listeners', async () => {
        let secondCalled = false;
        on('payment.checkout.completed', () => {
            throw new Error('boom');
        });
        on('payment.checkout.completed', () => {
            secondCalled = true;
        });

        await emit({
            type: 'payment.checkout.completed',
            provider: 'polar',
            externalEventId: 'evt_2',
            data: {},
            occurredAt: new Date(),
        });
        expect(secondCalled).toBe(true);
    });
});
