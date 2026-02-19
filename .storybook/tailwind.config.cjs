const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

module.exports = {
    presets: [require(path.resolve(projectRoot, 'packages/ui-tailwind/tailwind.base.cjs'))],
    content: [
        // Storybook files (specific to avoid node_modules)
        path.resolve(__dirname, '*.{js,ts,jsx,tsx,mdx}'),
        // All package sources
        path.resolve(projectRoot, 'packages/*/src/**/*.{js,ts,jsx,tsx}'),
        path.resolve(projectRoot, 'packages/*/provider/**/*.{js,ts,jsx,tsx}'),
        // All app sources
        path.resolve(projectRoot, 'apps/*/app/**/*.{js,ts,jsx,tsx}'),
        path.resolve(projectRoot, 'apps/*/components/**/*.{js,ts,jsx,tsx}'),
        path.resolve(projectRoot, 'apps/*/ottabase/**/*.{js,ts,jsx,tsx}'),
        // Story files (specific paths to avoid node_modules)
        path.resolve(projectRoot, 'packages/*/src/**/*.stories.{js,ts,jsx,tsx}'),
        path.resolve(projectRoot, 'apps/*/app/**/*.stories.{js,ts,jsx,tsx}'),
        path.resolve(projectRoot, 'apps/*/components/**/*.stories.{js,ts,jsx,tsx}'),
        path.resolve(projectRoot, 'apps/*/ottabase/**/*.stories.{js,ts,jsx,tsx}'),
    ],
    darkMode: ['class'],
    theme: {
        extend: {
            // Ensure we have proper color transitions for dark mode
            transitionProperty: {
                colors: 'color, background-color, border-color, text-decoration-color, fill, stroke',
            },
        },
    },
};
