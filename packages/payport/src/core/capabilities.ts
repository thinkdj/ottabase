// ============================================================
// Payport — Capability errors
// ============================================================
//
// Centralised error thrown when a facade call requires a provider
// capability the active adapter does not implement (e.g. calling
// `payport.meters.recordUsage` on a provider without meters).
// ============================================================

import type { PaymentProvider } from '../provider';

export class ProviderCapabilityError extends Error {
    constructor(
        public provider: string,
        public capability: string,
    ) {
        super(`[payport] Provider "${provider}" does not support capability "${capability}".`);
        this.name = 'ProviderCapabilityError';
    }
}

/**
 * Narrow check used inside core services to throw early with a clear message
 * when the active adapter is missing an optional method.
 */
export function requireCapability<K extends keyof PaymentProvider>(
    provider: PaymentProvider,
    capability: K,
): NonNullable<PaymentProvider[K]> {
    const value = provider[capability];
    if (typeof value !== 'function') {
        throw new ProviderCapabilityError(provider.name, capability as string);
    }
    return value as NonNullable<PaymentProvider[K]>;
}
