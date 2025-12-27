import React, { ReactNode, useEffect } from "react";

// Font families (will be loaded via CSS @import)
export const primaryFontFamily = "Inter";
export const headingFontFamily = "Work Sans";
export const monospaceFontFamily = "JetBrains Mono";
export const handwritingFontFamily = "Patrick Hand";

interface ProviderFontProps {
  children: ReactNode;
  enforceGoogleFonts?: boolean;
}

/**
 * ProviderFont - TanStack-compatible font provider
 * 
 * Loads Google Fonts via CSS and injects font-family styles
 * for different text elements.
 */
const ProviderFont = ({
  children,
  enforceGoogleFonts = true,
}: ProviderFontProps) => {
  const cssAppend = enforceGoogleFonts ? " !important" : "";

  useEffect(() => {
    // Inject Google Fonts link
    const linkId = "ottabase-google-fonts";
    let linkElement = document.getElementById(linkId) as HTMLLinkElement;

    if (!linkElement) {
      linkElement = document.createElement("link");
      linkElement.id = linkId;
      linkElement.rel = "stylesheet";
      linkElement.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400&family=Patrick+Hand&family=Work+Sans:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(linkElement);
    }

    // Inject global styles
    const styleId = "ottabase-font-styles";
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    // Inject Custom CSS Font-Family Styles
    styleElement.textContent = `
      h1, h2, h3, h4, h5, h6, .font-family-heading {
        font-family: "${headingFontFamily}", sans-serif${cssAppend};
      }
      .font-family-primary {
        font-family: "${primaryFontFamily}", sans-serif${cssAppend};
      }
      code, pre, kbd, .font-family-mono, .font-family-monospace {
        font-family: "${monospaceFontFamily}", monospace${cssAppend};
      }
      .font-family-handwriting, .font-family-cursive {
        font-family: "${handwritingFontFamily}", cursive${cssAppend};
      }
    `;

    return () => {
      const element = document.getElementById(styleId);
      if (element) {
        element.remove();
      }
    };
  }, [enforceGoogleFonts, cssAppend]);

  return (
    <div style={{ fontFamily: `"${primaryFontFamily}", sans-serif` }}>
      {children}
    </div>
  );
};

export default ProviderFont;
