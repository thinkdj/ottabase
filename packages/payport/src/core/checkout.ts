// ============================================================
// Payport — Checkout Service
// ============================================================

import { PaymentCheckout } from '../models';
import type { CreateCheckoutInput, CreateCheckoutResult, PaymentProviderName } from '../types';
import { ensureCustomer } from './customers';
import { resolvePlanBySlug } from './plans';
import { getProvider } from './registry';

export interface CreateCheckoutOptions extends CreateCheckoutInput {
    provider?: PaymentProviderName;
    /** Optional appId stamped onto the local checkout row for app-scoped reporting. */
    appId?: string;
}

export async function createCheckout(input: CreateCheckoutOptions): Promise<CreateCheckoutResult> {
    const provider = getProvider(input.provider);

    if (!resolvePlanBySlug(input.plan)) {
        throw new Error(`[payport] Unknown plan "${input.plan}". Did you register it with definePlans()?`);
    }

    // Best-effort: ensure a customer exists if the caller passed an email.
    if (input.email) {
        await ensureCustomer({
            userId: input.userId,
            email: input.email,
            metadata: input.metadata,
            provider: provider.name,
        });
    }

    // Resolve discount slug → provider-native id if a local catalog row exists.
    let resolvedDiscount = input.discount;
    if (resolvedDiscount) {
        const { resolveDiscount } = await import('./discounts');
        const discount = await resolveDiscount(resolvedDiscount, provider.name);
        if (discount) resolvedDiscount = discount.get('externalDiscountId') as string;
    }

    const result = await provider.createCheckout({ ...input, discount: resolvedDiscount });

    await PaymentCheckout.create({
        userId: input.userId,
        provider: provider.name,
        externalCheckoutId: result.externalCheckoutId,
        planSlug: input.plan,
        checkoutUrl: result.checkoutUrl,
        status: 'open',
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        metadata: input.metadata
            ? JSON.stringify({ ...input.metadata, ...(resolvedDiscount ? { payport_discount: resolvedDiscount } : {}) })
            : resolvedDiscount
              ? JSON.stringify({ payport_discount: resolvedDiscount })
              : null,
        appId: input.appId ?? null,
    });

    return result;
}
