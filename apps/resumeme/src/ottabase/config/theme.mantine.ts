import type { MantineThemeConfig } from '@ottabase/ui-mantine';

/**
 * ResumeMe — Mantine theme configuration
 *
 * Clean, professional, neutral design language. Tight spacing, subtle borders,
 * high readability — inspired by modern SaaS productivity tools.
 */
export const mantineThemeConfig: MantineThemeConfig = {
    baseTheme: 'mantine-slate',

    // Neutral blue-gray primary — professional, not flashy
    primaryColor: 'brand',
    primaryShade: 6,

    colors: {
        // Professional blue-gray palette
        brand: [
            '#f8fafc',
            '#f1f5f9',
            '#e2e8f0',
            '#cbd5e1',
            '#94a3b8',
            '#64748b',
            '#475569', // primary (shade 6)
            '#334155',
            '#1e293b',
            '#0f172a',
        ],

        // Subtle accent for interactive elements
        accent: [
            '#eff6ff',
            '#dbeafe',
            '#bfdbfe',
            '#93c5fd',
            '#60a5fa',
            '#3b82f6',
            '#2563eb',
            '#1d4ed8',
            '#1e40af',
            '#1e3a8a',
        ],
    },

    components: {
        Button: {
            defaultProps: {
                radius: 'sm',
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            styles: (_theme: unknown) => ({
                root: {
                    fontWeight: '500',
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                },
            }),
        },

        Card: {
            defaultProps: {
                shadow: 'xs',
                radius: 'sm',
                withBorder: true,
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            styles: (_theme: unknown) => ({
                root: {
                    borderColor: 'var(--mantine-color-gray-2)',
                },
            }),
        },

        Navbar: {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            styles: (_theme: unknown) => ({
                root: {
                    backgroundColor: 'var(--mantine-color-body)',
                    borderRight: '1px solid var(--mantine-color-default-border)',
                },
            }),
        },

        Input: {
            defaultProps: {
                radius: 'sm',
            },
        },
    },

    designTokens: {
        brandGradient: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
        glassMorphism: 'rgba(255, 255, 255, 0.6)',
        glassBlur: 'blur(8px)',
        brandTransition: 'all 0.15s ease',
        brandShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        heroSpacing: '80px',
        sectionSpacing: '48px',
    },
};

export default mantineThemeConfig;
