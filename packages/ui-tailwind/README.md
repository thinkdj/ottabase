# @ottabase/ui-tailwind

Shared **Tailwind CSS preset** and base styles for Ottabase apps. The preset maps theme CSS variables (shadcn-style HSL
tokens, radii, fonts, charts, sidebar, etc.) to Tailwind utilities and registers common plugins so Vite/Next apps stay
aligned.

## Usage

**1. Tailwind config** — use the preset as the single source for `theme.extend`, `darkMode`, and plugins:

```js
// tailwind.config.cjs
const sharedPreset = require('@ottabase/ui-tailwind/tailwind.base.cjs');

module.exports = {
    darkMode: sharedPreset.darkMode,
    presets: [sharedPreset],
    content: [
        './src/**/*.{js,ts,jsx,tsx}',
        '../../packages/ui-tailwind/src/**/*.{js,ts,jsx,tsx}',
        // …other workspace paths that use Tailwind classes
    ],
};
```

**2. Global CSS** — pull in the base `@tailwind` layers (adjust path if your bundler resolves the package differently):

```css
@import '@ottabase/ui-tailwind/styles/tailwind.base.css';
```

**3. Runtime** — load your app’s theme CSS (e.g. shadcn variables + `theme.loader` overrides) _before_ or alongside the
above so the preset’s `hsl(var(--…))` references resolve.

## Peer dependencies

Declare these in the consuming app (versions are usually taken from the monorepo `catalog:`):

- `tailwindcss`
- `tailwindcss-animate`
- `postcss`
- `@tailwindcss/forms`
- `@tailwindcss/typography`
- `postcss-preset-mantine`

The package also depends on `tailwind-merge` for class merging when used from TS/React layers that consume it.

## Tests

```bash
pnpm test --filter=@ottabase/ui-tailwind
```
