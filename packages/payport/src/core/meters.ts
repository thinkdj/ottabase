// ============================================================
// Payport — Meters Service (usage-based billing)
// ============================================================
//
// Records customer usage against provider-defined meters with
// strict idempotency. Each call:
//   1. Inserts a local row keyed by (provider, externalEventId)
//      so retries never double-charge.
//   2. Forwards the event to the provider.
//   3. Marks the local row as `sent` (or `failed` w/ error).
//
// Reading customer meter balances is a thin pass-through to the
// provider; callers can also list local meter definitions.
// ============================================================

import { PaymentMeter, PaymentMeterEvent } from '../models';
import type { CustomerMeterDTO, CustomerMeterQuery, MeterDTO, PaymentProviderName, RecordUsageInput } from '../types';
import { ProviderCapabilityError } from './capabilities';
import { ensureCustomer } from './customers';
import { emit } from './events';
import { getProvider } from './registry';

export interface RecordUsageOptions extends RecordUsageInput {
    provider?: PaymentProviderName;
    /** Customer email (used for ensureCustomer if no mirror exists yet). */
    email?: string;
}

export interface UsageReceipt {
    /** Local meter event row id. */
    id: string;
    externalEventId: string;
    status: 'sent' | 'failed';
    error?: string;
}

/**
 * Record a usage event for the active provider. Idempotent on
 * `externalEventId` — repeated calls return the original receipt
 * without re-billing.
 */
export async function recordUsage(input: RecordUsageOptions): Promise<UsageReceipt> {
    const provider = getProvider(input.provider);
    if (!provider.recordUsage) throw new ProviderCapabilityError(provider.name, 'recordUsage');

    const externalEventId = input.externalEventId ?? `payport_${crypto.randomUUID()}`;

    // Idempotency check (provider, externalEventId)
    const existing = await PaymentMeterEvent.findByExternal(provider.name, externalEventId);
    if (existing && (existing.get('status') as string) === 'sent') {
        return {
            id: existing.get('id') as string,
            externalEventId,
            status: 'sent',
        };
    }

    // Ensure customer mirror exists when an email is provided.
    if (input.email) {
        await ensureCustomer({
            userId: input.userId,
            email: input.email,
            provider: provider.name,
        });
    }

    // Try to look up meter id from the local catalog (if mirrored).
    const meterRow = await PaymentMeter.findBySlug(input.meter);
    const externalMeterId = meterRow?.get('externalMeterId') as string | undefined;

    const occurredAt = input.occurredAt ?? new Date();
    const local =
        existing ??
        ((await PaymentMeterEvent.create({
            provider: provider.name,
            meterSlug: input.meter,
            externalMeterId: externalMeterId ?? null,
            userId: input.userId,
            externalEventId,
            value: input.value,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
            status: 'pending',
            occurredAt,
        })) as PaymentMeterEvent);

    try {
        await provider.recordUsage({
            userId: input.userId,
            meter: externalMeterId ?? input.meter,
            value: input.value,
            externalEventId,
            occurredAt,
            metadata: input.metadata,
        });
        local.set('status', 'sent');
        local.set('sentAt', new Date());
        await local.save();

        await emit({
            type: 'payment.meter.usage_recorded',
            provider: provider.name,
            externalEventId: `usage:${externalEventId}`,
            data: {
                userId: input.userId,
                meter: input.meter,
                value: input.value,
                occurredAt,
            },
            occurredAt,
        });

        return { id: local.get('id') as string, externalEventId, status: 'sent' };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        local.set('status', 'failed');
        local.set('lastError', message);
        await local.save();
        return {
            id: local.get('id') as string,
            externalEventId,
            status: 'failed',
            error: message,
        };
    }
}

/** Fetch a customer's current balance/consumption for a meter from the provider. */
export async function getCustomerMeter(input: CustomerMeterQuery): Promise<CustomerMeterDTO | null> {
    const provider = getProvider();
    if (!provider.getCustomerMeter) throw new ProviderCapabilityError(provider.name, 'getCustomerMeter');
    return provider.getCustomerMeter(input);
}

/** List meters from the provider, mirroring each into the local catalog. */
export async function listMeters(): Promise<MeterDTO[]> {
    const provider = getProvider();
    if (!provider.listMeters) throw new ProviderCapabilityError(provider.name, 'listMeters');
    const meters = await provider.listMeters();
    await Promise.all(meters.map(upsertLocalMeter));
    return meters;
}

export async function upsertLocalMeter(dto: MeterDTO): Promise<PaymentMeter> {
    const existing = await PaymentMeter.where({ provider: dto.provider, externalMeterId: dto.externalMeterId });
    if (existing[0]) {
        const row = existing[0] as PaymentMeter;
        row.set('slug', dto.slug);
        row.set('name', dto.name);
        row.set('aggregation', dto.aggregation);
        row.set('unit', dto.unit ?? null);
        row.set('metadata', dto.metadata ? JSON.stringify(dto.metadata) : null);
        await row.save();
        return row;
    }
    const created = await PaymentMeter.create({
        provider: dto.provider,
        externalMeterId: dto.externalMeterId,
        slug: dto.slug,
        name: dto.name,
        aggregation: dto.aggregation,
        unit: dto.unit ?? null,
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
        active: true,
    });
    return created as PaymentMeter;
}
