"use client";

import React, { ReactNode, useEffect } from "react";
import type { FontProviderOptions } from "./types";
import { generateFontCSS, getAllFontClassNames } from "./utils";

/**
 * Font Provider Component
 *
 * This provider wraps your application and:
 * 1. Applies font CSS variables to the root
 * 2. Injects font-family styles for semantic elements
 * 3. Ensures fonts are loaded and applied correctly
 *
 * @example
 * ```tsx
 * import { ProviderFont, defaultFontsConfig } from '@ottabase/ui-fonts';
 *
 * <ProviderFont fonts={defaultFontsConfig} enforceWithImportant>
 *   <YourApp />
 * </ProviderFont>
 * ```
 */
export interface ProviderFontProps {
  children: ReactNode;
  /** Font configurations to use */
  fonts: FontProviderOptions["fonts"];
  /** Whether to enforce fonts with !important (default: true) */
  enforceWithImportant?: boolean;
  /** Whether to apply primary font to the wrapper div (default: true) */
  applyToBody?: boolean;
}

export const ProviderFont: React.FC<ProviderFontProps> = ({
  children,
  fonts,
  enforceWithImportant = true,
  applyToBody = true,
}) => {
  useEffect(() => {
    // Inject global font styles
    const styleId = "ottabase-font-styles";
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    // Generate and inject CSS
    const css = generateFontCSS(fonts, enforceWithImportant);
    styleElement.textContent = css;

    // Cleanup on unmount
    return () => {
      const element = document.getElementById(styleId);
      if (element) {
        element.remove();
      }
    };
  }, [fonts, enforceWithImportant]);

  // Get all font class names to apply to the wrapper
  const fontClassNames = getAllFontClassNames(fonts);

  // If applyToBody is false, just render children with font variables
  if (!applyToBody) {
    return <div className={fontClassNames}>{children}</div>;
  }

  // Apply primary font to the wrapper
  return (
    <div className={`${fontClassNames} ${fonts.primary.font.className}`}>
      {children}
    </div>
  );
};

export default ProviderFont;
