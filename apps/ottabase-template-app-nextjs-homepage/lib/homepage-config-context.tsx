'use client';

/**
 * React context + hook for the homepage slot configuration.
 *
 * Wraps `loadConfig` / `saveConfig` in React state so every consumer
 * re-renders when a slot variant is changed — enabling live preview on the
 * config page and instant updates on the homepage.
 *
 * Supports API-driven initial config: when `initialVariantBySlot` is provided
 * (from GET /api/homepage/data display settings), it overrides the default
 * config for any slot that has a valid variant set in the DB. localStorage
 * takes final precedence (user's local customization wins).
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { HomepageConfig, SlotName } from './homepage-config';
import { getDefaultConfig, loadConfig, saveConfig, SLOT_NAMES, SLOT_REGISTRY } from './homepage-config';

type HomepageConfigContextValue = {
    config: HomepageConfig;
    setVariant: (slot: SlotName, variantId: string) => void;
    resetConfig: () => void;
};

const HomepageConfigContext = createContext<HomepageConfigContextValue | null>(null);

export interface HomepageConfigProviderProps {
    children: React.ReactNode;
    /** API-driven variant-by-slot from HomepageDisplaySettings (DB source of truth). */
    initialVariantBySlot?: Record<string, string> | null;
}

/**
 * Merge priority: localStorage > API variantBySlot > built-in defaults.
 * This ensures users can override via the config panel, DB settings provide
 * a baseline, and defaults are always available.
 */
function mergeConfig(apiVariants: Record<string, string> | null | undefined): HomepageConfig {
    const defaults = getDefaultConfig();
    const merged = { ...defaults };

    // Layer 1: Apply API-driven variants (if valid)
    if (apiVariants && typeof apiVariants === 'object') {
        for (const slot of SLOT_NAMES) {
            const value = apiVariants[slot];
            if (typeof value === 'string') {
                const validIds = SLOT_REGISTRY[slot].variants.map((v) => v.id);
                if (validIds.includes(value)) {
                    merged[slot] = value;
                }
            }
        }
    }

    return merged;
}

export function HomepageConfigProvider({ children, initialVariantBySlot }: HomepageConfigProviderProps) {
    // Start with API-merged config (or defaults)
    const [config, setConfig] = useState<HomepageConfig>(() => mergeConfig(initialVariantBySlot));

    // Layer 2: Hydrate from localStorage on mount (takes final precedence)
    useEffect(() => {
        const localConfig = loadConfig();
        // Merge: localStorage overrides API values where localStorage has valid entries
        setConfig((current) => {
            const final = { ...current };
            for (const slot of SLOT_NAMES) {
                const localValue = localConfig[slot];
                const defaultValue = getDefaultConfig()[slot];
                // Only use localStorage value if it differs from the default
                // (indicating the user explicitly set it)
                if (localValue !== defaultValue) {
                    final[slot] = localValue;
                }
            }
            return final;
        });
    }, []);

    const setVariant = useCallback((slot: SlotName, variantId: string) => {
        setConfig((prev) => {
            const next = { ...prev, [slot]: variantId };
            saveConfig(next);
            return next;
        });
    }, []);

    const resetConfig = useCallback(() => {
        // Reset to API-merged config (not just defaults)
        const base = mergeConfig(initialVariantBySlot);
        setConfig(base);
        saveConfig(base);
    }, [initialVariantBySlot]);

    return (
        <HomepageConfigContext.Provider value={{ config, setVariant, resetConfig }}>
            {children}
        </HomepageConfigContext.Provider>
    );
}

export function useHomepageConfig() {
    const ctx = useContext(HomepageConfigContext);
    if (!ctx) {
        throw new Error('useHomepageConfig must be used within <HomepageConfigProvider>');
    }
    return ctx;
}
