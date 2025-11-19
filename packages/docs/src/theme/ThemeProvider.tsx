import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import type { DocsTheme } from './types';
import { notionTheme } from './presets/notion';

interface ThemeContextValue {
  theme: DocsTheme;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: notionTheme });

export interface DocsThemeProviderProps {
  children: ReactNode;
  theme?: DocsTheme;
}

export function DocsThemeProvider({ children, theme = notionTheme }: DocsThemeProviderProps) {
  useEffect(() => {
    // Apply CSS variables
    const root = document.documentElement;

    // Typography
    root.style.setProperty('--docs-font-family', theme.typography.fontFamily);
    root.style.setProperty('--docs-font-family-mono', theme.typography.fontFamilyMonospace);
    if (theme.typography.headingFontFamily) {
      root.style.setProperty('--docs-font-family-heading', theme.typography.headingFontFamily);
    }

    // Font sizes
    Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
      root.style.setProperty(`--docs-font-size-${key}`, value);
    });

    // Line heights
    Object.entries(theme.typography.lineHeight).forEach(([key, value]) => {
      root.style.setProperty(`--docs-line-height-${key}`, value.toString());
    });

    // Font weights
    Object.entries(theme.typography.fontWeight).forEach(([key, value]) => {
      root.style.setProperty(`--docs-font-weight-${key}`, value.toString());
    });

    // Spacing
    root.style.setProperty('--docs-content-width', theme.spacing.contentWidth);
    root.style.setProperty('--docs-sidebar-width', theme.spacing.sidebarWidth);
    root.style.setProperty('--docs-toc-width', theme.spacing.tocWidth);

    Object.entries(theme.spacing.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--docs-spacing-${key}`, value);
    });

    Object.entries(theme.spacing.padding).forEach(([key, value]) => {
      root.style.setProperty(`--docs-padding-${key}`, value);
    });

    // Colors - Background
    root.style.setProperty('--docs-bg-light', theme.colors.background.light);
    root.style.setProperty('--docs-bg-dark', theme.colors.background.dark);
    root.style.setProperty('--docs-surface-light', theme.colors.surface.light);
    root.style.setProperty('--docs-surface-dark', theme.colors.surface.dark);
    root.style.setProperty('--docs-elevated-light', theme.colors.elevated.light);
    root.style.setProperty('--docs-elevated-dark', theme.colors.elevated.dark);

    // Colors - Text
    root.style.setProperty('--docs-text-primary-light', theme.colors.text.primary.light);
    root.style.setProperty('--docs-text-primary-dark', theme.colors.text.primary.dark);
    root.style.setProperty('--docs-text-secondary-light', theme.colors.text.secondary.light);
    root.style.setProperty('--docs-text-secondary-dark', theme.colors.text.secondary.dark);
    root.style.setProperty('--docs-text-tertiary-light', theme.colors.text.tertiary.light);
    root.style.setProperty('--docs-text-tertiary-dark', theme.colors.text.tertiary.dark);

    // Colors - Border
    root.style.setProperty('--docs-border-light', theme.colors.border.light);
    root.style.setProperty('--docs-border-dark', theme.colors.border.dark);

    // Colors - Code
    root.style.setProperty('--docs-code-bg-light', theme.colors.codeBackground.light);
    root.style.setProperty('--docs-code-bg-dark', theme.colors.codeBackground.dark);

    // Colors - Semantic
    root.style.setProperty('--docs-primary', theme.colors.primary);
    root.style.setProperty('--docs-success', theme.colors.success);
    root.style.setProperty('--docs-warning', theme.colors.warning);
    root.style.setProperty('--docs-error', theme.colors.error);
    root.style.setProperty('--docs-info', theme.colors.info);

    // Radius
    Object.entries(theme.radius).forEach(([key, value]) => {
      root.style.setProperty(`--docs-radius-${key}`, value);
    });

    // Shadows
    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--docs-shadow-${key}`, value);
    });

    // Design language flags
    root.setAttribute('data-docs-sidebar-style', theme.designLanguage.sidebarStyle);
    root.setAttribute('data-docs-heading-style', theme.designLanguage.headingStyle);
    root.setAttribute('data-docs-code-style', theme.designLanguage.codeBlockStyle);
    root.setAttribute('data-docs-link-style', theme.designLanguage.linkStyle);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>;
}

export function useDocsTheme() {
  return useContext(ThemeContext);
}
