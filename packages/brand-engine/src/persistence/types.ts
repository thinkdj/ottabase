// ---------------------------------------------------------------------------
// Brand Engine – Resolved config types (API response shape, KV cache)
// Task 01: Core config; routeMappings/layoutTemplatesMap empty (Layout task adds them)
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '../layout';
import type { ResolvedBrandTheme } from '../resolver';

/**
 * Resolved brand config returned by API and cached in KV.
 * Theme + logos + appearance settings.
 */
export interface ResolvedBrandConfig {
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
    /** Route path patterns → layout template ID (empty for Task 01) */
    routeMappings: Array<{ pathPattern: string; layoutTemplateId: string; priority: number }>;
    /** Map layoutTemplateId → { componentKey, config } (empty for Task 01) */
    layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
}
