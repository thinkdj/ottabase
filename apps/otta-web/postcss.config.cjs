module.exports = {
    plugins: {
        'tailwindcss/nesting': {},
        tailwindcss: {},
        autoprefixer: {},
        'postcss-preset-env': {
            features: {
                'nesting-rules': false,
                'is-pseudo-class': false,
            },
        },
    },
};
