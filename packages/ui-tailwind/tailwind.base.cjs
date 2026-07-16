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

/* helper – font-size step backed by theme vars with stock-value fallbacks.
 * letterSpacing falls back to `inherit` (= no declaration) so parent tracking
 * utilities keep cascading when a theme doesn't define per-step tracking. */
const textStep = (step, size, lineHeight) => [
    `var(--text-${step}, ${size})`,
    {
        lineHeight: `var(--text-${step}-lh, ${lineHeight})`,
        letterSpacing: `var(--text-${step}-ls, inherit)`,
    },
];

module.exports = {
    darkMode: ['class'],
    theme: {
        extend: {
            colors: {
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

                /* dialog/sheet/drawer scrim (bg-overlay/80 replaces bg-black/80) */
                overlay: hslVar('overlay'),
            },

            /* Radius scale: themes may set per-size --radius-{size}; the calc
             * chain over the scalar --radius stays as the fallback, so scalar-
             * only themes render exactly as before. `full` becomes themeable
             * (e.g. Visited sets --radius-full: 2px — no pills anywhere). */
            borderRadius: {
                DEFAULT: 'var(--radius-sm, calc(var(--radius) - 4px))',
                sm: 'var(--radius-sm, calc(var(--radius) - 4px))',
                md: 'var(--radius-md, calc(var(--radius) - 2px))',
                lg: 'var(--radius-lg, var(--radius))',
                xl: 'var(--radius-xl, calc(var(--radius) + 4px))',
                '2xl': 'var(--radius-2xl, calc(var(--radius) + 8px))',
                full: 'var(--radius-full, 9999px)',
            },

            fontFamily: {
                sans: ['var(--font-body)', ...defaultTheme.fontFamily.sans],
                heading: ['var(--font-heading)', ...defaultTheme.fontFamily.sans],
                handwriting: ['var(--font-handwriting)', 'cursive'],
                mono: ['var(--font-mono)', ...defaultTheme.fontFamily.mono],
            },

            /* Type scale: every text-{step} utility reads --text-{step} with the
             * stock Tailwind value as fallback — themes redefine the whole app's
             * type ramp (incl. fluid clamp() values) without touching call sites. */
            fontSize: {
                xs: textStep('xs', '0.75rem', '1rem'),
                sm: textStep('sm', '0.875rem', '1.25rem'),
                base: textStep('base', '1rem', '1.5rem'),
                lg: textStep('lg', '1.125rem', '1.75rem'),
                xl: textStep('xl', '1.25rem', '1.75rem'),
                '2xl': textStep('2xl', '1.5rem', '2rem'),
                '3xl': textStep('3xl', '1.875rem', '2.25rem'),
                '4xl': textStep('4xl', '2.25rem', '2.5rem'),
                '5xl': textStep('5xl', '3rem', '1'),
                '6xl': textStep('6xl', '3.75rem', '1'),
                '7xl': textStep('7xl', '4.5rem', '1'),
                '8xl': textStep('8xl', '6rem', '1'),
                '9xl': textStep('9xl', '8rem', '1'),
            },

            /* Border chrome: bare `border` (and divide-*) width becomes themeable */
            borderWidth: {
                DEFAULT: 'var(--border-width, 1px)',
                strong: 'var(--border-width-strong, 2px)',
            },

            /* Z-index ladder (adopted by overlay components; themes may re-stack) */
            zIndex: {
                header: 'var(--z-header, 40)',
                sticky: 'var(--z-sticky, 30)',
                dropdown: 'var(--z-dropdown, 50)',
                overlay: 'var(--z-overlay, 50)',
                modal: 'var(--z-modal, 50)',
                popover: 'var(--z-popover, 50)',
                toast: 'var(--z-toast, 100)',
            },

            /* Prose (article) typography wired to design tokens instead of a
             * static gray palette. Bare `prose` becomes theme-adaptive: it
             * flips with light/dark and inherits brand colours. Consumers use
             * `prose dark:prose-invert` — the `invert` modifier remaps the same
             * `--tw-prose-*` variables to their `-dark` counterparts below. */
            typography: {
                DEFAULT: {
                    css: {
                        '--tw-prose-body': 'hsl(var(--foreground))',
                        '--tw-prose-headings': 'hsl(var(--foreground))',
                        '--tw-prose-lead': 'hsl(var(--muted-foreground))',
                        '--tw-prose-links': 'hsl(var(--primary))',
                        '--tw-prose-bold': 'hsl(var(--foreground))',
                        '--tw-prose-counters': 'hsl(var(--muted-foreground))',
                        '--tw-prose-bullets': 'hsl(var(--border))',
                        '--tw-prose-hr': 'hsl(var(--border))',
                        '--tw-prose-quotes': 'hsl(var(--foreground))',
                        '--tw-prose-quote-borders': 'hsl(var(--border))',
                        '--tw-prose-captions': 'hsl(var(--muted-foreground))',
                        '--tw-prose-code': 'hsl(var(--foreground))',
                        '--tw-prose-pre-code': 'hsl(var(--muted-foreground))',
                        '--tw-prose-pre-bg': 'hsl(var(--muted))',
                        '--tw-prose-th-borders': 'hsl(var(--border))',
                        '--tw-prose-td-borders': 'hsl(var(--border))',
                        /* `dark:prose-invert` reads these; keep them identical so
                         * a manually-toggled .dark class stays token-driven. */
                        '--tw-prose-invert-body': 'hsl(var(--foreground))',
                        '--tw-prose-invert-headings': 'hsl(var(--foreground))',
                        '--tw-prose-invert-lead': 'hsl(var(--muted-foreground))',
                        '--tw-prose-invert-links': 'hsl(var(--primary))',
                        '--tw-prose-invert-bold': 'hsl(var(--foreground))',
                        '--tw-prose-invert-counters': 'hsl(var(--muted-foreground))',
                        '--tw-prose-invert-bullets': 'hsl(var(--border))',
                        '--tw-prose-invert-hr': 'hsl(var(--border))',
                        '--tw-prose-invert-quotes': 'hsl(var(--foreground))',
                        '--tw-prose-invert-quote-borders': 'hsl(var(--border))',
                        '--tw-prose-invert-captions': 'hsl(var(--muted-foreground))',
                        '--tw-prose-invert-code': 'hsl(var(--foreground))',
                        '--tw-prose-invert-pre-code': 'hsl(var(--muted-foreground))',
                        '--tw-prose-invert-pre-bg': 'hsl(var(--muted))',
                        '--tw-prose-invert-th-borders': 'hsl(var(--border))',
                        '--tw-prose-invert-td-borders': 'hsl(var(--border))',
                    },
                },
            },

            boxShadow: {
                /* bare `shadow` previously escaped the token system (stock value) */
                DEFAULT: 'var(--shadow-sm)',
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
                DEFAULT: 'var(--duration-normal)',
                fast: 'var(--duration-fast)',
                normal: 'var(--duration-normal)',
                slow: 'var(--duration-slow)',
                press: 'var(--duration-press, var(--duration-fast))',
            },
            transitionTimingFunction: {
                DEFAULT: 'var(--ease)',
                theme: 'var(--ease)',
                'theme-enter': 'var(--ease-enter)',
                'theme-exit': 'var(--ease-exit)',
                spring: 'var(--ease-spring)',
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
                /* input-otp caret (was referenced by animate-caret-blink with no keyframes) */
                'caret-blink': {
                    '0%,70%,100%': { opacity: '1' },
                    '20%,50%': { opacity: '0' },
                },
            },
            animation: {
                'accordion-down': 'accordion-down var(--duration-normal) var(--ease)',
                'accordion-up': 'accordion-up var(--duration-normal) var(--ease)',
                'caret-blink': 'caret-blink 1.25s ease-out infinite',
            },
        },
    },
    plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography'), require('tailwindcss-animate')],
};
