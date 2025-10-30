"use client";

import React, { ReactNode } from "react";

// Google Fonts
import {
  Inter,
  Work_Sans,
  JetBrains_Mono,
  Patrick_Hand,
} from "next/font/google";
// Good fonts:
// Heading: Work Sans, Palanquin Dark
// Handwriting: Patrick Hand, Mali
// Mono: JetBrains Mono, Reddit Mono

export const primaryFontFamily = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-family-primary",
});

export const headingFontFamily = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-family-heading",
});

export const monospaceFontFamily = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-family-monospace",
});

export const handwritingFontFamily = Patrick_Hand({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-family-handwriting",
});

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
