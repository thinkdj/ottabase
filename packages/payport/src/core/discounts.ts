// ============================================================
// Payport — Discount Service
// ============================================================
//
// Provider-neutral discount/coupon catalog. Stores a local mirror
// for fast lookup + analytics; provider stays the source of truth.
// ============================================================

import { PaymentDiscount } from '../models';
import type { CreateDiscountInput, DiscountDTO, PaymentProviderName } from '../types';
import { ProviderCapabilityError } from './capabilities';
import { emit } from './events';
import { getProvider } from './registry';

export interface DiscountResolveContext {
    provider: PaymentProviderName;
}

/**
 * Resolve a user-supplied discount string (slug, code, or external id) to a
 * locally-mirrored discount row. Returns `null` when the value is unknown
 * locally — callers may still pass the raw string straight to the provider.
 */
export async function resolveDiscount(
    slugCodeOrId: string,
    provider: PaymentProviderName,
): Promise<PaymentDiscount | null> {
    const byId = await PaymentDiscount.findByExternal(provider, slugCodeOrId);
    if (byId) return byId;
    const byCode = await PaymentDiscount.findByCode(provider, slugCodeOrId);
    if (byCode) return byCode;
    const bySlug = await PaymentDiscount.where({ provider, slug: slugCodeOrId });
    return (bySlug[0] as PaymentDiscount | undefined) ?? null;
}

export async function listDiscounts(): Promise<DiscountDTO[]> {
    const provider = getProvider();
    if (!provider.listDiscounts) throw new ProviderCapabilityError(provider.name, 'listDiscounts');
    const remote = await provider.listDiscounts();
    // Best-effort: keep local mirror up to date
    await Promise.all(remote.map(upsertLocalDiscount));
    return remote;
}

export async function getDiscount(externalDiscountId: string): Promise<DiscountDTO | null> {
    const provider = getProvider();
    if (!provider.getDiscount) throw new ProviderCapabilityError(provider.name, 'getDiscount');
    const remote = await provider.getDiscount(externalDiscountId);
    if (remote) await upsertLocalDiscount(remote);
    return remote;
}

export async function createDiscount(input: CreateDiscountInput): Promise<DiscountDTO> {
    const provider = getProvider();
    if (!provider.createDiscount) throw new ProviderCapabilityError(provider.name, 'createDiscount');
    const created = await provider.createDiscount(input);
    await upsertLocalDiscount(created);
    await emit({
        type: 'payment.discount.created',
        provider: provider.name,
        externalEventId: `discount.created:${created.externalDiscountId}`,
        data: created,
        occurredAt: new Date(),
    });
    return created;
}

export async function deleteDiscount(externalDiscountId: string): Promise<void> {
    const provider = getProvider();
    if (!provider.deleteDiscount) throw new ProviderCapabilityError(provider.name, 'deleteDiscount');
    await provider.deleteDiscount(externalDiscountId);
    const local = await PaymentDiscount.findByExternal(provider.name, externalDiscountId);
    if (local) {
        local.set('active', false);
        await local.save();
    }
    await emit({
        type: 'payment.discount.revoked',
        provider: provider.name,
        externalEventId: `discount.revoked:${externalDiscountId}`,
        data: { externalDiscountId },
        occurredAt: new Date(),
    });
}

/** Upsert a provider DTO into the local mirror table. Idempotent. */
export async function upsertLocalDiscount(dto: DiscountDTO): Promise<PaymentDiscount> {
    const existing = await PaymentDiscount.findByExternal(dto.provider, dto.externalDiscountId);
    const fields = {
        code: dto.code ?? null,
        name: dto.name,
        type: dto.type,
        amount: dto.amount,
        currency: dto.currency ?? null,
        duration: dto.duration ?? null,
        durationInMonths: dto.durationInMonths ?? null,
        maxRedemptions: dto.maxRedemptions ?? null,
        redeemBy: dto.redeemBy ?? null,
        active: dto.active,
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
    };
    if (existing) {
        for (const [key, value] of Object.entries(fields)) existing.set(key, value);
        await existing.save();
        return existing;
    }
    const created = await PaymentDiscount.create({
        provider: dto.provider,
        externalDiscountId: dto.externalDiscountId,
        slug: dto.code ?? null,
        ...fields,
    });
    return created as PaymentDiscount;
}
