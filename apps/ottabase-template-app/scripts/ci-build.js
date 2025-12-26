#!/usr/bin/env node

/**
 * CI Build Script
 * Temporarily replaces Google Fonts with system fonts for CI builds
 * to avoid network dependencies during build time
 */

const fs = require('fs');
const path = require('path');

const FONT_PROVIDER_PATH = path.join(__dirname, '../ottabase/providers/ProviderFont.tsx');
const BACKUP_PATH = path.join(__dirname, '../ottabase/providers/ProviderFont.tsx.backup');

const CI_FONT_CONTENT = `"use client";

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

    styleElement.textContent = \`
      h1, h2, h3, h4, h5, h6, .font-family-heading {
        font-family: \${headingFontFamily.style.fontFamily}\${cssAppend};
      }
      .font-family-primary {
        font-family: \${primaryFontFamily.style.fontFamily}\${cssAppend};
      }
      code, pre, kbd, .font-family-mono, .font-family-monospace {
        font-family: \${monospaceFontFamily.style.fontFamily}\${cssAppend};
      }
      .font-family-handwriting, .font-family-cursive {
        font-family: \${handwritingFontFamily.style.fontFamily}\${cssAppend};
      }
    \`;

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
`;

function replaceWithCIFonts() {
  console.log('[CI Build] Replacing Google Fonts with system fonts...');
  
  // Backup original file
  const originalContent = fs.readFileSync(FONT_PROVIDER_PATH, 'utf8');
  fs.writeFileSync(BACKUP_PATH, originalContent, 'utf8');
  
  // Replace with CI version
  fs.writeFileSync(FONT_PROVIDER_PATH, CI_FONT_CONTENT, 'utf8');
  
  console.log('[CI Build] Font provider replaced successfully');
}

function restoreOriginalFonts() {
  console.log('[CI Build] Restoring original font provider...');
  
  if (fs.existsSync(BACKUP_PATH)) {
    const backupContent = fs.readFileSync(BACKUP_PATH, 'utf8');
    fs.writeFileSync(FONT_PROVIDER_PATH, backupContent, 'utf8');
    fs.unlinkSync(BACKUP_PATH);
    console.log('[CI Build] Font provider restored successfully');
  } else {
    console.log('[CI Build] No backup found, skipping restore');
  }
}

const command = process.argv[2];

if (command === 'replace') {
  replaceWithCIFonts();
} else if (command === 'restore') {
  restoreOriginalFonts();
} else {
  console.error('Usage: node ci-build.js [replace|restore]');
  process.exit(1);
}
