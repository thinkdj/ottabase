// ---------------------------------------------------------------------------
// Applies Brand theme to document. Uses config from BrandProvider + mode from next-themes.
// Theme is app-level (set by admin); user can only switch light/dark.
// Single source of truth for runtime theme – avoids wrong mode on nav or light/dark toggle.
// ---------------------------------------------------------------------------

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { applyBrandTheme, CRITICAL_STYLE_ID, getThemeOrDefault, resolveTheme } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';

export function BrandThemeApplicator() {
    const { config } = useBrand();
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        if (!config?.theme) return;

        // Use resolvedTheme when available; fallback to document class (avoids flash on hydrate)
        const mode =
            resolvedTheme === 'dark'
                ? 'dark'
                : resolvedTheme === 'light'
                  ? 'light'
                  : typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                    ? 'dark'
                    : 'light';

        const base = getThemeOrDefault(config.themeBase || 'default');
        const resolved = resolveTheme({
            base,
            tenantOverrides: config.tenantTheme ?? {},
            mode,
        });
        applyBrandTheme(resolved);

        // Remove SSR critical CSS after applying – keeps single source of truth
        if (typeof document !== 'undefined') {
            const critical = document.getElementById(CRITICAL_STYLE_ID);
            if (critical) critical.remove();
        }
    }, [config, resolvedTheme]);

    return null;
}
