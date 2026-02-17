// ---------------------------------------------------------------------------
// Applies Brand theme to document. Consumes the resolved theme from
// ThemeProviderContext (already computed by ThemeProvider) and applies CSS vars.
// Must be rendered INSIDE ThemeProvider.
// ---------------------------------------------------------------------------

import { applyBrandTheme, CRITICAL_STYLE_ID } from '@ottabase/brand-engine';
import { useEffect } from 'react';
import { useTheme } from './ThemeContext';

export function BrandThemeApplicator() {
    const { resolved } = useTheme();

    useEffect(() => {
        if (!resolved) return;

        applyBrandTheme(resolved);

        // Remove SSR critical CSS after applying – keeps single source of truth
        if (typeof document !== 'undefined') {
            const critical = document.getElementById(CRITICAL_STYLE_ID);
            if (critical) critical.remove();
        }
    }, [resolved]);

    return null;
}
