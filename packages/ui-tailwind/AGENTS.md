# @ottabase/ui-tailwind — agent notes

Shared Tailwind preset + base CSS wiring shadcn theme tokens to utilities. Full docs: ./README.md

## Use when

- Tailwind setup in an app/Storybook: darkMode `['class']`, token colors/radii/fonts/shadows/prose, forms/typography/animate plugins.
- NOT for React components (@ottabase/ui-shadcn, @ottabase/ui-components) or defining theme vars (theme.loader/shadcn.css elsewhere).

## Canonical usage

    // tailwind.config.cjs (adapted from apps/otta-web); dep as workspace:*
    const sharedPreset = require('@ottabase/ui-tailwind/tailwind.base.cjs');
    module.exports = { presets: [sharedPreset], content: ['./src/**/*.{js,ts,jsx,tsx}', '../../packages/ui-tailwind/src/**/*.{js,ts,jsx,tsx}'] };
    /* app global CSS */
    @import '@ottabase/ui-tailwind/styles/tailwind.base.css';

## Gotchas

- No JS index/exports map — consume only via the two file paths above.
- Colors are `hsl(var(--x))` refs: the app's shadcn theme CSS vars must load or utilities render nothing.
- Consumer declares peer deps (all `catalog:`): tailwindcss, tailwindcss-animate, postcss, @tailwindcss/forms, @tailwindcss/typography, postcss-preset-mantine. Bare `prose` is token-driven; add `dark:prose-invert` for class-toggled dark mode.
