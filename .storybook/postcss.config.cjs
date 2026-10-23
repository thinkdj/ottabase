const path = require('node:path');

const storybookTailwindConfig = path.resolve(__dirname, 'tailwind.config.cjs');

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
