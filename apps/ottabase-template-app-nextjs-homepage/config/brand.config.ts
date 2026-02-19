// Brand configuration for the Next.js homepage template
// This is a simple configuration-driven approach without admin UI

import type { BrandTheme } from '@ottabase/brand-engine';

/**
 * Default brand configuration
 * You can customize this to match your brand
 */
export const brandConfig: Partial<BrandTheme> = {
    name: 'artisan',
    // You can override colors, typography, spacing, etc. here
    // See @ottabase/brand-engine documentation for all available options
};

/**
 * Theme preset to use
 * Available presets: 'default', 'neo', 'crisp', 'funky', 'artisan', 'midnight', 'rose', 'verdant'
 */
export const themePreset = 'artisan';
