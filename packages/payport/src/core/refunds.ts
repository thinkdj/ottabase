// ============================================================
// Payport — Refunds Service
// ============================================================

import { PaymentRefund } from '../models';
import type { CreateRefundInput, PaymentProviderName, RefundDTO } from '../types';
import { ProviderCapabilityError } from './capabilities';
import { emit } from './events';
import { getProvider } from './registry';

export interface CreateRefundOptions extends CreateRefundInput {
    provider?: PaymentProviderName;
    userId?: string;
}

export async function createRefund(input: CreateRefundOptions): Promise<RefundDTO> {
    const provider = getProvider(input.provider);
    if (!provider.createRefund) throw new ProviderCapabilityError(provider.name, 'createRefund');

    const refund = await provider.createRefund(input);
    const record = await upsertLocalRefund(refund, input.userId);

    await emit({
        type: refund.status === 'succeeded' ? 'payment.refund.completed' : 'payment.refund.created',
        provider: provider.name,
        externalEventId: `refund.${refund.status}:${refund.externalRefundId}`,
        data: { ...refund, localId: record.get('id') as string },
        occurredAt: new Date(),
    });

    return refund;
}

export async function getRefund(externalRefundId: string): Promise<RefundDTO | null> {
    const provider = getProvider();
    if (!provider.getRefund) throw new ProviderCapabilityError(provider.name, 'getRefund');
    const refund = await provider.getRefund(externalRefundId);
    if (refund) await upsertLocalRefund(refund);
    return refund;
}

export async function listRefunds(query?: {
    externalOrderId?: string;
    externalSubscriptionId?: string;
}): Promise<RefundDTO[]> {
    const provider = getProvider();
    if (!provider.listRefunds) throw new ProviderCapabilityError(provider.name, 'listRefunds');
    const refunds = await provider.listRefunds(query);
    await Promise.all(refunds.map((r) => upsertLocalRefund(r)));
    return refunds;
}

/** Upsert provider DTO into local mirror; idempotent on (provider, externalRefundId). */
export async function upsertLocalRefund(dto: RefundDTO, userId?: string): Promise<PaymentRefund> {
    const existing = await PaymentRefund.findByExternal(dto.provider, dto.externalRefundId);
    const fields = {
        externalOrderId: dto.externalOrderId ?? null,
        externalSubscriptionId: dto.externalSubscriptionId ?? null,
        externalCustomerId: dto.externalCustomerId ?? null,
        userId: dto.userId ?? userId ?? null,
        amount: dto.amount,
        currency: dto.currency,
        reason: dto.reason ?? null,
        status: dto.status,
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
    };
    if (existing) {
        for (const [key, value] of Object.entries(fields)) existing.set(key, value);
        await existing.save();
        return existing;
    }
    const created = await PaymentRefund.create({
        provider: dto.provider,
        externalRefundId: dto.externalRefundId,
        ...fields,
    });
    return created as PaymentRefund;
}
