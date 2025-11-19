import type { DocsTheme } from '../types';

/**
 * Notion-inspired theme - Clean, minimal, and elegant
 */
export const notionTheme: DocsTheme = {
  name: 'notion',

  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
    fontFamilyMonospace: 'Menlo, Monaco, "Courier New", monospace',
    headingFontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    fontSize: {
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '20px',
    },
    lineHeight: {
      tight: 1.3,
      normal: 1.6,
      relaxed: 1.8,
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
    contentWidth: '720px',
    sidebarWidth: '260px',
    tocWidth: '220px',
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
    padding: {
      page: '48px',
      section: '24px',
      card: '16px',
    },
  },

  colors: {
    primary: '#0084ff',
    primaryLight: '#4da6ff',
    primaryDark: '#0066cc',

    success: '#00c969',
    warning: '#ffaa00',
    error: '#ff3b30',
    info: '#0084ff',

    background: {
      light: '#ffffff',
      dark: '#191919',
    },
    surface: {
      light: '#f7f7f7',
      dark: '#202020',
    },
    elevated: {
      light: '#ffffff',
      dark: '#2a2a2a',
    },

    text: {
      primary: {
        light: '#2e2e2e',
        dark: '#ebebeb',
      },
      secondary: {
        light: '#6e6e6e',
        dark: '#afafaf',
      },
      tertiary: {
        light: '#9e9e9e',
        dark: '#7e7e7e',
      },
    },

    border: {
      light: '#e5e5e5',
      dark: '#3a3a3a',
    },

    codeBackground: {
      light: '#f7f7f7',
      dark: '#2a2a2a',
    },
  },

  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
  },

  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 2px 4px rgba(0, 0, 0, 0.08)',
    lg: '0 4px 8px rgba(0, 0, 0, 0.12)',
    xl: '0 8px 16px rgba(0, 0, 0, 0.15)',
  },

  designLanguage: {
    sidebarStyle: 'minimal',
    headingStyle: 'plain',
    codeBlockStyle: 'minimal',
    linkStyle: 'colored',
  },
};
