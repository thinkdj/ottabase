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
    },
};
