const defaultTheme = require('tailwindcss/defaultTheme');

/**
 * Ottabase shared Tailwind preset
 *
 * Maps every CSS custom-property produced by the theme engine
 * (shadcn.css defaults + theme.loader.ts runtime overrides)
 * into Tailwind utility classes.
 *
 * Colour values are kept as raw HSL channels so the
 * `/ <alpha-value>` opacity modifier works everywhere.
 */

/* helper – wraps an HSL variable with alpha support */
const hslVar = (name) => `hsl(var(--${name}) / <alpha-value>)`;

module.exports = {
    darkMode: ['class'],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#f5fbff',
                    500: '#0ea5a5',
                    700: '#0b7b7b',
                },

                /* core surfaces */
                border: hslVar('border'),
                input: hslVar('input'),
                ring: hslVar('ring'),
                background: hslVar('background'),
                foreground: hslVar('foreground'),

                /* semantic pairs */
                primary: { DEFAULT: hslVar('primary'), foreground: hslVar('primary-foreground') },
                secondary: { DEFAULT: hslVar('secondary'), foreground: hslVar('secondary-foreground') },
                destructive: { DEFAULT: hslVar('destructive'), foreground: hslVar('destructive-foreground') },
                muted: { DEFAULT: hslVar('muted'), foreground: hslVar('muted-foreground') },
                accent: { DEFAULT: hslVar('accent'), foreground: hslVar('accent-foreground') },

                /* layered surfaces */
                popover: { DEFAULT: hslVar('popover'), foreground: hslVar('popover-foreground') },
                card: { DEFAULT: hslVar('card'), foreground: hslVar('card-foreground') },

                /* status feedback */
                success: { DEFAULT: hslVar('success'), foreground: hslVar('success-foreground') },
                warning: { DEFAULT: hslVar('warning'), foreground: hslVar('warning-foreground') },
                info: { DEFAULT: hslVar('info'), foreground: hslVar('info-foreground') },

                /* sidebar chrome */
                sidebar: {
                    DEFAULT: hslVar('sidebar-background'),
                    foreground: hslVar('sidebar-foreground'),
                    border: hslVar('sidebar-border'),
                    accent: hslVar('sidebar-accent'),
                    'accent-foreground': hslVar('sidebar-accent-foreground'),
                    ring: hslVar('sidebar-ring'),
                },

                /* data-viz palette (5 slots) */
                'chart-1': hslVar('chart-1'),
                'chart-2': hslVar('chart-2'),
                'chart-3': hslVar('chart-3'),
                'chart-4': hslVar('chart-4'),
                'chart-5': hslVar('chart-5'),
            },

            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },

            fontFamily: {
                sans: ['var(--font-body)', ...defaultTheme.fontFamily.sans],
                heading: ['var(--font-heading)', ...defaultTheme.fontFamily.sans],
                handwriting: ['var(--font-handwriting)', 'cursive'],
            },

            boxShadow: {
                xs: 'var(--shadow-xs)',
                sm: 'var(--shadow-sm)',
                md: 'var(--shadow-md)',
                lg: 'var(--shadow-lg)',
                xl: 'var(--shadow-xl)',
            },

            spacing: {
                section: 'var(--spacing-section)',
                card: 'var(--spacing-card)',
                element: 'var(--spacing-element)',
            },

            transitionDuration: {
                fast: 'var(--duration-fast)',
                normal: 'var(--duration-normal)',
                slow: 'var(--duration-slow)',
            },
            transitionTimingFunction: {
                theme: 'var(--ease)',
                'theme-enter': 'var(--ease-enter)',
                'theme-exit': 'var(--ease-exit)',
            },

            keyframes: {
                'accordion-down': {
                    from: { height: 0 },
                    to: { height: 'var(--radix-accordion-content-height)' },
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: 0 },
                },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
            },
        },
    },
    plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography'), require('tailwindcss-animate')],
};
