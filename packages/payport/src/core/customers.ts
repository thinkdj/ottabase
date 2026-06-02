// ============================================================
// Payport — Customer Service (provider-neutral)
// ============================================================

import { PaymentCustomer } from '../models';
import type { PaymentCustomerDTO, PaymentProviderName } from '../types';
import { getProvider } from './registry';

export interface EnsureCustomerInput {
    userId: string;
    email: string;
    name?: string;
    metadata?: Record<string, string>;
    provider?: PaymentProviderName;
}

/** Idempotent: returns the existing payment customer or creates one at the provider + locally. */
export async function ensureCustomer(input: EnsureCustomerInput): Promise<PaymentCustomerDTO> {
    const provider = getProvider(input.provider);
    const existing = await PaymentCustomer.findByUser(provider.name, input.userId);
    if (existing) {
        await linkUserToCustomer(input.userId, existing.get('id') as string);
        return toDTO(existing);
    }

    const created = await provider.createCustomer({
        userId: input.userId,
        email: input.email,
        name: input.name,
        metadata: input.metadata,
    });

    const record = await PaymentCustomer.create({
        provider: provider.name,
        externalCustomerId: created.externalCustomerId,
        userId: input.userId,
        email: input.email,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });

    const customer = record as PaymentCustomer;
    await linkUserToCustomer(input.userId, customer.get('id') as string);
    return toDTO(customer);
}

/**
 * Stamp `users.payportCustomerId` for fast O(1) reverse lookup from a user to
 * their billing customer. Best-effort — silently no-ops if the User model is
 * not loadable (e.g. tests where the driver is stubbed). Safe to call multiple
 * times; only writes when the value changes.
 */
export async function linkUserToCustomer(userId: string, customerId: string): Promise<void> {
    try {
        const { User } = await import('@ottabase/ottaorm');
        const user = await User.find(userId);
        if (!user) return;
        if (user.get('payportCustomerId') === customerId) return;
        user.set('payportCustomerId', customerId);
        await user.save();
    } catch {
        // Non-fatal: customer linkage is an optimization, not a correctness requirement.
    }
}

export async function getCustomerForUser(
    userId: string,
    provider?: PaymentProviderName,
): Promise<PaymentCustomerDTO | null> {
    const providerName = provider ?? getProvider().name;
    const record = await PaymentCustomer.findByUser(providerName, userId);
    return record ? toDTO(record) : null;
}

/**
 * Reconcile the local mirror with the provider's source of truth (email, metadata).
 * Useful from admin tooling or a scheduled job.
 */
export async function syncCustomer(userId: string, provider?: PaymentProviderName): Promise<PaymentCustomerDTO | null> {
    const prov = getProvider(provider);
    const local = await PaymentCustomer.findByUser(prov.name, userId);
    if (!local) return null;

    const remote = await prov.getCustomer(local.get('externalCustomerId') as string);
    if (!remote) return toDTO(local);

    local.set('email', remote.email);
    if (remote.metadata) local.set('metadata', JSON.stringify(remote.metadata));
    await local.save();
    return toDTO(local);
}

function toDTO(record: PaymentCustomer): PaymentCustomerDTO {
    const metadata = record.get('metadata') as string | null;
    return {
        id: record.get('id') as string,
        provider: record.get('provider') as PaymentProviderName,
        externalCustomerId: record.get('externalCustomerId') as string,
        userId: record.get('userId') as string,
        email: record.get('email') as string,
        metadata: metadata ? safeJson(metadata) : null,
    };
}

function safeJson(input: string): Record<string, string> | null {
    try {
        const parsed = JSON.parse(input);
        return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, string>) : null;
    } catch {
        return null;
    }
}
