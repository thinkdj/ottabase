/**
 * Utility functions for font management
 */

import type {
  FontsConfig,
  FontFamilies,
  FontCSSVariables,
  FontConfig,
} from "./types";

/**
 * Extract font families from font configurations for theme integration
 */
export function extractFontFamilies(fonts: FontsConfig): FontFamilies {
  return {
    primary: fonts.primary.font.style.fontFamily || fonts.primary.fallback || "",
    heading: fonts.heading.font.style.fontFamily || fonts.heading.fallback || "",
    monospace:
      fonts.monospace.font.style.fontFamily || fonts.monospace.fallback || "",
    handwriting: fonts.handwriting
      ? fonts.handwriting.font.style.fontFamily ||
        fonts.handwriting.fallback ||
        undefined
      : undefined,
  };
}

/**
 * Generate CSS custom properties from font configurations
 */
export function generateCSSVariables(
  fonts: FontsConfig
): Record<string, string> {
  const variables: Record<string, string> = {
    [fonts.primary.cssVariable]:
      fonts.primary.font.style.fontFamily || fonts.primary.fallback || "",
    [fonts.heading.cssVariable]:
      fonts.heading.font.style.fontFamily || fonts.heading.fallback || "",
    [fonts.monospace.cssVariable]:
      fonts.monospace.font.style.fontFamily || fonts.monospace.fallback || "",
  };

  if (fonts.handwriting) {
    variables[fonts.handwriting.cssVariable] =
      fonts.handwriting.font.style.fontFamily ||
      fonts.handwriting.fallback ||
      "";
  }

  return variables;
}

/**
 * Generate CSS string for font styles
 */
export function generateFontCSS(
  fonts: FontsConfig,
  enforceWithImportant = false
): string {
  const important = enforceWithImportant ? " !important" : "";
  const styles: string[] = [];

  // Helper function to generate CSS for a font config
  const generateFontRules = (config: FontConfig) => {
    if (!config.targetClasses || config.targetClasses.length === 0) {
      return "";
    }

    const selectors = config.targetClasses.join(", ");
    const fontFamily =
      config.font.style.fontFamily || config.fallback || "inherit";

    return `${selectors} {
  font-family: ${fontFamily}${important};
}`;
  };

  // Generate styles for each font
  if (fonts.heading.targetClasses) {
    styles.push(generateFontRules(fonts.heading));
  }

  if (fonts.primary.targetClasses) {
    styles.push(generateFontRules(fonts.primary));
  }

  if (fonts.monospace.targetClasses) {
    styles.push(generateFontRules(fonts.monospace));
  }

  if (fonts.handwriting?.targetClasses) {
    styles.push(generateFontRules(fonts.handwriting));
  }

  return styles.filter(Boolean).join("\n\n");
}

/**
 * Combine multiple class names (similar to clsx/classnames)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Get all font class names for applying to root elements
 */
export function getAllFontClassNames(fonts: FontsConfig): string {
  const variables: (string | undefined)[] = [fonts.primary.font.className];

  // Add variable if it exists (NextFont with variable: true)
  const primaryFont = fonts.primary.font as any;
  if (primaryFont.variable) {
    variables.push(primaryFont.variable as string);
  }

  const headingFont = fonts.heading.font as any;
  if (headingFont.variable) {
    variables.push(headingFont.variable as string);
  }

  const monospaceFont = fonts.monospace.font as any;
  if (monospaceFont.variable) {
    variables.push(monospaceFont.variable as string);
  }

  if (fonts.handwriting) {
    const handwritingFont = fonts.handwriting.font as any;
    if (handwritingFont.variable) {
      variables.push(handwritingFont.variable as string);
    }
  }

  return cn(...variables);
}
