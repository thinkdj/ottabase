const sharedPreset = require('@ottabase/ui-tailwind/tailwind.base.cjs');

module.exports = {
    presets: [sharedPreset],
    content: [
        './app/**/*.{js,ts,jsx,tsx}',
        './components/**/*.{js,ts,jsx,tsx}',
        // include specific package sources for UI components
        '../../packages/ui-base/src/**/*.{js,ts,jsx,tsx}',
        '../../packages/ui-code-highlight/src/**/*.{js,ts,jsx,tsx}',
        '../../packages/ui-components/src/**/*.{js,ts,jsx,tsx}',
        '../../packages/ui-tailwind/src/**/*.{js,ts,jsx,tsx}',
        '../../packages/ui-shadcn/components/**/*.{js,ts,jsx,tsx}',
        '../../packages/ottaselect/src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                heading: ['var(--font-heading)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                handwriting: ['var(--font-handwriting)', 'cursive'],
            },
            colors: {
                border: 'hsl(var(--border) / <alpha-value>)',
                input: 'hsl(var(--input) / <alpha-value>)',
                ring: 'hsl(var(--ring) / <alpha-value>)',
                background: 'hsl(var(--background) / <alpha-value>)',
                foreground: 'hsl(var(--foreground) / <alpha-value>)',
                primary: {
                    DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
                    foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
                    foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
                    foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
                    foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
                    foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
                },
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            spacing: {
                'theme-section': 'var(--spacing-section)',
                'theme-card': 'var(--spacing-card)',
                'theme-element': 'var(--spacing-element)',
            },
        },
    },
};
