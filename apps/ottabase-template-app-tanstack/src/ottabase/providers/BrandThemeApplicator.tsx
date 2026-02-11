// ---------------------------------------------------------------------------
// Applies Brand theme to document. Uses config from BrandProvider + mode from next-themes.
// Theme is app-level (set by admin); user can only switch light/dark.
// ---------------------------------------------------------------------------

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { applyBrandTheme, getThemeOrDefault, resolveTheme } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';

export function BrandThemeApplicator() {
    const { config } = useBrand();
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        if (!config?.theme) return;

        const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
        const base = getThemeOrDefault(config.themeBase || 'default');
        const resolved = resolveTheme({
            base,
            tenantOverrides: config.tenantTheme ?? {},
            mode,
        });
        applyBrandTheme(resolved);
    }, [config, resolvedTheme]);

    return null;
}
