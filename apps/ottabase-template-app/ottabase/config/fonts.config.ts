/**
 * Font configuration for the application
 *
 * This file defines the fonts used throughout the application.
 * You can switch between different font configurations here:
 * - defaultFontsConfig: Inter, Work Sans, JetBrains Mono, Patrick Hand
 * - vercelFontsConfig: Geist, Geist Mono
 * - systemFontsConfig: System fonts (no external fonts)
 * - Or create your own custom configuration
 */

import {
  defaultFontsConfig,
  vercelFontsConfig,
  type FontsConfig,
} from "@ottabase/ui-fonts";

/**
 * Active font configuration
 * Change this to switch between different font sets
 */
export const appFontsConfig: FontsConfig = defaultFontsConfig;

/**
 * Alternative configurations (commented out)
 * Uncomment to use a different font set
 */
// export const appFontsConfig: FontsConfig = vercelFontsConfig;
// export const appFontsConfig: FontsConfig = systemFontsConfig;

/**
 * Font configuration options
 */
export const fontOptions = {
  /** Enforce fonts with !important CSS rule */
  enforceWithImportant: true,
  /** Apply primary font to the provider wrapper */
  applyToBody: true,
};

// Re-export useful utilities
export { extractFontFamilies, type FontFamilies } from "@ottabase/ui-fonts";
