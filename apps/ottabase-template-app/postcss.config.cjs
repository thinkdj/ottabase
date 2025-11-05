module.exports = {
  plugins: {
    "tailwindcss/nesting": {},
    tailwindcss: {},
    autoprefixer: {},
    "postcss-preset-env": {
      features: {
        "nesting-rules": false, // Disable nesting as we're using tailwindcss/nesting
      },
    },
    "postcss-preset-mantine": {
      autoRem: false, // Disabled to prevent conflicts with shadcn/ui and Tailwind
      // extend: https://mantine.dev/styles/postcss-preset/#custom-mixins
    },
    "postcss-simple-vars": {
      variables: {
        "mantine-breakpoint-xs": "36em",
        "mantine-breakpoint-sm": "48em",
        "mantine-breakpoint-md": "62em",
        "mantine-breakpoint-lg": "75em",
        "mantine-breakpoint-xl": "88em",
      },
    },
  },
};
