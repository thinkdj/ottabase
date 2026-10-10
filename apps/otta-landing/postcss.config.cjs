module.exports = {
    plugins: {
        'tailwindcss/nesting': {},
        tailwindcss: {},
        autoprefixer: {},
        'postcss-preset-env': {
            features: {
                'nesting-rules': false, // Disable nesting as we're using tailwindcss/nesting
            },
        },
    },
};
