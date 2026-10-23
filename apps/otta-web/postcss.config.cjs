module.exports = {
    plugins: {
        // Tailwind v4 handles imports, nesting and vendor prefixes itself
        '@tailwindcss/postcss': {},
        // Tailwind 3's space-x/space-y placement, which the layouts were built against (see the plugin)
        '@ottabase/ui-tailwind/space-compat.cjs': {},
    },
};
