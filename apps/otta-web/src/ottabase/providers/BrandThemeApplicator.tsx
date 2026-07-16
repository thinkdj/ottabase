// ---------------------------------------------------------------------------
// Applies the brand theme to the document. Writes/replaces the SAME
// <style id="brand-critical"> / <style id="brand-effects"> elements the edge
// injects (dual light+dark blocks), so:
//   • mode toggling is pure CSS cascade (html.dark) — no JS re-application
//   • theme/effects/custom CSS never fight inline-style specificity
// Re-runs only when the path-scoped theme pair actually changes (admin edits,
// route token overrides, SPA navigation across differently-themed routes).
// ---------------------------------------------------------------------------

import { applyBrandTheme } from '@ottabase/brand-engine';
import { useBrand } from '@ottabase/brand-engine-react';
import { useEffect } from 'react';

export function BrandThemeApplicator() {
    const { config } = useBrand();
    const themeLight = config?.themeLight;
    const themeDark = config?.themeDark;

    useEffect(() => {
        if (!themeLight) {
            console.warn('[BrandThemeApplicator] No resolved theme available');
            return;
        }
        applyBrandTheme(themeLight, themeDark ?? themeLight);
    }, [themeLight, themeDark]);

    return null;
}
