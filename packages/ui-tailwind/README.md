# @ottabase/ui-tailwind

Shared **Tailwind CSS v4** entry stylesheet for Ottabase apps. One `@import` loads Tailwind, the forms/typography
plugins and `tw-animate-css`, and maps every theme CSS variable (shadcn-style HSL colour tokens, radii, type scale,
fonts, shadows, motion, z-index, sidebar, charts) onto Tailwind utilities, so Vite/Next apps stay aligned with the Brand
Engine.

There is no JavaScript config: Tailwind v4 is configured in CSS (`styles/tailwind.base.css`).

## Usage

**1. PostCSS** — use the v4 plugin (it handles imports, nesting and vendor prefixes; no autoprefixer needed):

```js
// postcss.config.cjs
module.exports = {
    plugins: { '@tailwindcss/postcss': {} },
};
```

**2. Root stylesheet** — import the entry first, then point Tailwind at any workspace packages whose class names it must
see (the app's own directory is detected automatically):

```css
@import '@ottabase/ui-tailwind/styles/tailwind.base.css';
@import '@ottabase/ui-shadcn/styles.css'; /* token defaults + light/dark */

@source '../../../../packages/ui-shadcn/components';
@source '../../../../packages/ui-components/src';
/* …other workspace paths that use Tailwind classes */
```

**3. App-specific tokens** — extend in CSS with the same `@theme inline reference` block the shared sheet uses:

```css
@theme inline reference {
    --spacing-theme-section: var(--spacing-section); /* p-theme-section, gap-theme-section … */
}
```

## How the token mapping works

The shared sheet declares its tokens with `@theme inline reference`:

- **`inline`** — utilities embed the `var()` expression itself (`bg-primary` → `hsl(var(--primary))`), so a token
  resolves on the element that uses it and scoped overrides (`.dark`, a `.otta-demo` wrapper) keep working.
- **`reference`** — the keys are not emitted as `:root` variables. Several Brand Engine tokens share Tailwind's own
  names (`--radius-sm`, `--shadow-md`, `--text-base`, `--font-mono`, `--ease-spring` …); emitting them would shadow or
  self-reference the runtime values. Utilities read the engine variable directly, with the stock value as the fallback
  where a theme may omit it (`text-base` → `var(--text-base, 1rem)`).

Colour tokens stay raw HSL channels (`--primary: 222 47% 11%`), so opacity modifiers work: `bg-primary/50` →
`color-mix(in oklab, hsl(var(--primary)) 50%, transparent)`.

| Utility                                                                                | Reads                                                     |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `bg-*` / `text-*` / `border-*` semantic colours                                        | `--primary`, `--muted-foreground`, `--sidebar-*`, …       |
| `rounded`, `rounded-sm` … `rounded-2xl`, `rounded-full`                                | `--radius-{size}`, falling back to a calc over `--radius` |
| `shadow` (= sm), `shadow-xs` … `shadow-xl`                                             | `--shadow-{size}`                                         |
| `text-xs` … `text-9xl`                                                                 | `--text-{step}`, `--text-{step}-lh`, `--text-{step}-ls`   |
| `font-sans` / `font-heading` / `font-mono` / `font-handwriting`                        | `--font-body`, `--font-heading`, `--font-mono`, …         |
| `border`, `border-x/y/t/r/b/l`, `divide-x/y`, `border-strong`                          | `--border-width`, `--border-width-strong`                 |
| `transition` defaults, `duration-fast/normal/slow/press`, `ease-theme*`, `ease-spring` | `--duration-*`, `--ease*`                                 |
| `z-header`, `z-sticky`, `z-dropdown`, `z-overlay`, `z-modal`, `z-popover`, `z-toast`   | `--z-{name}`                                              |
| `p-section`, `gap-card`, `m-element`, …                                                | `--spacing-section/card/element`                          |
| `prose`                                                                                | token colours (light/dark adaptive)                       |

Dark mode is class based (`dark:` matches descendants of `.dark`).

The sheet also keeps three v3 preflight defaults that v4 changed: borders default to `gray-200` (not `currentColor`),
input placeholders to `gray-400`, and buttons get `cursor: pointer`. `ui-shadcn/styles.css` then re-points borders at
the `--border` token.

## Cascade layers

Tailwind v4 emits native cascade layers (`theme, base, components, utilities`). **Unlayered CSS beats every utility**
regardless of specificity, so global element rules that utilities should be able to override (cursors, focus ring,
interaction physics) belong in `@layer base`. Runtime theme CSS is injected unlayered on purpose — it overrides
everything.

## Dependencies

Apps bring `tailwindcss` and `@tailwindcss/postcss` (from the monorepo `catalog:`). This package owns what its
stylesheet loads: `@tailwindcss/forms`, `@tailwindcss/typography` and `tw-animate-css`.

## Tests

The suite compiles the real stylesheet through `@tailwindcss/postcss` and asserts the generated utilities.

```bash
pnpm test --filter=@ottabase/ui-tailwind
```
