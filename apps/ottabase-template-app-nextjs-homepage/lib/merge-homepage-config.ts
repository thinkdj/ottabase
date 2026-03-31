import type { HomepageConfig } from './homepage-config';
import { getDefaultConfig } from './homepage-config';

/**
 * Merge API variant map with local slot defaults (matches SLOT_REGISTRY keys).
 */
export function mergeHomepageConfigFromApi(variantBySlot: Record<string, string> | null | undefined): HomepageConfig {
    const defaults = getDefaultConfig();
    if (!variantBySlot || typeof variantBySlot !== 'object') {
        return defaults;
    }
    return { ...defaults, ...variantBySlot } as HomepageConfig;
}
