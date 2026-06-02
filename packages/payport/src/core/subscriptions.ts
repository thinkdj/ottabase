// ============================================================
// Payport — Subscription Service
// ============================================================

import { PaymentSubscription } from '../models';
import type { CreateSubscriptionInput, PaymentProviderName, SubscriptionDTO } from '../types';
import { ProviderCapabilityError } from './capabilities';
import { resolveDiscount } from './discounts';
import { clearEntitlementsCache } from './entitlements';
import { getProvider } from './registry';

export async function getUserSubscription(
    userId: string,
    provider?: PaymentProviderName,
): Promise<SubscriptionDTO | null> {
    const record = await PaymentSubscription.activeForUser(userId);
    if (!record) return null;
    if (provider && (record.get('provider') as string) !== provider) return null;
    return toDTO(record);
}

export async function listUserSubscriptions(userId: string): Promise<SubscriptionDTO[]> {
    const rows = (await PaymentSubscription.where({ userId })) as PaymentSubscription[];
    return rows.map(toDTO);
}

export async function cancelSubscription(subscriptionId: string, immediate = false): Promise<SubscriptionDTO> {
    const record = (await PaymentSubscription.find(subscriptionId)) as PaymentSubscription | null;
    if (!record) throw new Error(`[payport] Subscription "${subscriptionId}" not found.`);

    const provider = getProvider(record.get('provider') as PaymentProviderName);
    const updated = await provider.cancelSubscription(record.get('externalSubscriptionId') as string, immediate);

    record.set('status', updated.status);
    record.set('cancelAtPeriodEnd', updated.cancelAtPeriodEnd ?? !immediate);
    await record.save();
    clearEntitlementsCache(record.get('userId') as string);
    return toDTO(record);
}

export async function resumeSubscription(subscriptionId: string): Promise<SubscriptionDTO> {
    const record = (await PaymentSubscription.find(subscriptionId)) as PaymentSubscription | null;
    if (!record) throw new Error(`[payport] Subscription "${subscriptionId}" not found.`);

    const provider = getProvider(record.get('provider') as PaymentProviderName);
    const updated = await provider.resumeSubscription(record.get('externalSubscriptionId') as string);

    record.set('status', updated.status);
    record.set('cancelAtPeriodEnd', updated.cancelAtPeriodEnd ?? false);
    await record.save();
    clearEntitlementsCache(record.get('userId') as string);
    return toDTO(record);
}

export async function changePlan(subscriptionId: string, newPlanSlug: string): Promise<SubscriptionDTO> {
    const record = (await PaymentSubscription.find(subscriptionId)) as PaymentSubscription | null;
    if (!record) throw new Error(`[payport] Subscription "${subscriptionId}" not found.`);

    const provider = getProvider(record.get('provider') as PaymentProviderName);
    const updated = await provider.updateSubscription({
        externalSubscriptionId: record.get('externalSubscriptionId') as string,
        newPlan: newPlanSlug,
    });

    record.set('planSlug', newPlanSlug);
    record.set('status', updated.status);
    await record.save();
    clearEntitlementsCache(record.get('userId') as string);
    return toDTO(record);
}

/**
 * Server-side subscription create. Useful for trial onboarding,
 * gifting, B2B contracts, or programmatic license issuance —
 * skips the hosted checkout entirely. Provider must implement
 * `createSubscription`.
 */
export async function createSubscriptionForUser(
    input: CreateSubscriptionInput & { provider?: PaymentProviderName; appId?: string },
): Promise<SubscriptionDTO> {
    const provider = getProvider(input.provider);
    if (!provider.createSubscription) throw new ProviderCapabilityError(provider.name, 'createSubscription');

    // Resolve discount slug → external id when possible.
    let resolvedDiscount = input.discount;
    if (resolvedDiscount) {
        const discount = await resolveDiscount(resolvedDiscount, provider.name);
        if (discount) resolvedDiscount = discount.get('externalDiscountId') as string;
    }

    const subscription = await provider.createSubscription({ ...input, discount: resolvedDiscount });

    const existing = await PaymentSubscription.findByExternal(provider.name, subscription.externalSubscriptionId);
    if (existing) {
        existing.set('status', subscription.status);
        existing.set('planSlug', subscription.planSlug);
        existing.set('currentPeriodStart', subscription.currentPeriodStart);
        existing.set('currentPeriodEnd', subscription.currentPeriodEnd);
        existing.set('cancelAtPeriodEnd', subscription.cancelAtPeriodEnd);
        existing.set('trialEndsAt', subscription.trialEndsAt);
        existing.set('metadata', subscription.metadata ? JSON.stringify(subscription.metadata) : null);
        await existing.save();
        return toDTO(existing);
    }

    const created = (await PaymentSubscription.create({
        userId: input.userId,
        provider: provider.name,
        externalSubscriptionId: subscription.externalSubscriptionId,
        planSlug: subscription.planSlug,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialEndsAt: subscription.trialEndsAt,
        appId: input.appId ?? null,
        metadata: subscription.metadata ? JSON.stringify(subscription.metadata) : null,
    })) as PaymentSubscription;

    return toDTO(created);
}

function toDTO(record: PaymentSubscription): SubscriptionDTO {
    const metadata = record.get('metadata') as string | null;
    return {
        id: record.get('id') as string,
        userId: record.get('userId') as string,
        provider: record.get('provider') as PaymentProviderName,
        externalSubscriptionId: record.get('externalSubscriptionId') as string,
        planId: record.get('planSlug') as string,
        planSlug: record.get('planSlug') as string,
        status: record.get('status') as SubscriptionDTO['status'],
        currentPeriodStart: (record.get('currentPeriodStart') as Date) ?? null,
        currentPeriodEnd: (record.get('currentPeriodEnd') as Date) ?? null,
        cancelAtPeriodEnd: (record.get('cancelAtPeriodEnd') as boolean) ?? false,
        trialEndsAt: (record.get('trialEndsAt') as Date | null) ?? null,
        metadata: metadata ? safeJson(metadata) : null,
    };
}

function safeJson(input: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(input);
        return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}
