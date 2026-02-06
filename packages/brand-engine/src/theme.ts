// ---------------------------------------------------------------------------
// BrandEngine – Brand Theme definition
// ---------------------------------------------------------------------------

import type { DesignTokens, TokenCursors } from './tokens';
import type { LayoutConfig } from './layout';

/**
 * A complete BrandTheme – the union of design tokens, layout configuration,
 * and appearance extras that fully describes a themed experience.
 *
 * BrandTheme replaces the old ThemeConfig from the app-level theme system.
 */
export interface BrandTheme {
    /** Unique identifier for this theme (e.g. "default", "neo", "midnight") */
    name: string;

    /** Core design tokens (color, typography, spacing, radius, shadow, motion) */
    tokens: DesignTokens;

    /** Layout configuration for app shell */
    layout?: LayoutConfig;

    /** Cursor appearance overrides */
    cursors?: TokenCursors;
}
