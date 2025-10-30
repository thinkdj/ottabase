/**
 * @ottabase/ui-fonts
 *
 * Centralized font management for Ottabase applications
 *
 * This package provides:
 * - Pre-configured Google Fonts with sensible defaults
 * - TypeScript types for type-safe font configuration
 * - CSS custom properties for theme integration
 * - Font provider component for React applications
 * - Utility functions for font manipulation
 *
 * @example
 * ```tsx
 * import { ProviderFont, defaultFontsConfig, extractFontFamilies } from '@ottabase/ui-fonts';
 *
 * // In your app providers
 * <ProviderFont fonts={defaultFontsConfig}>
 *   <YourApp />
 * </ProviderFont>
 *
 * // Extract font families for theme config
 * const fontFamilies = extractFontFamilies(defaultFontsConfig);
 * ```
 */

// Types
export type {
  FontRole,
  FontConfig,
  FontsConfig,
  FontProviderOptions,
  FontFamilies,
  FontCSSVariables,
} from "./types";

// Font configurations
export {
  // Pre-configured Google Fonts
  inter,
  workSans,
  jetBrainsMono,
  patrickHand,
  geist,
  geistMono,
  // Font configs
  defaultFontsConfig,
  vercelFontsConfig,
  systemFontsConfig,
  // Constants
  SYSTEM_FONT_FALLBACKS,
} from "./fonts";

// Utilities
export {
  extractFontFamilies,
  generateCSSVariables,
  generateFontCSS,
  cn,
  getAllFontClassNames,
} from "./utils";

// Components
export { ProviderFont } from "./ProviderFont";
export type { ProviderFontProps } from "./ProviderFont";
