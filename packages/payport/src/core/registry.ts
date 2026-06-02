// ============================================================
// Payport — Provider Registry
// ============================================================

import type { PaymentProvider } from '../provider';
import type { PaymentProviderName } from '../types';

const REGISTRY = new Map<PaymentProviderName, PaymentProvider>();
let activeProvider: PaymentProviderName | null = null;

/**
 * Register a payment provider implementation. Last registration wins
 * for the same name. Sets the provider as active if it is the first.
 */
export function registerProvider(provider: PaymentProvider): void {
    REGISTRY.set(provider.name, provider);
    if (!activeProvider) activeProvider = provider.name;
}

export function setActiveProvider(name: PaymentProviderName): void {
    if (!REGISTRY.has(name)) {
        throw new Error(`[payport] Cannot activate unknown provider "${name}". Register it first.`);
    }
    activeProvider = name;
}

export function getProvider(name?: PaymentProviderName): PaymentProvider {
    const key = name ?? activeProvider;
    if (!key) {
        throw new Error('[payport] No provider registered. Call registerProvider() during app boot.');
    }
    const provider = REGISTRY.get(key);
    if (!provider) {
        throw new Error(`[payport] Provider "${key}" is not registered.`);
    }
    return provider;
}

export function listProviders(): PaymentProviderName[] {
    return Array.from(REGISTRY.keys());
}

export function clearProviders(): void {
    REGISTRY.clear();
    activeProvider = null;
}
