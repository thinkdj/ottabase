"use client";

import React, { ReactNode, useEffect } from "react";

/**
 * Base UI Provider
 *
 * Provides base styles and font configuration for UI frameworks.
 * This provider handles FOUC prevention and font family configuration.
 *
 * Place this at the root of your component tree to ensure
 * base styles (reset, animations, utilities) and fonts are configured properly.
 */

// Import base styles
import "../styles/index.css";

export type ProviderUIBaseFontFamilies = {
  primary?: string;
  heading?: string;
  monospace?: string;
};

const DEFAULT_FONT_FAMILIES: Required<ProviderUIBaseFontFamilies> = {
  primary:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
  heading:
    "Work Sans, 'Palanquin Dark', 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
  monospace:
    "JetBrains Mono, 'Fira Code', 'Reddit Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace",
};

interface ProviderUIBaseProps {
  children: ReactNode;
  preventFOUC?: boolean;
  preventFOUCInsideIframe?: boolean;
  fontFamilies?: ProviderUIBaseFontFamilies;
}

export const ProviderUIBase: React.FC<ProviderUIBaseProps> = ({
  children,
  preventFOUC = false,
  preventFOUCInsideIframe = false,
  fontFamilies,
}) => {
  const mergedFontFamilies = {
    ...DEFAULT_FONT_FAMILIES,
    ...fontFamilies,
  } satisfies Required<ProviderUIBaseFontFamilies>;

  const [isInsideIFRAME, setIsInsideIFRAME] = React.useState(false);

  useEffect(() => {
    setIsInsideIFRAME(window.self !== window.top);
  }, []);

  const shouldPreventFOUC =
    preventFOUC && (!isInsideIFRAME || preventFOUCInsideIframe);

  return (
    <div
      style={
        shouldPreventFOUC
          ? { visibility: "hidden" }
          : ({
              fontFamily: mergedFontFamilies.primary,
              "--font-heading": mergedFontFamilies.heading,
              "--font-monospace": mergedFontFamilies.monospace,
            } as React.CSSProperties)
      }
      suppressHydrationWarning
    >
      {children}
    </div>
  );
};

export default ProviderUIBase;
