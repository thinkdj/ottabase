'use client';

/**
 * React context + hook for the homepage slot configuration.
 *
 * Wraps `loadConfig` / `saveConfig` in React state so every consumer
 * re-renders when a slot variant is changed — enabling live preview on the
 * config page and instant updates on the homepage.
 *
 * When `initialConfig` is provided (from TanStack API in layout), SSR owns the
 * first paint; localStorage is only applied when no server config was passed.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { HomepageConfig, SlotName } from './homepage-config';
import { getDefaultConfig, loadConfig, saveConfig } from './homepage-config';

type HomepageConfigContextValue = {
    config: HomepageConfig;
    setVariant: (slot: SlotName, variantId: string) => void;
    resetConfig: () => void;
};

const HomepageConfigContext = createContext<HomepageConfigContextValue | null>(null);

export function HomepageConfigProvider({
    children,
    initialConfig,
}: {
    children: React.ReactNode;
    /** When set from SSR (API), used as initial state instead of localStorage alone */
    initialConfig?: HomepageConfig;
}) {
    const [config, setConfig] = useState<HomepageConfig>(() => initialConfig ?? getDefaultConfig());

    // After SSR: merge localStorage overrides on top of server config (config page / live preview)
    useEffect(() => {
        const stored = loadConfig();
        if (initialConfig) {
            setConfig({ ...initialConfig, ...stored });
            return;
        }
        setConfig(stored);
    }, [initialConfig]);

    const setVariant = useCallback((slot: SlotName, variantId: string) => {
        setConfig((prev) => {
            const next = { ...prev, [slot]: variantId };
            saveConfig(next);
            return next;
        });
    }, []);

    const resetConfig = useCallback(() => {
        const defaults = getDefaultConfig();
        setConfig(defaults);
        saveConfig(defaults);
    }, []);

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
