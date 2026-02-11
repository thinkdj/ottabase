// ---------------------------------------------------------------------------
// Brand Engine React – BrandProvider
// Fetches config from API, applies theme via applyBrandTheme, injects custom CSS
// ---------------------------------------------------------------------------

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { applyBrandTheme } from '@ottabase/brand-engine';
import type { LayoutConfig } from '@ottabase/brand-engine';
import type { ResolvedBrandTheme } from '@ottabase/brand-engine';

/**
 * Brand config shape returned by GET /api/brand
 */
export interface BrandConfig {
    brandName: string;
    tagline?: string;
    logos: {
        primary?: string;
        dark?: string;
        icon?: string;
        ogImage?: string;
        emailLogo?: string;
    };
    theme: ResolvedBrandTheme;
    defaultColorScheme: 'light' | 'dark' | 'system';
    allowDarkModeToggle: boolean;
    customCss?: string;
    hideOttabaseBranding: boolean;
    /** Route path patterns → layout template ID */
    routeMappings?: Array<{ pathPattern: string; layoutTemplateId: string; priority: number }>;
    /** Map layoutTemplateId → { componentKey, config } */
    layoutTemplatesMap?: Record<string, { componentKey: string; config: LayoutConfig }>;
}

interface BrandContextValue {
    config: BrandConfig | null;
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

const BrandContext = createContext<BrandContextValue | null>(null);

export interface BrandProviderProps {
    children: React.ReactNode;
    /** API endpoint to fetch brand config */
    apiEndpoint?: string;
    /** Initial brand config (for SSR) */
    initialConfig?: BrandConfig;
    /** Organization ID for multi-tenant */
    organizationId?: string | null;
    /** App ID for app-specific branding */
    appId?: string | null;
}

export function BrandProvider({
    children,
    apiEndpoint = '/api/brand',
    initialConfig,
    organizationId,
    appId,
}: BrandProviderProps) {
    const [config, setConfig] = useState<BrandConfig | null>(initialConfig ?? null);
    const [isLoading, setIsLoading] = useState(!initialConfig);
    const [error, setError] = useState<Error | null>(null);

    const fetchConfig = useCallback(async () => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams();
            if (organizationId) params.set('organizationId', organizationId);
            if (appId) params.set('appId', appId);
            const url = params.toString() ? `${apiEndpoint}?${params}` : apiEndpoint;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch brand config');
            }

            const data = (await response.json()) as BrandConfig;
            setConfig(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, [apiEndpoint, organizationId, appId]);

    useEffect(() => {
        if (!initialConfig) {
            fetchConfig();
        }
    }, [fetchConfig, initialConfig]);

    useEffect(() => {
        if (!config?.theme) return;

        if (typeof document !== 'undefined') {
            applyBrandTheme(config.theme);
        }

        if (config.customCss) {
            injectCustomCss(config.customCss);
        }
    }, [config]);

    return (
        <BrandContext.Provider value={{ config, isLoading, error, refresh: fetchConfig }}>
            {children}
        </BrandContext.Provider>
    );
}

export function useBrand(): BrandContextValue {
    const context = useContext(BrandContext);
    if (!context) {
        throw new Error('useBrand must be used within a BrandProvider');
    }
    return context;
}

function injectCustomCss(css: string) {
    const id = 'brand-custom-css';
    let style = document.getElementById(id) as HTMLStyleElement | null;

    if (!style) {
        style = document.createElement('style');
        style.id = id;
        document.head.appendChild(style);
    }

    style.textContent = css;
}
