// ============================================================
// AI Image Provider — Abstract Interface & Factory
// ============================================================

import type { AIImageProvider, ImageGenerationParams, ImageGenerationOutput } from '../types';

/** Registry of available providers */
const providers = new Map<string, AIImageProvider>();

/** Register a provider */
export function registerProvider(provider: AIImageProvider): void {
    providers.set(provider.name, provider);
}

/** Get a provider by name */
export function getProvider(name: string): AIImageProvider | undefined {
    return providers.get(name);
}

/** Get the default provider (first registered) */
export function getDefaultProvider(): AIImageProvider | undefined {
    const first = providers.values().next();
    return first.done ? undefined : first.value;
}

/** List all registered providers */
export function listProviders(): string[] {
    return Array.from(providers.keys());
}

/**
 * Generate an image using the specified or default provider.
 * This is the main entry point for image generation.
 */
export async function generateImage(
    params: ImageGenerationParams,
    providerName?: string,
): Promise<ImageGenerationOutput> {
    const provider = providerName ? getProvider(providerName) : getDefaultProvider();
    if (!provider) {
        throw new Error(
            providerName
                ? `AI provider "${providerName}" not registered. Available: ${listProviders().join(', ')}`
                : 'No AI image provider registered. Call registerProvider() first.',
        );
    }
    return provider.generate(params);
}
