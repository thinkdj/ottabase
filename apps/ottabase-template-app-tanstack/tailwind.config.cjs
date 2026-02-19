const sharedPreset = require('@ottabase/ui-tailwind/tailwind.base.cjs');

/**
 * TanStack template app – Tailwind config
 *
 * Inherits all design-token colours, shadows, motion, and fonts
 * from the shared preset (@ottabase/ui-tailwind).
 *
 * Only app-specific overrides (content paths, theme-aware spacing)
 * are declared here.
 */
module.exports = {
    presets: [sharedPreset],
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
        '../../packages/ui-base/src/**/*.{js,ts,jsx,tsx}',
        '../../packages/ui-code-highlight/src/**/*.{js,ts,jsx,tsx}',
        '../../packages/ui-components/src/**/*.{js,ts,jsx,tsx}',
        '../../packages/ui-tailwind/src/**/*.{js,ts,jsx,tsx}',
        '../../packages/ui-shadcn/components/**/*.{js,ts,jsx,tsx}',
        '../../packages/ottaselect/src/**/*.{js,ts,jsx,tsx}',
        '../../packages/spotlight/src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            /* Theme-aware spacing mapped from theme.loader CSS vars */
            spacing: {
                'theme-section': 'var(--spacing-section)',
                'theme-card': 'var(--spacing-card)',
                'theme-element': 'var(--spacing-element)',
            },
        },
    },
};
