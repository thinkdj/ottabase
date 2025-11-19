export interface DocsThemeTypography {
  fontFamily: string;
  fontFamilyMonospace: string;
  headingFontFamily?: string;
  fontSize: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
  fontWeight: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
}

export interface DocsThemeSpacing {
  density: 'compact' | 'comfortable' | 'spacious';
  contentWidth: string;
  sidebarWidth: string;
  tocWidth: string;
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  padding: {
    page: string;
    section: string;
    card: string;
  };
}

export interface DocsThemeColors {
  // Primary colors
  primary: string;
  primaryLight: string;
  primaryDark: string;

  // Semantic colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // Background colors
  background: {
    light: string;
    dark: string;
  };
  surface: {
    light: string;
    dark: string;
  };
  elevated: {
    light: string;
    dark: string;
  };

  // Text colors
  text: {
    primary: {
      light: string;
      dark: string;
    };
    secondary: {
      light: string;
      dark: string;
    };
    tertiary: {
      light: string;
      dark: string;
    };
  };

  // Border colors
  border: {
    light: string;
    dark: string;
  };

  // Code block colors
  codeBackground: {
    light: string;
    dark: string;
  };
}

export interface DocsThemeRadius {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface DocsThemeShadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface DocsTheme {
  name: string;
  typography: DocsThemeTypography;
  spacing: DocsThemeSpacing;
  colors: DocsThemeColors;
  radius: DocsThemeRadius;
  shadows: DocsThemeShadows;
  // Design language specific
  designLanguage: {
    // Sidebar styling
    sidebarStyle: 'minimal' | 'bordered' | 'filled';
    // Heading style
    headingStyle: 'plain' | 'underlined' | 'accented';
    // Code block style
    codeBlockStyle: 'minimal' | 'bordered' | 'elevated';
    // Link style
    linkStyle: 'underlined' | 'colored' | 'subtle';
  };
}
