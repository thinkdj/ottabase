import type { MantineThemeConfig } from '@ottabase/ui-mantine';

/**
 * Mantine theme configuration for the Ottabase Template App
 *
 * This configuration extends the base mantine-slate theme from packages/ui-mantine/themes
 * with app-specific customizations for the template app's visual design language.
 */
export const mantineThemeConfig: MantineThemeConfig = {
    // Use the slate base theme as foundation
    baseTheme: 'mantine-slate',

    // App-specific brand colors
    primaryColor: 'blue',
    primaryShade: 6,

    // Custom brand colors that extend the base theme
    colors: {
        // Template app's brand color palette
        brand: [
            '#f0f9ff', // lightest
            '#e0f2fe',
            '#bae6fd',
            '#7dd3fc',
            '#38bdf8',
            '#0ea5e9', // primary (shade 5)
            '#0284c7', // primary (shade 6)
            '#0369a1',
            '#075985',
            '#0c4a6e', // darkest
        ],

        // Secondary accent color for the template app
        accent: [
            '#fdf4ff',
            '#fae8ff',
            '#f5d0fe',
            '#f0abfc',
            '#e879f9',
            '#d946ef',
            '#c026d3',
            '#a21caf',
            '#86198f',
            '#701a75',
        ],
    },

    // App-specific component customizations
    components: {
        // Customize buttons for template app
        Button: {
            defaultProps: {
                radius: 'md',
            },
            styles: (theme: any) => ({
                root: {
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        transform: 'translateY(-1px)',
                    },
                },
                filled: {
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                    border: 'none',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    },
                },
            }),
        },

        // Template app specific card styling
        Card: {
            defaultProps: {
                shadow: 'sm',
                radius: 'md',
                withBorder: true,
            },
            styles: (theme: any) => ({
                root: {
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                        transform: 'translateY(-2px)',
                    },
                },
            }),
        },

        // Template app navigation styling
        Navbar: {
            styles: (theme: any) => ({
                root: {
                    backgroundColor: 'var(--mantine-color-body)',
                    backdropFilter: 'blur(10px)',
                    borderRight: `1px solid var(--mantine-color-default-border)`,
                    opacity: 0.95,
                },
            }),
        },
    },

    // Template app specific design tokens
    designTokens: {
        // Brand gradient for hero sections
        brandGradient: 'linear-gradient(135deg, #0ea5e9 0%, #d946ef 100%)',

        // Glass morphism effect
        glassMorphism: 'rgba(255, 255, 255, 0.25)',
        glassBlur: 'blur(10px)',

        // Template app transitions
        brandTransition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',

        // Custom shadows for the template app
        brandShadow: '0 25px 50px -12px rgba(14, 165, 233, 0.25)',

        // Template app specific spacing
        heroSpacing: '120px',
        sectionSpacing: '80px',
    },
};

export default mantineThemeConfig;
