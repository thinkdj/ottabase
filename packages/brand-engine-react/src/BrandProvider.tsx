// ---------------------------------------------------------------------------
// Brand Engine React – BrandProvider
// Fetches config from API, applies theme via applyBrandTheme, injects custom CSS.
// Cooperates with edge-injected #brand-critical: applies inline styles (which override)
// and removes the style tag to become sole owner after hydration (avoids duplication).
// ---------------------------------------------------------------------------

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { applyBrandTheme, CRITICAL_STYLE_ID } from '@ottabase/brand-engine';
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
    /** Preset ID for preview mode (?brandPreview=) - preview without applying */
    brandPreview?: string | null;
    /** Theme variant ID for preview (?themeVariant=) */
    themeVariant?: string | null;
}

export function BrandProvider({
    children,
    apiEndpoint = '/api/brand',
    initialConfig,
    organizationId,
    appId,
    brandPreview,
    themeVariant,
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
            const previewId =
                brandPreview ??
                (typeof window !== 'undefined'
                    ? new URLSearchParams(window.location.search).get('brandPreview')
                    : null);
            if (previewId) params.set('brandPreview', previewId);
            const variantId =
                themeVariant ??
                (typeof window !== 'undefined'
                    ? new URLSearchParams(window.location.search).get('themeVariant')
                    : null);
            if (variantId) params.set('themeVariant', variantId);
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
    }, [apiEndpoint, organizationId, appId, brandPreview, themeVariant]);

    useEffect(() => {
        if (!initialConfig) {
            fetchConfig();
        }
    }, [fetchConfig, initialConfig]);

    useEffect(() => {
        if (!config?.theme) return;

        if (typeof document !== 'undefined') {
            applyBrandTheme(config.theme);
            // Remove edge-injected #brand-critical; we now own theme via inline styles
            const critical = document.getElementById(CRITICAL_STYLE_ID);
            if (critical) critical.remove();
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
