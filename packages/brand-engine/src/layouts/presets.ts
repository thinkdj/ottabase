// ---------------------------------------------------------------------------
// Brand Engine – Built-in Layout Presets
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '../layout';

export type LayoutComponentKey = 'homepage' | 'app-shell' | 'docs' | 'minimal';

export interface LayoutPreset {
    componentKey: LayoutComponentKey;
    config: LayoutConfig;
}

export const HOMEPAGE_LAYOUT: LayoutPreset = {
    componentKey: 'homepage',
    config: { header: 'minimal', navigation: 'topbar', contentWidth: 'full', footer: true, density: 'comfy' },
};

export const APP_SHELL_LAYOUT: LayoutPreset = {
    componentKey: 'app-shell',
    config: { header: 'topbar', navigation: 'sidebar', contentWidth: 'fluid', footer: false, density: 'comfy' },
};

export const DOCS_LAYOUT: LayoutPreset = {
    componentKey: 'docs',
    config: { header: 'topbar', navigation: 'sidebar', contentWidth: 'fixed', footer: true, density: 'compact' },
};

export const MINIMAL_LAYOUT: LayoutPreset = {
    componentKey: 'minimal',
    config: { header: 'none', navigation: 'topbar', contentWidth: 'full', footer: false, density: 'comfy' },
};

export const LAYOUT_PRESETS: Record<LayoutComponentKey, LayoutPreset> = {
    homepage: HOMEPAGE_LAYOUT,
    'app-shell': APP_SHELL_LAYOUT,
    docs: DOCS_LAYOUT,
    minimal: MINIMAL_LAYOUT,
};
