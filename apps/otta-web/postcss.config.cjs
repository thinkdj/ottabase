module.exports = {
    plugins: {
        // Tailwind v4: handles imports, nesting and vendor prefixes itself
        '@tailwindcss/postcss': {},
        'postcss-preset-mantine': {
            autoRem: false,
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
