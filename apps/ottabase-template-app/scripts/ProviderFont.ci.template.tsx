"use client";

import React, { ReactNode } from "react";

// System fonts for CI builds (no network requests)
const createSystemFont = (fontFamily: string, variable: string) => ({
  style: { fontFamily },
  className: "",
  variable,
});

export const primaryFontFamily = createSystemFont(
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  "--font-family-primary"
);

export const headingFontFamily = createSystemFont(
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  "--font-family-heading"
);

export const monospaceFontFamily = createSystemFont(
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  "--font-family-monospace"
);

export const handwritingFontFamily = createSystemFont(
  "'Comic Sans MS', cursive",
  "--font-family-handwriting"
);

interface ProviderFontProps {
  children: ReactNode;
  enforceGoogleFonts?: boolean;
}

const ProviderFont = ({
  children,
  enforceGoogleFonts = true,
}: ProviderFontProps) => {
  const cssAppend = enforceGoogleFonts ? " !important" : "";

  React.useEffect(() => {
    const styleId = "ottabase-font-styles";
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = `
      h1, h2, h3, h4, h5, h6, .font-family-heading {
        font-family: ${headingFontFamily.style.fontFamily}${cssAppend};
      }
      .font-family-primary {
        font-family: ${primaryFontFamily.style.fontFamily}${cssAppend};
      }
      code, pre, kbd, .font-family-mono, .font-family-monospace {
        font-family: ${monospaceFontFamily.style.fontFamily}${cssAppend};
      }
      .font-family-handwriting, .font-family-cursive {
        font-family: ${handwritingFontFamily.style.fontFamily}${cssAppend};
      }
    `;

    return () => {
      const element = document.getElementById(styleId);
      if (element) {
        element.remove();
      }
    };
  }, [enforceGoogleFonts, cssAppend]);

  return <div className={primaryFontFamily.className}>{children}</div>;
};

export default ProviderFont;
