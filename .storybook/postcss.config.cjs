const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const storybookTailwindConfig = path.resolve(__dirname, 'tailwind.config.cjs');
const fallbackTailwindConfig = path.resolve(projectRoot, 'apps/ottabase-template-app/tailwind.config.cjs');

module.exports = {
    plugins: {
        'tailwindcss/nesting': {},
        tailwindcss: {
            config: process.env.TAILWIND_CONFIG || storybookTailwindConfig,
        },
        autoprefixer: {},
        'postcss-preset-env': {
            features: {
                'nesting-rules': false,
            },
        },
        'postcss-preset-mantine': {
            autoRem: true,
        },
        'postcss-simple-vars': {
            variables: {
                'mantine-breakpoint-xs': '36em',
                'mantine-breakpoint-sm': '48em',
                'mantine-breakpoint-md': '62em',
                'mantine-breakpoint-lg': '75em',
                'mantine-breakpoint-xl': '88em',
            },
        },
    },
};
