import type { DocsTheme } from '../types';

/**
 * Technical theme - Structured, precise, developer-focused
 */
export const technicalTheme: DocsTheme = {
  name: 'technical',

  typography: {
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontFamilyMonospace: '"JetBrains Mono", "Fira Code", Menlo, Monaco, monospace',
    headingFontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '12px',
      sm: '13px',
      md: '15px',
      lg: '17px',
      xl: '19px',
    },
    lineHeight: {
      tight: 1.4,
      normal: 1.7,
      relaxed: 1.9,
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  spacing: {
    density: 'comfortable',
    contentWidth: '800px',
    sidebarWidth: '280px',
    tocWidth: '240px',
    spacing: {
      xs: '6px',
      sm: '10px',
      md: '18px',
      lg: '28px',
      xl: '36px',
    },
    padding: {
      page: '40px',
      section: '20px',
      card: '18px',
    },
  },

  colors: {
    primary: '#0070f3',
    primaryLight: '#3291ff',
    primaryDark: '#0761d1',

    success: '#0cce6b',
    warning: '#f5a623',
    error: '#ee0000',
    info: '#0070f3',

    background: {
      light: '#fafafa',
      dark: '#0a0a0a',
    },
    surface: {
      light: '#ffffff',
      dark: '#111111',
    },
    elevated: {
      light: '#ffffff',
      dark: '#1a1a1a',
    },

    text: {
      primary: {
        light: '#1a1a1a',
        dark: '#ededed',
      },
      secondary: {
        light: '#666666',
        dark: '#a0a0a0',
      },
      tertiary: {
        light: '#999999',
        dark: '#707070',
      },
    },

    border: {
      light: '#eaeaea',
      dark: '#333333',
    },

    codeBackground: {
      light: '#fafafa',
      dark: '#161616',
    },
  },

  radius: {
    sm: '6px',
    md: '8px',
    lg: '10px',
    xl: '14px',
  },

  shadows: {
    sm: '0 2px 4px rgba(0, 0, 0, 0.06)',
    md: '0 4px 8px rgba(0, 0, 0, 0.1)',
    lg: '0 8px 16px rgba(0, 0, 0, 0.15)',
    xl: '0 12px 24px rgba(0, 0, 0, 0.2)',
  },

  designLanguage: {
    sidebarStyle: 'bordered',
    headingStyle: 'underlined',
    codeBlockStyle: 'elevated',
    linkStyle: 'underlined',
  },
};
