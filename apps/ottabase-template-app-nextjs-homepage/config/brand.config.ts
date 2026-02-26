/**
 * Brand Engine configuration — controls visual styling (colors, typography, spacing).
 * This is separate from landing content — Brand Engine = CSS vars/design tokens,
 * ottalanding = page structure and content.
 */

import type { BrandTheme } from '@ottabase/brand-engine';
import { brandPreset } from './landing.config';

export const brandConfig: Partial<BrandTheme> = {
    name: brandPreset,
};

export const themePreset = brandPreset;
