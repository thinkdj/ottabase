/**
 * Font definitions and configurations for Ottabase applications
 *
 * This module provides pre-configured Google Fonts with sensible defaults.
 * You can import these fonts directly or create custom configurations.
 */

import {
  Inter,
  Work_Sans,
  JetBrains_Mono,
  Patrick_Hand,
  Geist,
  Geist_Mono,
} from "next/font/google";
import type { FontConfig, FontsConfig } from "./types";

/**
 * System font fallbacks for better performance and compatibility
 */
export const SYSTEM_FONT_FALLBACKS = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  handwriting: 'cursive, "Comic Sans MS", "Apple Chancery", "Brush Script MT"',
} as const;

// ============================================================================
// Google Fonts - Pre-configured
// ============================================================================

/**
 * Inter - A versatile sans-serif font, excellent for body text
 */
export const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-family-primary",
  display: "swap",
  fallback: SYSTEM_FONT_FALLBACKS.sans.split(", "),
});

/**
 * Work Sans - A geometric sans-serif, great for headings
 */
export const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-family-heading",
  display: "swap",
  fallback: SYSTEM_FONT_FALLBACKS.sans.split(", "),
});

/**
 * JetBrains Mono - A monospace font designed for developers
 */
export const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-family-monospace",
  display: "swap",
  fallback: SYSTEM_FONT_FALLBACKS.mono.split(", "),
});

/**
 * Patrick Hand - A handwriting font for a personal touch
 */
export const patrickHand = Patrick_Hand({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-family-handwriting",
  display: "swap",
  fallback: SYSTEM_FONT_FALLBACKS.handwriting.split(", "),
});

/**
 * Geist - Vercel's sans-serif font
 */
export const geist = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-family-primary",
  display: "swap",
  fallback: SYSTEM_FONT_FALLBACKS.sans.split(", "),
});

/**
 * Geist Mono - Vercel's monospace font
 */
export const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-family-monospace",
  display: "swap",
  fallback: SYSTEM_FONT_FALLBACKS.mono.split(", "),
});

// ============================================================================
// Font Configurations
// ============================================================================

/**
 * Default font configuration using Inter, Work Sans, JetBrains Mono, and Patrick Hand
 */
export const defaultFontsConfig: FontsConfig = {
  primary: {
    role: "primary",
    name: "Inter",
    font: inter,
    cssVariable: "--font-family-primary",
    targetClasses: [".font-family-primary"],
    fallback: SYSTEM_FONT_FALLBACKS.sans,
  },
  heading: {
    role: "heading",
    name: "Work Sans",
    font: workSans,
    cssVariable: "--font-family-heading",
    targetClasses: ["h1", "h2", "h3", "h4", "h5", "h6", ".font-family-heading"],
    fallback: SYSTEM_FONT_FALLBACKS.sans,
  },
  monospace: {
    role: "monospace",
    name: "JetBrains Mono",
    font: jetBrainsMono,
    cssVariable: "--font-family-monospace",
    targetClasses: [
      "code",
      "pre",
      "kbd",
      ".font-family-mono",
      ".font-family-monospace",
    ],
    fallback: SYSTEM_FONT_FALLBACKS.mono,
  },
  handwriting: {
    role: "handwriting",
    name: "Patrick Hand",
    font: patrickHand,
    cssVariable: "--font-family-handwriting",
    targetClasses: [".font-family-handwriting", ".font-family-cursive"],
    fallback: SYSTEM_FONT_FALLBACKS.handwriting,
  },
};

/**
 * Vercel-style font configuration using Geist fonts
 */
export const vercelFontsConfig: FontsConfig = {
  primary: {
    role: "primary",
    name: "Geist",
    font: geist,
    cssVariable: "--font-family-primary",
    targetClasses: [".font-family-primary"],
    fallback: SYSTEM_FONT_FALLBACKS.sans,
  },
  heading: {
    role: "heading",
    name: "Geist",
    font: geist,
    cssVariable: "--font-family-heading",
    targetClasses: ["h1", "h2", "h3", "h4", "h5", "h6", ".font-family-heading"],
    fallback: SYSTEM_FONT_FALLBACKS.sans,
  },
  monospace: {
    role: "monospace",
    name: "Geist Mono",
    font: geistMono,
    cssVariable: "--font-family-monospace",
    targetClasses: [
      "code",
      "pre",
      "kbd",
      ".font-family-mono",
      ".font-family-monospace",
    ],
    fallback: SYSTEM_FONT_FALLBACKS.mono,
  },
  handwriting: {
    role: "handwriting",
    name: "Patrick Hand",
    font: patrickHand,
    cssVariable: "--font-family-handwriting",
    targetClasses: [".font-family-handwriting", ".font-family-cursive"],
    fallback: SYSTEM_FONT_FALLBACKS.handwriting,
  },
};

/**
 * System fonts configuration (no external fonts loaded)
 */
export const systemFontsConfig: Partial<FontsConfig> = {
  primary: {
    role: "primary",
    name: "System Sans",
    font: {
      className: "font-system-sans",
      style: { fontFamily: SYSTEM_FONT_FALLBACKS.sans },
    } as any,
    cssVariable: "--font-family-primary",
    targetClasses: [".font-family-primary"],
    fallback: SYSTEM_FONT_FALLBACKS.sans,
  },
  heading: {
    role: "heading",
    name: "System Sans",
    font: {
      className: "font-system-sans",
      style: { fontFamily: SYSTEM_FONT_FALLBACKS.sans },
    } as any,
    cssVariable: "--font-family-heading",
    targetClasses: ["h1", "h2", "h3", "h4", "h5", "h6", ".font-family-heading"],
    fallback: SYSTEM_FONT_FALLBACKS.sans,
  },
  monospace: {
    role: "monospace",
    name: "System Mono",
    font: {
      className: "font-system-mono",
      style: { fontFamily: SYSTEM_FONT_FALLBACKS.mono },
    } as any,
    cssVariable: "--font-family-monospace",
    targetClasses: [
      "code",
      "pre",
      "kbd",
      ".font-family-mono",
      ".font-family-monospace",
    ],
    fallback: SYSTEM_FONT_FALLBACKS.mono,
  },
};
