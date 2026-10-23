const path = require('node:path');

module.exports = {
    plugins: {
        // Scan from .storybook (not the repo root); tailwind.css names the package and app sources.
        '@tailwindcss/postcss': { base: __dirname },
        // Tailwind 3's space-x/space-y placement, which the layouts were built against
        [path.resolve(__dirname, '../packages/ui-tailwind/space-compat.cjs')]: {},
    },
};
