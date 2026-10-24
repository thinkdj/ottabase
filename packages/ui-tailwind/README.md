# @ottabase/ui-tailwind

The shared **Tailwind CSS v4** entry for Ottabase apps. One stylesheet loads Tailwind, the typography plugin and
`tw-animate-css`, and maps the theme engine's CSS variables (shadcn-style HSL tokens, radii, fonts, the type scale,
shadows, charts, status tones, sidebar, motion) onto Tailwind utilities, so Vite and Next apps stay aligned.

There is no JavaScript preset and no `tailwind.config`: Tailwind 4 is configured in CSS.

## Usage

**1. PostCSS.** Tailwind 4 has its own PostCSS plugin and handles imports, nesting and vendor prefixes itself:

```js
// postcss.config.cjs
module.exports = {
    plugins: {
        '@tailwindcss/postcss': {},
        // optional: Tailwind 3's space-x/space-y placement (see "Space between" below)
        '@ottabase/ui-tailwind/space-compat.cjs': {},
    },
};
```

**2. Global CSS.** Import the shared stylesheet first, then the UI kit's tokens, then name the workspace packages whose
class names Tailwind must scan (it finds the app's own files itself, but not other packages):

```css
/* src/styles/globals.css */
@import '@ottabase/ui-tailwind/styles/tailwind.base.css';
@import '@ottabase/ui/styles.css';

@source '../../../../packages/ui/components';
@source '../../../../packages/ottablog/src';
/* a wildcard directory needs a file glob */
@source '../../../../packages/premium*/src/**/*.{js,ts,jsx,tsx}';
/* tests and stories hold regexes and fixture strings that would be read as class names */
@source not '../../../../packages/**/__tests__';
```

**3. Runtime.** Load the app's theme (the Brand Engine's tokens) before or alongside the above, so the `hsl(var(--…))`
references resolve.

## What it maps

Every token is declared in `@theme inline reference`:

- **`inline`**: a utility embeds the `var()` expression itself (`bg-primary` is `hsl(var(--primary))`), so a token
  resolves on the element that uses it and scoped overrides (`.dark`, a brand scope) keep working.
- **`reference`**: the keys are not emitted as `:root` variables. Several engine tokens share Tailwind's own names
  (`--radius-sm`, `--shadow-md`, `--text-base`, `--font-mono`, `--ease-spring`), so emitting them would shadow or
  self-reference the runtime values.

Colour tokens stay raw HSL channels, so opacity modifiers work: `bg-primary/50` is
`color-mix(in oklab, hsl(var(--primary)) 50%, transparent)`.

| Group     | Utilities                                                                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colours   | surfaces, semantic pairs, `primary-hover`, the `subtle`/`faint` text ladder, status tones (`bg-success-soft`), sidebar, charts, `overlay`                 |
| Radius    | `rounded`, `rounded-sm` to `rounded-2xl`, `rounded-full`: per-size `--radius-{size}` with a calc fallback                                                 |
| Type      | `text-xs` to `text-9xl` read `--text-{step}`, `--text-{step}-lh` and `--text-{step}-ls`; `font-sans/heading/mono`                                         |
| Elevation | `shadow`, `shadow-xs` to `shadow-xl` read `--shadow-*`                                                                                                    |
| Spacing   | `p-section`, `gap-card`, `m-element` (the app adds `p-theme-section` and friends)                                                                         |
| Motion    | `duration-fast/normal/slow/press/theme`, `ease-theme*`, `animate-accordion-*`, `animate-page-in`, `animate-shimmer`, plus `tw-animate-css`'s `animate-in` |
| Chrome    | bare `border`/`divide` width reads `--border-width`; `border-strong`; `z-header`…`z-toast`; theme-aware `prose`                                           |

Dark mode is class-based: `@custom-variant dark (&:is(.dark *))`.

Tailwind 4's own defaults are kept where the stylesheet does not override them: the colour palette (`bg-red-500`), the
spacing scale, `container`, breakpoints. A base layer restores three Tailwind 3 defaults that v4 dropped (borders are
`gray-200` until `@ottabase/ui`'s stylesheet points them at `--border`, placeholders are `gray-400`, enabled buttons
have the pointer cursor).

## Space between

Tailwind 3 put the `space-y-*` margin on the top of every sibling after the first; Tailwind 4 puts it on the bottom of
every child but the last. They agree for block children and differ when a child is inline or `inline-flex` (a bare
`<label>`, the UI kit's `Label`, a button rendered as a link, a badge): the margin lands on another side of the line box
and the gap under it comes out a few pixels short. Every stack in the apps was laid out against the v3 placement, so
`space-compat.cjs` rewrites v4's rules back to it. It is optional: without it nothing breaks, stacks holding inline
children are just a little tighter. New code should use flex or grid with `gap`.

## Tailwind 4 differences worth knowing

- **Responsive sizes keep `leading-*` and `tracking-*`.** In v3 a responsive `md:text-3xl` also reset the line height
  and tracking set by a base `leading-relaxed` or `tracking-tight`; in v4 those utilities apply at every breakpoint, as
  written. A heading with `text-2xl md:text-3xl tracking-tight` is now tight on desktop too.
- Renamed: `outline-none` is `outline-hidden`, `backdrop-blur-sm` is `backdrop-blur-xs` and the bare `backdrop-blur` is
  `backdrop-blur-sm`, `bg-gradient-to-*` is `bg-linear-to-*`. `shadow-*` and `rounded-*` keep their names: this package
  defines those scales.
- Arbitrary grid templates take underscores, not commas: `grid-cols-[1fr_340px]`, not `[1fr,340px]`.
- A utility named in a variable needs parentheses: `bg-(--brand)`, not `bg-[--brand]`.

## Dependencies

The stylesheet resolves `tailwindcss`, `@tailwindcss/typography` and `tw-animate-css` from this package, so they are its
dependencies; an app only brings `tailwindcss`, `postcss` and `@tailwindcss/postcss`. The package also depends on
`tailwind-merge` (v3, for Tailwind 4 class names) for the class merging the UI kit does.

There is deliberately no `@tailwindcss/forms`: its global preset paints a fixed blue focus ring, blue checkboxes and its
own select chevron on every native control, over the theme. Fields take their look from `@ottabase/ui` and native
checkboxes, radios and ranges are tinted by `accent-color`, which `@ottabase/ui/styles.css` points at the brand.

## Tests

```bash
pnpm test --filter=@ottabase/ui-tailwind
```

The tests compile the stylesheet with Tailwind and assert on the CSS it generates: every token mapping, the fallbacks,
that no engine variable is shadowed, and the space compat plugin.
