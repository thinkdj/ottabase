import type { NextFont } from "next/dist/compiled/@next/font";

/**
 * Font role in the application
 */
export type FontRole = "primary" | "heading" | "monospace" | "handwriting";

/**
 * Font configuration for a single font
 */
export interface FontConfig {
  /** The role/purpose of this font */
  role: FontRole;
  /** The font family name */
  name: string;
  /** Next.js font object with className and style */
  font: NextFont;
  /** CSS variable name (e.g., "--font-family-primary") */
  cssVariable: string;
  /** CSS classes to apply this font to */
  targetClasses?: string[];
  /** Optional fallback fonts */
  fallback?: string;
}

/**
 * Collection of all font configurations
 */
export interface FontsConfig {
  primary: FontConfig;
  heading: FontConfig;
  monospace: FontConfig;
  handwriting?: FontConfig;
}

/**
 * Options for the font provider
 */
export interface FontProviderOptions {
  /** Font configurations to use */
  fonts: FontsConfig;
  /** Whether to enforce fonts with !important */
  enforceWithImportant?: boolean;
  /** Whether to apply fonts to the body element */
  applyToBody?: boolean;
}

/**
 * Font family configuration for theme integration
 */
export interface FontFamilies {
  primary: string;
  heading: string;
  monospace: string;
  handwriting?: string;
}

/**
 * CSS custom properties for font integration
 */
export interface FontCSSVariables {
  "--font-family-primary": string;
  "--font-family-heading": string;
  "--font-family-monospace": string;
  "--font-family-handwriting"?: string;
}
