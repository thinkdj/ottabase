// ---------------------------------------------------------------------------
// Brand layout registration – call before app render
// Registers layout components for LayoutResolver
// ---------------------------------------------------------------------------

import { registerLayoutComponent } from '@ottabase/brand-engine-react';
import { ConfigurableLayout } from './ConfigurableLayout';

/**
 * Register layout components for Brand Engine LayoutResolver.
 * All presets (homepage, app-shell, docs, minimal) use ConfigurableLayout
 * with different config from API/ presets.
 */
export function initBrandLayouts() {
    registerLayoutComponent('homepage', ConfigurableLayout);
    registerLayoutComponent('app-shell', ConfigurableLayout);
    registerLayoutComponent('docs', ConfigurableLayout);
    registerLayoutComponent('minimal', ConfigurableLayout);
}
