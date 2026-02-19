import type { MantineThemeOverride } from '@mantine/core';

// Mantine Theme Configuration Types
export interface MantineThemeConfig {
    // Core theme selection - uses theme from packages/ui-core/themes/
    baseTheme: 'mantine-slate' | 'mantine-graphite' | 'mantine-azure' | 'mantine-aurora' | string;

    // App-specific overrides
    primaryColor?: string;
    primaryShade?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

    // Typography overrides
    fontFamily?: string;
    headingsFontFamily?: string;
    headingsFontWeight?: string;

    // Color overrides - extends or overrides base theme colors
    colors?: Partial<Record<string, [string, string, string, string, string, string, string, string, string, string]>>;

    // Radius overrides
    defaultRadius?: number;
    radius?: {
        xs?: string;
        sm?: string;
        md?: string;
        lg?: string;
        xl?: string;
    };

    // Spacing overrides
    spacing?: {
        xs?: string;
        sm?: string;
        md?: string;
        lg?: string;
        xl?: string;
    };

    // Shadow overrides
    shadows?: {
        xs?: string;
        sm?: string;
        md?: string;
        lg?: string;
        xl?: string;
    };

    // Component-specific overrides
    components?: {
        [componentName: string]: {
            defaultProps?: Record<string, any>;
            styles?: Record<string, any>;
        };
    };

    // App-specific design tokens
    designTokens?: {
        brandGradient?: string;
        brandBlur?: string;
        brandTransition?: string;
        [key: string]: any;
    };
}

/**
 * Creates a Mantine theme override by merging a base theme with app-specific configuration
 *
 * @param config - App-specific Mantine theme configuration
 * @param baseThemeOverride - Base theme from packages/ui-core/themes/
 * @returns Complete MantineThemeOverride for the app
 */
export function createMantineTheme(
    config: MantineThemeConfig,
    baseThemeOverride: MantineThemeOverride,
): MantineThemeOverride {
    const {
        primaryColor,
        primaryShade,
        fontFamily,
        headingsFontFamily,
        headingsFontWeight,
        colors,
        defaultRadius,
        radius,
        spacing,
        shadows,
        components,
        designTokens,
    } = config;

    // Deep merge function for component styles
    const mergeComponents = (base: any, override: any) => {
        if (!base && !override) return undefined;
        if (!base) return override;
        if (!override) return base;

        const merged: any = { ...base };

        Object.keys(override).forEach((componentName) => {
            if (!merged[componentName]) {
                merged[componentName] = override[componentName];
            } else {
                merged[componentName] = {
                    ...merged[componentName],
                    ...override[componentName],
                    defaultProps: {
                        ...merged[componentName]?.defaultProps,
                        ...override[componentName]?.defaultProps,
                    },
                    styles: override[componentName]?.styles || merged[componentName]?.styles,
                };
            }
        });

        return merged;
    };

    // Create the merged theme
    const mergedTheme: MantineThemeOverride = {
        ...baseThemeOverride,

        // Override core properties if provided
        ...(primaryColor && { primaryColor }),
        ...(primaryShade && { primaryShade }),
        ...(fontFamily && { fontFamily }),
        ...(defaultRadius !== undefined && { defaultRadius }),

        // Override headings if provided
        ...((headingsFontFamily || headingsFontWeight) && {
            headings: {
                ...baseThemeOverride.headings,
                ...(headingsFontFamily && { fontFamily: headingsFontFamily }),
                ...(headingsFontWeight && { fontWeight: headingsFontWeight }),
            },
        }),

        // Merge colors
        ...(colors && {
            colors: {
                ...baseThemeOverride.colors,
                ...colors,
            },
        }),

        // Override radius if provided
        ...(radius && {
            radius: {
                ...baseThemeOverride.radius,
                ...radius,
            },
        }),

        // Override spacing if provided
        ...(spacing && {
            spacing: {
                ...baseThemeOverride.spacing,
                ...spacing,
            },
        }),

        // Override shadows if provided
        ...(shadows && {
            shadows: {
                ...baseThemeOverride.shadows,
                ...shadows,
            },
        }),

        // Merge components
        components: mergeComponents(baseThemeOverride.components, components),

        // Merge other/design tokens
        other: {
            ...baseThemeOverride.other,
            ...designTokens,
        },
    };

    return mergedTheme;
}

/**
 * Validates a Mantine theme configuration
 * @param config - The theme configuration to validate
 * @returns Array of validation errors, empty if valid
 */
export function validateMantineThemeConfig(config: MantineThemeConfig): string[] {
    const errors: string[] = [];

    // Validate baseTheme
    if (!config.baseTheme) {
        errors.push('baseTheme is required');
    }

    // Validate primaryShade if provided
    if (config.primaryShade !== undefined && (config.primaryShade < 0 || config.primaryShade > 9)) {
        errors.push('primaryShade must be between 0 and 9');
    }

    // Validate colors format if provided
    if (config.colors) {
        Object.entries(config.colors).forEach(([colorName, colorArray]) => {
            if (!Array.isArray(colorArray) || colorArray.length !== 10) {
                errors.push(`Color '${colorName}' must be an array of exactly 10 hex colors`);
            } else {
                colorArray.forEach((color, index) => {
                    if (typeof color !== 'string' || !color.match(/^#[0-9a-fA-F]{6}$/)) {
                        errors.push(`Color '${colorName}[${index}]' must be a valid hex color (e.g., #ffffff)`);
                    }
                });
            }
        });
    }

    return errors;
}
