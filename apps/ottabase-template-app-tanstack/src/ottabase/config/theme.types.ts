export interface ThemeTypography {
    fontFamily: string;
    url?: string;
}

export interface ThemeColors {
    background: string;
    foreground: string;
    primary: string;
    'primary-foreground': string;
    secondary: string;
    'secondary-foreground': string;
    muted: string;
    'muted-foreground': string;
    accent: string;
    'accent-foreground': string;
    destructive: string;
    'destructive-foreground': string;
    border: string;
    input: string;
    ring: string;
}

export interface ThemeConfig {
    name: string;
    typography: {
        heading: ThemeTypography;
        body: ThemeTypography;
        handwriting: ThemeTypography;
    };
    colors: {
        light: ThemeColors;
        dark: ThemeColors;
    };
    spacing?: Record<string, string>; // e.g., { sm: "0.5rem" }
    radius?: string;
}
