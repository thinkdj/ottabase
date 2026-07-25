// ============================================================
// Ottabase Bootstrap - HTML Pages
// ============================================================
//
// Self-contained HTML pages served directly from the worker. At this point the
// platform has no database, no brand engine and no asset pipeline, so every
// style and script is inline and the page makes no outbound request.
//
// DESIGN — the palette, radius, shadow and motion tokens below are transcribed
// from the app's default brand theme (packages/brand-engine/src/themes/default.json)
// and the component recipes mirror @ottabase/ui-shadcn (button h-10/rounded-md,
// input h-10, card rounded-lg + border, the global 2px focus ring). First-run
// setup should look like the product it is installing. Light and dark come from
// prefers-color-scheme — there is no theme store to read yet.
//
// IMPORTANT — the inline <script> lives inside a TS template literal, so it must
// never contain a backtick or a ${...} sequence; use string concatenation there.
// `__tests__/pages.test.ts` asserts no '${' survives into the rendered HTML.
// ============================================================

import type { PlatformStateResult } from './types';

const BRAND = 'Ottabase';

// ============================================================
// Design system
// ============================================================

/**
 * Dark-scheme token overrides. Declared once and interpolated into BOTH the
 * prefers-color-scheme block and the explicit `[data-theme='dark']` selector,
 * so the theme toggle can never drift from the system default.
 */
const DARK_TOKENS = `
      /* Verdant dark, verbatim. It already sets card above background (9% vs 6%),
         so cards read as raised without the lift earlier palettes needed here. */
      --background: 148 24% 6%;
      --foreground: 138 14% 86%;
      --card: 148 20% 9%;
      --muted: 146 16% 13%;
      --muted-foreground: 140 10% 54%;
      --border: 146 14% 12%;
      --input: 146 14% 12%;
      --ring: 156 48% 46%;
      --primary: 156 48% 46%;
      --primary-foreground: 148 24% 6%;
      /* Inverted against light: the dark fill brightens on hover. */
      --primary-hover: 156 48% 54%;
      --primary-active: 156 48% 62%;
      --danger: 4 82% 68%;
      --success: 162 54% 52%;
      --warning: 44 78% 60%;
`;

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  * { margin: 0; padding: 0; }

  :root {
    color-scheme: light dark;

    /* Palette transcribed from the verdant theme (light scheme), which is the
       framework default: see brand-engine/src/defaults.ts and the
       themePresetId: 'verdant' that ensureAppBrandDefaults seeds in step two. */
    --background: 138 18% 97%;
    --foreground: 148 22% 10%;
    --card: 0 0% 100%;
    --muted: 140 14% 93%;
    /* Verdant ships 142 8% 46%, which measures 4.03:1 on its own tinted
       background and misses AA. Same hue, four points darker, now 4.9:1. */
    --muted-foreground: 142 8% 40%;
    --border: 140 12% 88%;
    --input: 140 12% 88%;
    --ring: 156 52% 34%;
    --primary: 156 52% 34%;
    --primary-foreground: 0 0% 100%;
    /* Explicit hover/active stops rather than shadcn's bg-primary/90: alpha
       composites the fill toward the card and drops the label under 4.5:1.
       Hue and saturation are unchanged; only lightness moves. */
    --primary-hover: 156 52% 28%;
    --primary-active: 156 52% 22%;

    /* Verdant's destructive / success / warning are button-FILL values and fall
       under 4.5:1 as body copy, so these keep the hue and drop the lightness. */
    --danger: 4 70% 40%;
    --success: 162 62% 26%;
    --warning: 40 82% 28%;

    --radius: 0.5rem;
    --radius-md: calc(var(--radius) - 2px);
    --radius-sm: calc(var(--radius) - 4px);

    /* Verdant's shadows are green-tinted and softer than a neutral scale. */
    --shadow-xs: 0 1px 2px rgb(20 60 30 / 0.05);
    --shadow-sm: 0 2px 4px rgb(20 60 30 / 0.06);
    --shadow-md: 0 4px 8px -1px rgb(20 60 30 / 0.08);

    --fast: 105ms;
    --normal: 200ms;
    --ease: cubic-bezier(0.35, 0.65, 0.05, 1);

    --text-xs: 0.75rem;
    --text-sm: 0.875rem;
    --text-base: 1rem;
    --text-lg: 1.0625rem;
    --text-2xl: 1.75rem;

    /* Verdant names Sora for headings and Source Sans 3 for body, both served from
       Google Fonts. Bootstrap pages may not make outbound requests, so the families
       are listed FIRST and used only when already installed locally (common on the
       machines that built the theme); everyone else falls back to the system stack,
       which is the closest humanist sans available without a download. */
    --font-sans: 'Source Sans 3', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, Cantarell, 'Noto Sans', Arial, sans-serif;
    --font-heading: 'Sora', 'Source Sans 3', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, Cantarell, 'Noto Sans', Arial, sans-serif;
    --font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', 'DejaVu Sans Mono', monospace;
  }

  /* The system preference decides, unless the reader picked light explicitly. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {${DARK_TOKENS}    }
  }

  /* An explicit choice always wins, in either direction. */
  :root[data-theme='dark'] {${DARK_TOKENS}    }
  :root[data-theme='dark'] { color-scheme: dark; }
  :root[data-theme='light'] { color-scheme: light; }

  body {
    min-height: 100vh;
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    padding: clamp(1.5rem, 4vw, 3rem) 1.25rem 4rem;
  }

  .page { width: 100%; max-width: 60rem; margin: 0 auto; }

  /* Focus: the app's single global focus-visible rule (shadcn.css) */
  :where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }
  :where([tabindex='-1']):focus { outline: none; }

  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }

  a { color: hsl(var(--primary)); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { font-family: var(--font-mono); font-size: 0.925em; overflow-wrap: anywhere; }
  strong { font-weight: 600; }

  /* ── Masthead ─────────────────────────────────────────── */
  .masthead { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2.25rem; }
  /* Wordmark only: no icon, so the name itself carries the identity and is set
     a quarter larger than body copy. */
  .brand { display: inline-flex; align-items: center; font-family: var(--font-heading); font-size: 1.25rem; font-weight: 600; letter-spacing: -0.02em; color: hsl(var(--foreground)); }
  .brand:hover { text-decoration: none; }
  .masthead-actions { margin-left: auto; display: flex; align-items: center; gap: 0.5rem; }
  .chip {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.1875rem 0.625rem; border-radius: 9999px; border: 1px solid hsl(var(--border));
    background: hsl(var(--muted) / 0.6); color: hsl(var(--muted-foreground));
    font-size: var(--text-xs); font-weight: 500; white-space: nowrap;
  }
  .chip .dot { width: 0.4375rem; height: 0.4375rem; border-radius: 9999px; background: currentColor; flex: none; }
  .chip-ready { color: hsl(var(--success)); border-color: hsl(var(--success) / 0.3); background: hsl(var(--success) / 0.08); }
  .chip-danger { color: hsl(var(--danger)); border-color: hsl(var(--danger) / 0.3); background: hsl(var(--danger) / 0.08); }
  .chip-warn { color: hsl(var(--warning)); border-color: hsl(var(--warning) / 0.35); background: hsl(var(--warning) / 0.1); }

  /* ── Theme toggle ─────────────────────────────────────── */
  .theme-toggle {
    display: inline-flex; align-items: center; justify-content: center; flex: none;
    width: 2rem; height: 2rem; padding: 0;
    border: 1px solid transparent; border-radius: var(--radius-md);
    background: transparent; color: hsl(var(--muted-foreground)); cursor: pointer;
    transition: background-color var(--fast) var(--ease), color var(--fast) var(--ease);
  }
  .theme-toggle:hover { background: hsl(var(--muted) / 0.7); color: hsl(var(--foreground)); }
  .theme-toggle svg { display: block; width: 1rem; height: 1rem; }
  /* The icon shows the destination, not the current state. Swapping it in CSS
     means it is already correct on first paint, before the script runs. */
  .theme-toggle .icon-sun { display: none; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) .theme-toggle .icon-sun { display: block; }
    :root:not([data-theme='light']) .theme-toggle .icon-moon { display: none; }
  }
  :root[data-theme='dark'] .theme-toggle .icon-sun { display: block; }
  :root[data-theme='dark'] .theme-toggle .icon-moon { display: none; }

  /* ── Page head ────────────────────────────────────────── */
  .page-head { max-width: 46rem; margin-bottom: 2.25rem; }
  h1 { font-family: var(--font-heading); font-size: var(--text-2xl); font-weight: 600; letter-spacing: -0.022em; line-height: 1.18; }
  .lede { margin-top: 0.625rem; color: hsl(var(--muted-foreground)); font-size: var(--text-base); }

  /* ── Setup token ──────────────────────────────────────
     Reads as page chrome rather than a step: it gates the whole flow, so it sits
     above the rail on a muted surface instead of looking like another card. */
  .token-card {
    display: grid; gap: 0.375rem;
    margin-bottom: 1.75rem; padding: 1rem 1.125rem;
    border: 1px solid hsl(var(--border)); border-radius: var(--radius);
    background: hsl(var(--muted) / 0.55);
  }
  .tokenbar { display: grid; gap: 0.375rem; }
  @media (min-width: 44rem) {
    .tokenbar { grid-template-columns: 8.5rem minmax(0, 1fr); align-items: center; gap: 1rem; }
    .token-card > .hint, .token-card > .field-error { padding-left: 9.5rem; }
  }

  /* ── Shell: step rail + step panel ────────────────────── */
  .shell { display: grid; gap: 1.75rem; }
  @media (min-width: 62rem) {
    .shell { grid-template-columns: 13rem minmax(0, 1fr); gap: 3rem; align-items: start; }
    .rail { position: sticky; top: 2rem; }
  }

  .rail-list { list-style: none; display: grid; }
  .rail-step {
    position: relative; display: grid; grid-template-columns: 1.75rem minmax(0, 1fr);
    gap: 0.75rem; align-items: start; width: 100%; padding: 0 0 1.375rem;
    background: none; border: 0; text-align: left; font: inherit; color: inherit;
    cursor: pointer; border-radius: var(--radius-sm);
  }
  /* Structural pseudo-classes belong on the <li>: the button is always the only
     child of its item, so .rail-step:last-child would match every step. */
  .rail-list li:last-child .rail-step { padding-bottom: 0; }
  .rail-step:disabled { cursor: default; }
  .rail-list li:not(:last-child) .rail-step::before {
    content: ''; position: absolute; left: calc(0.875rem - 1px); top: 1.875rem; bottom: 0.375rem;
    width: 2px; border-radius: 2px; background: hsl(var(--border)); transition: background-color var(--normal) var(--ease);
  }
  .rail-list li:not(:last-child) .rail-step.is-done::before { background: hsl(var(--primary)); }
  .rail-marker {
    width: 1.75rem; height: 1.75rem; border-radius: 9999px; flex: none;
    display: grid; place-items: center;
    border: 1px solid hsl(var(--border)); background: hsl(var(--background));
    font-size: var(--text-xs); font-weight: 600; font-variant-numeric: tabular-nums;
    color: hsl(var(--muted-foreground));
    transition: background-color var(--fast) var(--ease), border-color var(--fast) var(--ease), color var(--fast) var(--ease);
  }
  .rail-step.is-current .rail-marker { border-color: hsl(var(--primary)); color: hsl(var(--primary)); box-shadow: 0 0 0 3px hsl(var(--primary) / 0.14); }
  .rail-step.is-done .rail-marker { background: hsl(var(--primary)); border-color: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
  .rail-step.is-error .rail-marker { background: hsl(var(--danger)); border-color: hsl(var(--danger)); color: hsl(var(--background)); }
  .rail-text { display: grid; gap: 0.0625rem; padding-top: 0.1875rem; min-width: 0; }
  .rail-title { font-size: var(--text-sm); font-weight: 500; color: hsl(var(--muted-foreground)); }
  .rail-step.is-current .rail-title, .rail-step.is-done .rail-title { color: hsl(var(--foreground)); }
  .rail-desc { font-size: var(--text-xs); color: hsl(var(--muted-foreground)); }
  .rail-step:hover:not(:disabled) .rail-title { color: hsl(var(--foreground)); }

  @media (max-width: 61.999rem) {
    .rail-list { grid-auto-flow: column; grid-auto-columns: 1fr; }
    .rail-step { grid-template-columns: minmax(0, 1fr); justify-items: center; text-align: center; gap: 0.5rem; padding: 0; }
    .rail-list li:not(:last-child) .rail-step::before {
      top: calc(0.875rem - 1px); bottom: auto; left: calc(50% + 1.25rem);
      width: calc(100% - 2.5rem); height: 2px;
    }
    .rail-text { padding-top: 0; justify-items: center; }
    .rail-desc { display: none; }
    .rail-title { font-size: var(--text-xs); }
  }

  /* ── Card ─────────────────────────────────────────────── */
  .card {
    background: hsl(var(--card)); border: 1px solid hsl(var(--border));
    border-radius: var(--radius); box-shadow: var(--shadow-sm);
  }
  .card + .card { margin-top: 1rem; }
  .card-body { padding: 1.375rem; display: grid; gap: 1rem; }
  .card-body > * { min-width: 0; }
  @media (max-width: 30rem) { .card-body { padding: 1.125rem; } }
  h2 { font-family: var(--font-heading); font-size: var(--text-lg); font-weight: 600; letter-spacing: -0.012em; line-height: 1.35; }
  h3 { font-family: var(--font-heading); font-size: var(--text-sm); font-weight: 600; }
  .prose { color: hsl(var(--muted-foreground)); }
  .card-head { display: grid; gap: 0.375rem; }
  .card-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
    margin-top: 0.25rem; padding-top: 1rem; border-top: 1px solid hsl(var(--border));
  }

  /* ── Buttons (shadcn parity) ──────────────────────────── */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
    height: 2.5rem; padding: 0 1rem; flex: none;
    border: 1px solid transparent; border-radius: var(--radius-md);
    font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 500; line-height: 1;
    white-space: nowrap; cursor: pointer;
    transition: background-color var(--fast) var(--ease), border-color var(--fast) var(--ease), color var(--fast) var(--ease);
  }
  .btn:disabled { opacity: 0.5; pointer-events: none; }
  .btn-primary { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); box-shadow: var(--shadow-xs); }
  .btn-primary:hover { background: hsl(var(--primary-hover)); }
  .btn-primary:active { background: hsl(var(--primary-active)); }
  .btn-outline { border-color: hsl(var(--input)); background: hsl(var(--background)); color: hsl(var(--foreground)); box-shadow: var(--shadow-xs); }
  .btn-outline:hover { background: hsl(var(--muted) / 0.8); }
  .btn-ghost { background: transparent; color: hsl(var(--muted-foreground)); }
  .btn-ghost:hover { background: hsl(var(--muted) / 0.7); color: hsl(var(--foreground)); }
  .btn-sm { height: 2.25rem; padding: 0 0.75rem; }
  .btn-block { width: 100%; }
  .btn-row { display: flex; flex-wrap: wrap; gap: 0.625rem; }
  .btn-row > .btn { flex: 1 1 auto; }

  @keyframes ob-spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 0.875rem; height: 0.875rem; flex: none; border-radius: 9999px;
    border: 2px solid currentColor; border-right-color: transparent;
    animation: ob-spin 0.6s linear infinite; opacity: 0.9;
  }

  /* ── Fields ───────────────────────────────────────────── */
  .field { display: grid; gap: 0.375rem; }
  .field-label { font-size: var(--text-sm); font-weight: 500; }
  .field-input {
    display: block; width: 100%; height: 2.5rem; padding: 0 0.75rem;
    border: 1px solid hsl(var(--input)); border-radius: var(--radius-md);
    background: hsl(var(--background)); color: hsl(var(--foreground));
    font-family: var(--font-sans); font-size: var(--text-sm);
    transition: border-color var(--fast) var(--ease);
  }
  .field-input::placeholder { color: hsl(var(--muted-foreground)); opacity: 1; }
  .field-input:hover:not(:disabled) { border-color: hsl(var(--muted-foreground) / 0.5); }
  .field-input:disabled { opacity: 0.6; cursor: not-allowed; }
  .field-input[aria-invalid='true'] { border-color: hsl(var(--danger)); }
  .field-with-action { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.5rem; }
  .hint { font-size: var(--text-xs); color: hsl(var(--muted-foreground)); }
  .field-error { font-size: var(--text-xs); color: hsl(var(--danger)); font-weight: 500; }
  .field-error:empty { display: none; }

  .reqs { list-style: none; display: grid; gap: 0.25rem; margin-top: 0.125rem; }
  .req { display: grid; grid-template-columns: 0.875rem minmax(0, 1fr); gap: 0.5rem; align-items: center; font-size: var(--text-xs); color: hsl(var(--muted-foreground)); }
  .req-mark { width: 0.875rem; text-align: center; line-height: 1; }
  .req[data-met='true'] { color: hsl(var(--success)); }

  /* ── Alerts ───────────────────────────────────────────── */
  .alert {
    display: grid; grid-template-columns: 1rem minmax(0, 1fr); gap: 0.125rem 0.625rem;
    padding: 0.75rem 0.875rem; border: 1px solid; border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }
  .alert:empty { display: none; }
  .alert-mark { line-height: 1.4; font-weight: 700; }
  .alert-title { font-weight: 600; }
  .alert-body { grid-column: 2; color: inherit; font-weight: 400; }
  .alert-body > * + * { margin-top: 0.375rem; }
  .alert-danger { color: hsl(var(--danger)); border-color: hsl(var(--danger) / 0.32); background: hsl(var(--danger) / 0.08); }
  .alert-warn { color: hsl(var(--warning)); border-color: hsl(var(--warning) / 0.35); background: hsl(var(--warning) / 0.1); }
  .alert-success { color: hsl(var(--success)); border-color: hsl(var(--success) / 0.32); background: hsl(var(--success) / 0.08); }
  .alert-info { color: hsl(var(--muted-foreground)); border-color: hsl(var(--border)); background: hsl(var(--muted) / 0.5); }
  .alert a { color: inherit; text-decoration: underline; }

  /* ── Icons ────────────────────────────────────────────── */
  .icon { width: 1rem; height: 1rem; display: block; flex: none; }

  /* ── Bindings ─────────────────────────────────────────── */
  .bindings { display: grid; gap: 0.5rem; }
  .binding {
    display: grid; grid-template-columns: 1.5rem minmax(0, 1fr) auto;
    align-items: start; gap: 0.125rem 0.625rem; min-width: 0;
    padding: 0.625rem 0.75rem; border: 1px solid hsl(var(--border));
    border-radius: var(--radius-md); background: hsl(var(--muted) / 0.4);
  }
  .binding-icon { display: grid; place-items: center; width: 1.5rem; height: 1.25rem; color: hsl(var(--tone)); }
  .binding-text { display: grid; gap: 0.0625rem; min-width: 0; }
  .binding-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.4375rem; }
  .binding-name { font-size: var(--text-sm); font-weight: 600; }
  .binding code { font-size: var(--text-xs); color: hsl(var(--muted-foreground)); }
  .binding-product {
    padding: 0 0.3125rem; border-radius: 9999px; border: 1px solid hsl(var(--border));
    background: hsl(var(--background) / 0.6); font-size: var(--text-xs);
    color: hsl(var(--muted-foreground)); white-space: nowrap;
  }
  .binding-desc { font-size: var(--text-xs); color: hsl(var(--muted-foreground)); }
  .binding .dot { width: 0.4375rem; height: 0.4375rem; border-radius: 9999px; background: hsl(var(--tone)); flex: none; }
  .binding-status {
    display: inline-flex; align-items: center; gap: 0.375rem;
    color: hsl(var(--tone)); font-size: var(--text-xs); font-weight: 500; white-space: nowrap;
  }
  .binding-ok { --tone: var(--success); }
  .binding-optional { --tone: var(--muted-foreground); }
  .binding-missing { --tone: var(--danger); border-color: hsl(var(--danger) / 0.32); background: hsl(var(--danger) / 0.06); }
  @media (max-width: 30rem) {
    .binding { grid-template-columns: 1.5rem minmax(0, 1fr); }
    .binding-status { grid-column: 2; margin-top: 0.25rem; }
  }

  /* ── Role list: identifier plus what it means in practice ── */
  .rolelist { list-style: none; display: grid; gap: 0.375rem; margin-top: 0.25rem; }
  .rolelist li { display: grid; gap: 0.125rem 0.75rem; }
  @media (min-width: 34rem) { .rolelist li { grid-template-columns: 9.5rem minmax(0, 1fr); align-items: baseline; } }
  .rolelist code { font-size: var(--text-xs); color: hsl(var(--foreground)); }
  .rolelist span { font-size: var(--text-xs); color: hsl(var(--muted-foreground)); }

  /* ── Definition rows (replaces the old wide env table) ── */
  .deflist { display: grid; gap: 0.875rem; }
  .defrow { display: grid; gap: 0.25rem; }
  @media (min-width: 44rem) { .defrow { grid-template-columns: 14rem minmax(0, 1fr); gap: 0.25rem 1.25rem; } }
  .defterm { font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 500; overflow-wrap: anywhere; }
  .defdesc { font-size: var(--text-xs); color: hsl(var(--muted-foreground)); }
  /* Always on its own row: trailing a long monospace variable name it collided
     with the term and wrapped unpredictably. block + fit-content keeps the pill
     hugging its label while forcing the line break. */
  .deftag { display: block; width: fit-content; margin-top: 0.3125rem; padding: 0 0.4375rem; border-radius: 9999px; border: 1px solid hsl(var(--border)); background: hsl(var(--background) / 0.6); font-family: var(--font-sans); font-size: var(--text-xs); font-weight: 500; line-height: 1.5; color: hsl(var(--muted-foreground)); }

  /* ── Code ─────────────────────────────────────────────── */
  .code {
    display: block; overflow-x: auto; padding: 0.75rem 0.875rem;
    border: 1px solid hsl(var(--border)); border-radius: var(--radius-md);
    background: hsl(var(--muted) / 0.5); color: hsl(var(--foreground));
    font-family: var(--font-mono); font-size: var(--text-xs); line-height: 1.7; white-space: pre;
  }

  /* ── Disclosure ───────────────────────────────────────── */
  .disclosure { border: 1px solid hsl(var(--border)); border-radius: var(--radius-md); background: hsl(var(--muted) / 0.3); }
  .disclosure > summary {
    display: flex; align-items: center; gap: 0.5rem; list-style: none;
    padding: 0.625rem 0.875rem; border-radius: var(--radius-md);
    font-size: var(--text-sm); font-weight: 500; cursor: pointer;
  }
  .disclosure > summary::-webkit-details-marker { display: none; }
  .disclosure > summary::before {
    content: ''; width: 0.4375rem; height: 0.4375rem; flex: none; margin: 0 0.125rem;
    border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg); transition: transform var(--fast) var(--ease);
  }
  .disclosure[open] > summary::before { transform: rotate(45deg); }
  .disclosure-body { display: grid; gap: 0.875rem; padding: 0 0.875rem 0.875rem; }

  /* ── Console ──────────────────────────────────────────── */
  .console {
    max-height: 15rem; overflow-y: auto; padding: 0.75rem 0.875rem;
    border: 1px solid hsl(var(--border)); border-radius: var(--radius-md);
    background: hsl(var(--muted) / 0.45);
    font-family: var(--font-mono); font-size: var(--text-xs); line-height: 1.7;
  }
  .console:empty { display: none; }
  .console-line { display: grid; grid-template-columns: 0.75rem minmax(0, 1fr); gap: 0.5rem; color: hsl(var(--muted-foreground)); overflow-wrap: anywhere; }
  .console-line .mark { text-align: center; }
  .console-ok { color: hsl(var(--success)); }
  .console-err { color: hsl(var(--danger)); }
  .console-info { color: hsl(var(--primary)); }

  /* ── Pre-flight checks ────────────────────────────────── */
  .checks { display: grid; gap: 0.4375rem; }
  .check { display: grid; grid-template-columns: 1rem minmax(0, 1fr); gap: 0.625rem; align-items: start; font-size: var(--text-sm); }
  .check-mark { font-weight: 700; line-height: 1.5; text-align: center; }
  .check-pass .check-mark { color: hsl(var(--success)); }
  .check-warn .check-mark { color: hsl(var(--warning)); }
  .check-fail .check-mark { color: hsl(var(--danger)); }
  .check-warn .check-text, .check-fail .check-text { color: hsl(var(--muted-foreground)); }
  .checks-loading { display: flex; align-items: center; gap: 0.5rem; color: hsl(var(--muted-foreground)); font-size: var(--text-sm); }

  /* ── Summary stats (success panel) ────────────────────── */
  .stats { display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); }
  .stat { padding: 0.75rem 0.875rem; border: 1px solid hsl(var(--border)); border-radius: var(--radius-md); background: hsl(var(--muted) / 0.4); }
  .stat-value { font-size: var(--text-lg); font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .stat-label { font-size: var(--text-xs); color: hsl(var(--muted-foreground)); margin-top: 0.125rem; }

  .linklist { display: grid; gap: 0.5rem; }
  .linkrow { display: grid; gap: 0.125rem; }
  .linkrow a { font-weight: 500; }
  .linkrow span { font-size: var(--text-xs); color: hsl(var(--muted-foreground)); }

  /* ── Footer ───────────────────────────────────────────── */
  .footer { margin-top: 2.5rem; padding-top: 1.25rem; border-top: 1px solid hsl(var(--border)); font-size: var(--text-xs); color: hsl(var(--muted-foreground)); }

  .is-hidden { display: none !important; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
    .spinner { animation: none; border-right-color: currentColor; opacity: 0.5; }
  }

  @media (forced-colors: active) {
    .card, .binding, .console, .code, .disclosure, .alert, .stat, .field-input { border: 1px solid CanvasText; }
    .rail-marker { border: 1px solid CanvasText; }
    .btn, .theme-toggle { border: 1px solid CanvasText; }
  }
`;

// ============================================================
// Icons
// ============================================================
//
// Lucide glyphs inlined as bare path data (the repo's icon set, per AGENTS.MD).
// No package and no request: they inherit currentColor and are sized by the
// parent, so one definition serves every intent and both colour schemes.

const ICON_PATHS: Record<string, string> = {
    database:
        '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    'hard-drive':
        '<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    'file-code':
        '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/>',
};

/** Inline an icon by name. Returns an empty string for an unknown name. */
function icon(name: string): string {
    const path = ICON_PATHS[name];
    if (!path) return '';
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

/** localStorage key the app's next-themes provider uses (storageKey). */
const THEME_STORAGE_KEY = 'ottabase.theme';

/**
 * Read the stored theme before first paint, mirroring the app's own anti-FOUC
 * script in apps/otta-web/index.html. Without this the page would paint in the
 * system scheme and then flip once the toggle script runs at the end of <body>.
 * Uses no template literals or interpolation (see the header note).
 */
const THEME_HEAD_SCRIPT = `<script>
  (function () {
    try {
      var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
      if (stored === 'dark' || stored === 'light') {
        document.documentElement.setAttribute('data-theme', stored);
      }
    } catch (e) {
      /* storage can be blocked; fall back to prefers-color-scheme */
    }
  })();
</script>`;

/**
 * Light/dark switch. It starts from the stored choice, falling back to the
 * operating system preference, and writes back to the same key and value shape
 * the app's next-themes provider uses so the choice carries into the app.
 */
const THEME_TOGGLE = `<button type="button" class="theme-toggle" id="theme-toggle" aria-label="Switch theme" title="Switch theme">
      <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
      <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
    </button>`;

/**
 * Theme-toggle behaviour. Uses no template literals and no interpolation so it
 * can live inside the outer TS template string (see the header note).
 */
const THEME_SCRIPT = `<script>
  (function () {
    var root = document.documentElement;
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    var query = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function effective() {
      var chosen = root.getAttribute('data-theme');
      if (chosen === 'dark' || chosen === 'light') return chosen;
      return query && query.matches ? 'dark' : 'light';
    }

    function relabel() {
      var next = effective() === 'dark' ? 'light' : 'dark';
      var text = 'Switch to the ' + next + ' theme';
      toggle.setAttribute('aria-label', text);
      toggle.setAttribute('title', text);
    }

    relabel();

    toggle.addEventListener('click', function () {
      var next = effective() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      // Same key and raw string value next-themes writes, so /login and the rest
      // of the app open in the scheme chosen here.
      try {
        localStorage.setItem('ottabase.theme', next);
      } catch (e) {
        /* storage can be blocked; the choice then lasts for this page only */
      }
      relabel();
    });

    // Keep the label honest while the page is still following the system.
    if (query && query.addEventListener) {
      query.addEventListener('change', function () {
        if (!root.getAttribute('data-theme')) relabel();
      });
    }
  })();
  </script>`;

/**
 * Shared page chrome. `chip` is the small status pill on the right of the
 * masthead — it carries the real platform state rather than decoration.
 */
function baseLayout(title: string, chip: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
${THEME_HEAD_SCRIPT}
<title>${escapeHtml(title)} &middot; ${BRAND}</title>
<style>${STYLES}</style>
</head>
<body>
<div class="page">
  <header class="masthead">
    <span class="brand">${BRAND}</span>
    <div class="masthead-actions">
      ${chip}
      ${THEME_TOGGLE}
    </div>
  </header>
  <main>
${body}
  </main>
  <footer class="footer">${BRAND} &middot; Edge-first application framework</footer>
</div>
${THEME_SCRIPT}
</body>
</html>`;
}

/** Masthead status pill. `tone` is '', 'ready', 'warn' or 'danger'. */
function chipHtml(label: string, tone = ''): string {
    const cls = tone ? ` chip-${tone}` : '';
    return `<span class="chip${cls}"><span class="dot" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

/** The masthead chip for a resolved platform state. */
function stateChip(state: PlatformStateResult): string {
    if (state.state === 'READY') return chipHtml('Platform ready', 'ready');
    if (state.state === 'BOOTSTRAPPING') return chipHtml('Setup in progress', 'warn');
    return chipHtml('Not initialized');
}

/** Bootstrap-token field, shared by the maintenance pages. */
function tokenField(id: string, describedBy: string): string {
    return `<div class="field">
        <label class="field-label" for="${id}">Setup token</label>
        <input class="field-input" id="${id}" type="password" placeholder="BOOTSTRAP_OWNER_SECRET" autocomplete="off" spellcheck="false" aria-describedby="${describedBy}">
        <p class="hint" id="${describedBy}">Your <code>BOOTSTRAP_OWNER_SECRET</code>. Filled in automatically from <code>?secret=</code> when the URL carries it.</p>
        <p class="field-error" id="${id}-error" role="alert"></p>
      </div>`;
}

// ============================================================
// Re-seed page — focused maintenance UI over POST /api/seed
// ============================================================
//
// A one-click affordance to re-run RBAC seeding after a framework upgrade that
// changed role permissions. Non-destructive: ensureDefaultRoles() reconciles the
// built-in `isSystem` roles to the canonical permission sets (e.g. heals a legacy
// `owner = ['*:*']` row) and never touches data or operator-created roles.
export function renderReseedPage(state: PlatformStateResult): string {
    const isReady = state.state === 'READY';
    // The inline <script> uses string concatenation (no template literals / no `${...}`) so it does
    // not collide with this outer template string.
    return baseLayout(
        'Reconcile roles',
        stateChip(state),
        `  <div class="page-head">
    <h1>Reconcile roles and permissions</h1>
    <p class="lede">Puts the built-in roles back to exactly what the code says. Safe to run at any time.</p>
  </div>

  ${
      isReady
          ? ''
          : `<div class="alert alert-warn" style="margin-bottom:1rem"><span class="alert-mark" aria-hidden="true">!</span><span class="alert-title">The platform is not set up yet</span><div class="alert-body">Run the <a href="/__bootstrap__">setup wizard</a> first, since it creates the roles this page reconciles.</div></div>`
  }

  <div class="card">
    <div class="card-body">
      <div class="card-head">
        <h2>What this does</h2>
        <p class="prose">Restores the canonical permission sets for the six system roles (<code>platform_owner</code>, <code>owner</code>, <code>admin</code>, <code>editor</code>, <code>viewer</code> and <code>member</code>), and creates any default permission that is missing. It is non-destructive: your data and any role you created yourself are left untouched. Run it after an upgrade that changed role permissions, for example to heal a legacy <code>owner = ['*:*']</code> row without clearing the database.</p>
      </div>
      <form id="reseed-form" novalidate>
        ${tokenField('reseed-secret', 'reseed-secret-hint')}
        <button class="btn btn-primary btn-block" id="btn-reseed" type="submit" style="margin-top:1rem">Reconcile roles</button>
      </form>
      <div class="console" tabindex="0" id="reseed-log" role="log" aria-live="polite" aria-label="Reconcile output"></div>
      <div class="alert alert-success is-hidden" id="reseed-relogin">
        <span class="alert-mark" aria-hidden="true">&#10003;</span>
        <span class="alert-title">Roles reconciled</span>
        <div class="alert-body">Signed-in users keep a cached session snapshot. Sign out and back in (the platform owner especially) so the corrected roles take effect.</div>
      </div>
    </div>
  </div>

  <script>
    (function () {
      var form = document.getElementById('reseed-form');
      var input = document.getElementById('reseed-secret');
      var inputError = document.getElementById('reseed-secret-error');
      var btn = document.getElementById('btn-reseed');
      var log = document.getElementById('reseed-log');
      var relogin = document.getElementById('reseed-relogin');

      try {
        var q = new URLSearchParams(location.search).get('secret');
        if (q) input.value = q;
      } catch (e) { /* URL parsing is best-effort */ }

      function line(msg, cls) {
        var row = document.createElement('div');
        row.className = 'console-line ' + (cls || '');
        var mark = document.createElement('span');
        mark.className = 'mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = cls === 'console-err' ? '\\u2715' : cls === 'console-ok' ? '\\u2713' : '\\u203A';
        var text = document.createElement('span');
        text.textContent = msg;
        row.appendChild(mark);
        row.appendChild(text);
        log.appendChild(row);
        log.scrollTop = log.scrollHeight;
      }

      function setBusy(busy, label) {
        btn.disabled = busy;
        btn.textContent = '';
        if (busy) {
          var s = document.createElement('span');
          s.className = 'spinner';
          s.setAttribute('aria-hidden', 'true');
          btn.appendChild(s);
        }
        btn.appendChild(document.createTextNode(label));
      }

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var secret = (input.value || '').trim();
        inputError.textContent = '';
        input.removeAttribute('aria-invalid');
        if (!secret) {
          inputError.textContent = 'Enter your setup token to continue.';
          input.setAttribute('aria-invalid', 'true');
          input.focus();
          return;
        }
        setBusy(true, 'Reconciling');
        log.innerHTML = '';
        relogin.classList.add('is-hidden');
        line('Reconciling roles and permissions', 'console-info');

        fetch('/__bootstrap__/api/seed', {
          method: 'POST',
          headers: { 'X-Bootstrap-Secret': secret, 'Content-Type': 'application/json' },
        })
          .then(function (r) {
            return r.text().then(function (text) {
              var body = null;
              try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
              return { ok: r.ok, status: r.status, body: body };
            });
          })
          .then(function (res) {
            if (!res.ok || !res.body || res.body.success === false) {
              if (res.status === 401 || res.status === 403) {
                inputError.textContent = 'That setup token was not accepted.';
                input.setAttribute('aria-invalid', 'true');
                input.focus();
                line('Unauthorized. Check the token and try again.', 'console-err');
              } else {
                line('Failed: ' + ((res.body && (res.body.error || res.body.code)) || 'request failed (' + res.status + ')'), 'console-err');
              }
              setBusy(false, 'Try again');
              return;
            }
            var roles = res.body.roles;
            if (roles && roles.created && roles.created.length) line('Created or healed: ' + roles.created.join(', '), 'console-ok');
            else line('Every system role already matches code.', 'console-ok');
            if (roles && roles.existing && roles.existing.length) line('Roles present: ' + roles.existing.join(', '), '');
            relogin.classList.remove('is-hidden');
            setBusy(false, 'Reconcile again');
          })
          .catch(function (e) {
            line('Network error: ' + e.message, 'console-err');
            setBusy(false, 'Try again');
          });
      });
    })();
  </script>
`,
    );
}

// ============================================================
// Promote-owner page — focused UI over POST /api/admin/platform-owner/promote
// ============================================================
//
// Grants the SYSTEM-scoped platform_owner role to an EXISTING account. Secret-gated (same
// BOOTSTRAP_OWNER_SECRET) so it works without a session — useful for granting/transferring
// platform ownership or recovering when no owner can sign in.
export function renderPromoteOwnerPage(state: PlatformStateResult): string {
    const isReady = state.state === 'READY';
    return baseLayout(
        'Promote platform owner',
        stateChip(state),
        `  <div class="page-head">
    <h1>Promote a platform owner</h1>
    <p class="lede">Gives someone who already has an account full control of the platform.</p>
  </div>

  ${
      isReady
          ? ''
          : `<div class="alert alert-warn" style="margin-bottom:1rem"><span class="alert-mark" aria-hidden="true">!</span><span class="alert-title">The platform is not set up yet</span><div class="alert-body">Use the <a href="/__bootstrap__">setup wizard</a> to create the first owner.</div></div>`
  }

  <div class="card">
    <div class="card-body">
      <div class="card-head">
        <h2>Grant platform ownership</h2>
        <p class="prose">Grants the system-wide <code>platform_owner</code> role, which is the highest level of access there is. The person must already have signed up, because this does not create an account. Anyone who is already an owner keeps their access, so you can safely have more than one.</p>
      </div>
      <form id="promote-form" novalidate>
        ${tokenField('promote-secret', 'promote-secret-hint')}
        <div class="field" style="margin-top:1rem">
          <label class="field-label" for="promote-email">Account email</label>
          <input class="field-input" id="promote-email" type="email" placeholder="owner@example.com" autocomplete="off" spellcheck="false" aria-describedby="promote-email-hint">
          <p class="hint" id="promote-email-hint">The email of the existing account to promote.</p>
          <p class="field-error" id="promote-email-error" role="alert"></p>
        </div>
        <button class="btn btn-primary btn-block" id="btn-promote" type="submit" style="margin-top:1rem">Promote to platform owner</button>
      </form>
      <div class="console" tabindex="0" id="promote-log" role="log" aria-live="polite" aria-label="Promotion output"></div>
      <div class="alert alert-success is-hidden" id="promote-relogin">
        <span class="alert-mark" aria-hidden="true">&#10003;</span>
        <span class="alert-title">Ownership granted</span>
        <div class="alert-body">If that person is signed in right now, they need to sign out and back in before the new access appears in their session.</div>
      </div>
    </div>
  </div>

  <script>
    (function () {
      var form = document.getElementById('promote-form');
      var secretInput = document.getElementById('promote-secret');
      var secretError = document.getElementById('promote-secret-error');
      var emailInput = document.getElementById('promote-email');
      var emailError = document.getElementById('promote-email-error');
      var btn = document.getElementById('btn-promote');
      var log = document.getElementById('promote-log');
      var relogin = document.getElementById('promote-relogin');

      try {
        var q = new URLSearchParams(location.search).get('secret');
        if (q) secretInput.value = q;
      } catch (e) { /* URL parsing is best-effort */ }

      function line(msg, cls) {
        var row = document.createElement('div');
        row.className = 'console-line ' + (cls || '');
        var mark = document.createElement('span');
        mark.className = 'mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = cls === 'console-err' ? '\\u2715' : cls === 'console-ok' ? '\\u2713' : '\\u203A';
        var text = document.createElement('span');
        text.textContent = msg;
        row.appendChild(mark);
        row.appendChild(text);
        log.appendChild(row);
        log.scrollTop = log.scrollHeight;
      }

      function setBusy(busy, label) {
        btn.disabled = busy;
        btn.textContent = '';
        if (busy) {
          var s = document.createElement('span');
          s.className = 'spinner';
          s.setAttribute('aria-hidden', 'true');
          btn.appendChild(s);
        }
        btn.appendChild(document.createTextNode(label));
      }

      function fail(el, errEl, message) {
        errEl.textContent = message;
        el.setAttribute('aria-invalid', 'true');
        el.focus();
      }

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var secret = (secretInput.value || '').trim();
        var email = (emailInput.value || '').trim();
        secretError.textContent = '';
        emailError.textContent = '';
        secretInput.removeAttribute('aria-invalid');
        emailInput.removeAttribute('aria-invalid');

        if (!secret) { fail(secretInput, secretError, 'Enter your setup token to continue.'); return; }
        if (!email || email.indexOf('@') < 1) { fail(emailInput, emailError, 'Enter the email address of the account to promote.'); return; }

        setBusy(true, 'Promoting');
        log.innerHTML = '';
        relogin.classList.add('is-hidden');
        line('Promoting ' + email, 'console-info');

        fetch('/api/admin/platform-owner/promote', {
          method: 'POST',
          headers: { 'X-Bootstrap-Secret': secret, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email }),
        })
          .then(function (r) {
            return r.text().then(function (text) {
              var body = null;
              try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
              return { ok: r.ok, status: r.status, body: body };
            });
          })
          .then(function (res) {
            if (!res.ok) {
              if (res.status === 401 || res.status === 403) {
                fail(secretInput, secretError, 'That setup token was not accepted.');
                line('Unauthorized. Check the token and try again.', 'console-err');
              } else if (res.status === 404) {
                fail(emailInput, emailError, 'No account found for that email. They need to sign up first.');
                line('No account found for ' + email, 'console-err');
              } else {
                line('Failed: ' + ((res.body && (res.body.error || res.body.code)) || 'request failed (' + res.status + ')'), 'console-err');
              }
              setBusy(false, 'Try again');
              return;
            }
            var userId = (res.body && res.body.userId) || '';
            line(
              'Granted ' + ((res.body && res.body.role) || 'platform_owner') + ' to ' + email +
                (userId ? ' (user ' + userId + ')' : ''),
              'console-ok'
            );
            relogin.classList.remove('is-hidden');
            setBusy(false, 'Promote another account');
          })
          .catch(function (e) {
            line('Network error: ' + e.message, 'console-err');
            setBusy(false, 'Try again');
          });
      });
    })();
  </script>
`,
    );
}

// ============================================================
// Wizard page — the main setup flow
// ============================================================
//
// Four steps, each one action: Database -> Roles -> Owner -> Launch.
// Environment-variable reference material lives in disclosures next to the step
// it belongs to rather than occupying a step of its own, and the left rail is
// the single progress indicator (the old tab strip + separate progress bar were
// two views of the same state).

const WIZARD_STEPS = [
    { title: 'Database', desc: 'Somewhere to store things' },
    { title: 'Roles', desc: 'Who can do what' },
    { title: 'Owner', desc: 'Your account' },
    { title: 'Launch', desc: 'Open the doors' },
];

export function renderWizardPage(state: PlatformStateResult): string {
    const isReady = state.state === 'READY';
    const hasD1 = state.bindings.d1;

    const railHtml = WIZARD_STEPS.map(
        (step, i) =>
            `<li><button type="button" class="rail-step" id="rail-${i}" data-step="${i}"${i === 0 ? ' aria-current="step"' : ' disabled'}>
            <span class="rail-marker" id="marker-${i}" aria-hidden="true">${i + 1}</span>
            <span class="rail-text"><span class="rail-title">${escapeHtml(step.title)}</span><span class="rail-desc">${escapeHtml(step.desc)}</span></span>
          </button></li>`,
    ).join('\n          ');

    const bindingsHtml = Object.entries(state.bindings)
        .map(([name, ok]) => bindingRow(name, ok))
        .join('\n            ');

    return baseLayout(
        'Setup',
        stateChip(state),
        `  <div class="page-head">
    <h1>Set up ${BRAND}</h1>
    <p class="lede">Four steps and you have a running platform. Each one explains itself before it does anything, and nothing is written to your database until you press a button.</p>
  </div>

  <!-- The token gates every step, so it sits above the flow rather than inside it. -->
  <div class="token-card" id="token-card">
    <div class="tokenbar">
      <label class="field-label" for="bootstrap-secret">Setup token</label>
      <div class="field-with-action">
        <input class="field-input" id="bootstrap-secret" type="password" placeholder="BOOTSTRAP_OWNER_SECRET" autocomplete="off" spellcheck="false" aria-describedby="token-hint">
        <button type="button" class="btn btn-outline" id="token-reveal" aria-pressed="false">Show</button>
      </div>
    </div>
    <p class="hint" id="token-hint">This proves you are the person deploying the app, so a stranger cannot run setup against it. It is the <code>BOOTSTRAP_OWNER_SECRET</code> you set in your worker environment, and every step below sends it.</p>
    <p class="field-error" id="bootstrap-secret-error" role="alert"></p>
  </div>

  <div class="shell">
    <nav class="rail" aria-label="Setup steps">
      <ol class="rail-list">
          ${railHtml}
      </ol>
    </nav>

    <div>
      <p class="sr-only" id="step-announcer" aria-live="polite"></p>

      <!-- STEP 0: Database -->
      <section class="card step" id="panel-0" aria-labelledby="head-0">
        <div class="card-body">
          <div class="card-head">
            <h2 id="head-0" tabindex="-1">Give ${BRAND} somewhere to store things</h2>
            <p class="prose">Your app needs tables before it can remember anything. This creates them in your D1 database and runs the migrations that keep them up to date: accounts, sign-in sessions, roles, posts and tags. Tables that already exist are left exactly as they are, so running this on an existing database is safe.</p>
          </div>

          <div class="alert alert-warn is-hidden" id="cache-notice">
            <span class="alert-mark" aria-hidden="true" id="cache-mark">!</span>
            <span class="alert-title" id="cache-title">A previous session is cached in this browser</span>
            <div class="alert-body">
              <p id="cache-lede">Leftover client state can conflict with a fresh install.</p>
              <button type="button" class="btn btn-outline btn-sm" id="btn-clear-cache">Clear cached session</button>
              <p id="cache-result" role="status"></p>
            </div>
          </div>

          <div>
            <h3 style="margin-bottom:0.5rem">What this worker can reach</h3>
            <p class="hint" style="margin:-0.25rem 0 0.625rem">A binding connects your worker to a Cloudflare resource. They come from <code>wrangler.jsonc</code>, and Wrangler emulates them locally.</p>
            <div class="bindings">
            ${bindingsHtml}
            </div>
          </div>

          ${
              hasD1
                  ? ''
                  : `<div class="alert alert-danger">
            <span class="alert-mark" aria-hidden="true">&#10005;</span>
            <span class="alert-title">A D1 database binding is required</span>
            <div class="alert-body">
              <p>Add <code>OBCF_D1</code> to <code>wrangler.jsonc</code> and redeploy, then reload this page.</p>
              <code class="code">wrangler d1 create ottabase-db
# copy the database_id into wrangler.jsonc</code>
            </div>
          </div>`
          }
          ${
              state.bindings.kv
                  ? ''
                  : `<div class="alert alert-warn">
            <span class="alert-mark" aria-hidden="true">!</span>
            <span class="alert-title">No KV namespace</span>
            <div class="alert-body">Setup works without it, but <code>OBCF_KV</code> is what caches platform state and sessions. Add it before going to production.</div>
          </div>`
          }

          <details class="disclosure">
            <summary>Why is this green when I have not set a Cloudflare account ID?</summary>
            <div class="disclosure-body">
              <p class="prose">Because the two are unrelated. Bindings are declared in <code>wrangler.jsonc</code> and Wrangler emulates them on your machine, so nothing above needed an account. The variables below are read by the Wrangler command line and by optional analytics calls, never by the running worker, which is why setup works without them.</p>
              <dl class="deflist">
                <div class="defrow">
                  <dt class="defterm">CLOUDFLARE_ACCOUNT_ID<span class="deftag">Production</span></dt>
                  <dd class="defdesc">Needed by <code>wrangler deploy</code>, <code>pnpm cf:setup</code> and CI. Store it as the <code>CF_ACCOUNT_ID</code> repository secret. Local <code>wrangler dev</code> does not need it.</dd>
                </div>
                <div class="defrow">
                  <dt class="defterm">CLOUDFLARE_ANALYTICS_API_TOKEN<span class="deftag">Optional</span></dt>
                  <dd class="defdesc">Enables Analytics Engine queries for traffic and custom metrics. Without it the app runs normally and analytics dashboards stay empty.</dd>
                </div>
              </dl>
            </div>
          </details>

          <div class="alert alert-danger is-hidden" id="alert-0" role="alert"></div>
          <button class="btn btn-primary btn-block" id="btn-init"${hasD1 ? '' : ' disabled'}>Create tables and run migrations</button>
          <div class="console" tabindex="0" id="log-init" role="log" aria-live="polite" aria-label="Database output"></div>

          <div class="card-foot">
            <span></span>
            <button class="btn btn-outline btn-sm" id="next-0" disabled>Next: Roles</button>
          </div>
        </div>
      </section>

      <!-- STEP 1: Roles -->
      <section class="card step is-hidden" id="panel-1" aria-labelledby="head-1">
        <div class="card-body">
          <div class="card-head">
            <h2 id="head-1" tabindex="-1">Decide who can do what</h2>
            <p class="prose">Rather than every account being equal, people are given a role, and the role decides what they may touch. This creates the six built-in ones and their default permissions, plus the starting look and feel for this app. Running it again later is safe: it only ever repairs the built-in roles back to what the code says, and never touches roles you made yourself.</p>
            <ul class="rolelist">
              <li><code>platform_owner</code><span>Runs the whole platform, across every organization</span></li>
              <li><code>owner</code><span>Runs one organization and its billing</span></li>
              <li><code>admin</code><span>Manages people and settings inside an organization</span></li>
              <li><code>editor</code><span>Creates and publishes content</span></li>
              <li><code>viewer</code><span>Reads content, changes nothing</span></li>
              <li><code>member</code><span>Belongs to an organization with no extra powers</span></li>
            </ul>
          </div>
          <div class="alert alert-danger is-hidden" id="alert-1" role="alert"></div>
          <button class="btn btn-primary btn-block" id="btn-seed">Seed roles and permissions</button>
          <div class="console" tabindex="0" id="log-seed" role="log" aria-live="polite" aria-label="Role seeding output"></div>
          <div class="card-foot">
            <button class="btn btn-ghost btn-sm" data-goto="0">Back</button>
            <button class="btn btn-outline btn-sm" id="next-1" disabled>Next: Owner</button>
          </div>
        </div>
      </section>

      <!-- STEP 2: Owner -->
      <section class="card step is-hidden" id="panel-2" aria-labelledby="head-2">
        <div class="card-body">
          <div class="card-head">
            <h2 id="head-2" tabindex="-1">Create your account</h2>
            <p class="prose">This is the first account, and it holds the <code>platform_owner</code> role: full control over everything, including future organizations. A personal workspace is created with it so you have somewhere to work straight away. You will be signed in automatically once it exists.</p>
            <p class="hint">This step runs once and then locks itself. To give someone else ownership later, use the promote page linked from the last step.</p>
          </div>
          <form id="owner-form" novalidate>
            <div class="field">
              <label class="field-label" for="owner-name">Name</label>
              <input class="field-input" id="owner-name" name="name" type="text" placeholder="Jane Doe" autocomplete="name">
            </div>
            <div class="field" style="margin-top:0.875rem">
              <label class="field-label" for="owner-email">Email</label>
              <input class="field-input" id="owner-email" name="email" type="email" placeholder="you@example.com" autocomplete="email" spellcheck="false" required>
              <p class="field-error" id="owner-email-error" role="alert"></p>
            </div>
            <div class="field" style="margin-top:0.875rem">
              <label class="field-label" for="owner-password">Password</label>
              <div class="field-with-action">
                <input class="field-input" id="owner-password" type="password" autocomplete="new-password" aria-describedby="pw-reqs" required>
                <button type="button" class="btn btn-outline" id="pw-reveal" aria-pressed="false">Show</button>
              </div>
              <ul class="reqs" id="pw-reqs">
                <li class="req" data-req="len"><span class="req-mark" aria-hidden="true">&#9675;</span><span>At least 8 characters</span></li>
                <li class="req" data-req="upper"><span class="req-mark" aria-hidden="true">&#9675;</span><span>One uppercase letter</span></li>
                <li class="req" data-req="special"><span class="req-mark" aria-hidden="true">&#9675;</span><span>One special character</span></li>
              </ul>
              <p class="field-error" id="owner-password-error" role="alert"></p>
            </div>
            <div class="alert alert-danger is-hidden" id="alert-2" role="alert" style="margin-top:1rem"></div>
            <button class="btn btn-primary btn-block" id="btn-owner" type="submit" style="margin-top:1rem">Create owner account</button>
          </form>
          <div class="console" tabindex="0" id="log-owner" role="log" aria-live="polite" aria-label="Account output"></div>
          <div class="card-foot">
            <button class="btn btn-ghost btn-sm" data-goto="1">Back</button>
            <button class="btn btn-outline btn-sm" id="next-2" disabled>Next: Launch</button>
          </div>
        </div>
      </section>

      <!-- STEP 3: Launch -->
      <section class="card step is-hidden" id="panel-3" aria-labelledby="head-3">
        <div class="card-body">
          <div class="card-head">
            <h2 id="head-3" tabindex="-1">Check everything before opening the doors</h2>
            <p class="prose">A look at what the previous steps actually created. A cross means setup is not finished and launching is blocked. An exclamation mark is a warning: the platform will run, but something is worth fixing before real people use it.</p>
          </div>
          <div class="checks" id="checks"></div>

          <details class="disclosure">
            <summary>Environment variables for production</summary>
            <div class="disclosure-body">
              <p class="prose">Secrets live outside your code. Set them with <code>wrangler secret put</code>, or as plain values under <code>vars</code> in <code>wrangler.jsonc</code> when they are not sensitive. You can develop locally without any of them, but a real deployment needs at least <code>AUTH_SECRET</code>.</p>
              <dl class="deflist">
                <div class="defrow">
                  <dt class="defterm">AUTH_SECRET<span class="deftag">Required</span></dt>
                  <dd class="defdesc">Signs session cookies. Generate one with <code>openssl rand -base64 32</code>.</dd>
                </div>
                <div class="defrow">
                  <dt class="defterm">AUTH_URL<span class="deftag">Required</span></dt>
                  <dd class="defdesc">The public URL of this app, for example <code>https://app.example.com</code>.</dd>
                </div>
                <div class="defrow">
                  <dt class="defterm">EMAIL_RESEND_API_KEY<span class="deftag">Optional</span></dt>
                  <dd class="defdesc">Sends magic links, verification and password-reset mail. Without a provider those flows are unavailable.</dd>
                </div>
                <div class="defrow">
                  <dt class="defterm">EMAIL_FROM<span class="deftag">Optional</span></dt>
                  <dd class="defdesc">Sender address on outgoing mail.</dd>
                </div>
                <div class="defrow">
                  <dt class="defterm">MIGRATION_SECRET<span class="deftag">Recommended</span></dt>
                  <dd class="defdesc">Protects <code>/api/ottaorm/init</code> so migrations cannot be triggered anonymously.</dd>
                </div>
                <div class="defrow">
                  <dt class="defterm">BOOTSTRAP_OWNER_SECRET<span class="deftag">Recommended</span></dt>
                  <dd class="defdesc">The setup token above. Protects this wizard and the platform-owner promote endpoint.</dd>
                </div>
              </dl>
              <code class="code">wrangler secret put AUTH_SECRET
wrangler secret put MIGRATION_SECRET</code>
            </div>
          </details>

          <div class="alert alert-danger is-hidden" id="alert-3" role="alert"></div>
          <button class="btn btn-primary btn-block" id="btn-finalize" disabled>Launch platform</button>
          <div class="console" tabindex="0" id="log-finalize" role="log" aria-live="polite" aria-label="Launch output"></div>
          <div class="card-foot">
            <button class="btn btn-ghost btn-sm" data-goto="2">Back</button>
            <span></span>
          </div>
        </div>
      </section>

      <!-- Success -->
      <section class="card step is-hidden" id="panel-done" aria-labelledby="head-done">
        <div class="card-body">
          <div class="card-head">
            <h2 id="head-done" tabindex="-1">${BRAND} is running</h2>
            <p class="prose" id="done-lede">Setup is complete. Sign in with the owner account to get started.</p>
          </div>
          <div class="stats" id="done-stats"></div>
          <a class="btn btn-primary btn-block" href="/login">Sign in</a>
          <details class="disclosure">
            <summary>Maintenance pages</summary>
            <div class="disclosure-body">
              <div class="linklist">
                <div class="linkrow">
                  <a href="/__bootstrap__/seed">Reconcile roles and permissions</a>
                  <span>Re-applies built-in role definitions after an upgrade.</span>
                </div>
                <div class="linkrow">
                  <a href="/__bootstrap__/promote-owner">Promote a platform owner</a>
                  <span>Grants ownership to another existing account, or recovers access.</span>
                </div>
              </div>
            </div>
          </details>
        </div>
      </section>
    </div>
  </div>

  <script>
  (function () {
    var STEPS = 4;
    var STEP_NAMES = ['Database', 'Roles', 'Owner', 'Launch'];
    var current = 0;
    var done = [false, false, false, false];
    var ownerEmail = '';
    // Once setup completes the flow is terminal. Without this, every rail button
    // becomes reachable (reachable() only asks whether the previous step is done)
    // and one click would re-arm the init action, which wipes the KV namespace
    // and drops a live platform back to BOOTSTRAPPING.
    var finished = false;

    var announcer = document.getElementById('step-announcer');
    var tokenInput = document.getElementById('bootstrap-secret');
    var tokenError = document.getElementById('bootstrap-secret-error');
    var tokenHint = document.getElementById('token-hint');
    var railButtons = [];
    var i;
    for (i = 0; i < STEPS; i++) railButtons.push(document.getElementById('rail-' + i));

    try {
      var qs = new URLSearchParams(window.location.search).get('secret');
      if (qs) tokenInput.value = qs;
    } catch (e) { /* URL parsing is best-effort */ }

    // ── Reveal toggles ────────────────────────────────────
    function bindReveal(buttonId, inputId) {
      var button = document.getElementById(buttonId);
      var field = document.getElementById(inputId);
      if (!button || !field) return;
      button.addEventListener('click', function () {
        var shown = field.type === 'text';
        field.type = shown ? 'password' : 'text';
        button.textContent = shown ? 'Show' : 'Hide';
        button.setAttribute('aria-pressed', shown ? 'false' : 'true');
      });
    }
    bindReveal('token-reveal', 'bootstrap-secret');
    bindReveal('pw-reveal', 'owner-password');

    // ── Stale client state ────────────────────────────────
    // Anything under ottabase.* that is not a harmless UI preference means a
    // previous login is cached in this browser and will fight the fresh install.
    var KEEP = [
      'ottabase.sidebar-state',
      'ottabase.language',
      'ottabase.i18n',
      'ottabase.theme',
      'ottabase.ui-scale',
      'ottabase.layout-overrides',
    ];
    function staleKeys() {
      var found = [];
      try {
        for (var k = 0; k < localStorage.length; k++) {
          var key = localStorage.key(k);
          if (key && key.indexOf('ottabase.') === 0 && KEEP.indexOf(key) === -1) found.push(key);
        }
      } catch (e) { /* storage may be blocked */ }
      return found;
    }
    var cacheNotice = document.getElementById('cache-notice');
    var cacheMark = document.getElementById('cache-mark');
    var cacheTitle = document.getElementById('cache-title');
    var cacheLede = document.getElementById('cache-lede');
    var clearCacheBtn = document.getElementById('btn-clear-cache');
    var cacheResult = document.getElementById('cache-result');
    if (staleKeys().length > 0) cacheNotice.classList.remove('is-hidden');
    clearCacheBtn.addEventListener('click', function () {
      // Report the outcome in place, and change the intent with it: a warning
      // that still looks like a warning after you have fixed it reads as failed.
      var removed = 0;
      try {
        staleKeys().forEach(function (key) {
          localStorage.removeItem(key);
          removed++;
        });
      } catch (e) {
        cacheNotice.className = 'alert alert-danger';
        cacheMark.textContent = '\\u2715';
        cacheTitle.textContent = 'Could not clear browser storage';
        cacheLede.classList.add('is-hidden');
        cacheResult.textContent = 'Clear this site\\u2019s data in your browser settings, then reload this page.';
        return;
      }
      cacheNotice.className = 'alert alert-success';
      cacheMark.textContent = '\\u2713';
      cacheTitle.textContent = 'Browser cache cleared';
      cacheLede.classList.add('is-hidden');
      clearCacheBtn.classList.add('is-hidden');
      cacheResult.textContent = 'Removed ' + removed + ' saved item' + (removed === 1 ? '' : 's') + '. Setup can continue.';
    });

    // ── Networking ────────────────────────────────────────
    // Always inspects res.ok: a 401 or 500 body is not a success payload.
    function api(path, options) {
      options = options || {};
      var headers = options.headers || {};
      var token = (tokenInput.value || '').trim();
      if (token) headers['X-Bootstrap-Secret'] = token;
      options.headers = headers;
      options.credentials = 'include';
      return fetch(path, options).then(function (res) {
        return res.text().then(function (text) {
          var body = null;
          try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
          if (!res.ok || (body && body.success === false)) {
            // handleInit's failure body carries a "message" field and no "error"
            // key, so without this an autoInit failure shows only its bare code.
            var message = (body && (body.error || body.message || body.code)) || 'Request failed (' + res.status + ')';
            var err = new Error(message);
            err.status = res.status;
            err.body = body;
            throw err;
          }
          return body || {};
        });
      });
    }

    function isAuthError(err) {
      return err && (err.status === 401 || err.status === 403);
    }

    function flagToken(message) {
      tokenError.textContent = message;
      tokenInput.setAttribute('aria-invalid', 'true');
      tokenInput.focus();
      tokenInput.scrollIntoView({ block: 'center' });
    }

    tokenInput.addEventListener('input', function () {
      tokenError.textContent = '';
      tokenInput.removeAttribute('aria-invalid');
    });

    // ── Console ───────────────────────────────────────────
    function log(areaId, message, tone) {
      var area = document.getElementById(areaId);
      var row = document.createElement('div');
      row.className = 'console-line' + (tone ? ' console-' + tone : '');
      var mark = document.createElement('span');
      mark.className = 'mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = tone === 'err' ? '\\u2715' : tone === 'ok' ? '\\u2713' : '\\u203A';
      var text = document.createElement('span');
      text.textContent = message;
      row.appendChild(mark);
      row.appendChild(text);
      area.appendChild(row);
      area.scrollTop = area.scrollHeight;
    }

    function showAlert(step, title, detail) {
      var box = document.getElementById('alert-' + step);
      box.innerHTML = '';
      var mark = document.createElement('span');
      mark.className = 'alert-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = '\\u2715';
      var heading = document.createElement('span');
      heading.className = 'alert-title';
      heading.textContent = title;
      box.appendChild(mark);
      box.appendChild(heading);
      if (detail) {
        var body = document.createElement('div');
        body.className = 'alert-body';
        body.textContent = detail;
        box.appendChild(body);
      }
      box.classList.remove('is-hidden');
    }

    function clearAlert(step) {
      var box = document.getElementById('alert-' + step);
      box.innerHTML = '';
      box.classList.add('is-hidden');
    }

    function setBusy(button, busy, label) {
      button.disabled = busy;
      button.textContent = '';
      if (busy) {
        var s = document.createElement('span');
        s.className = 'spinner';
        s.setAttribute('aria-hidden', 'true');
        button.appendChild(s);
      }
      button.appendChild(document.createTextNode(label));
    }

    // ── Step navigation ───────────────────────────────────
    function reachable(step) {
      if (step === 0) return true;
      return done[step - 1] === true;
    }

    function paintRail() {
      for (var s = 0; s < STEPS; s++) {
        var button = railButtons[s];
        var marker = document.getElementById('marker-' + s);
        button.classList.toggle('is-done', done[s]);
        button.classList.toggle('is-current', s === current);
        if (s === current) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
        button.disabled = !reachable(s);
        marker.textContent = done[s] ? '\\u2713' : String(s + 1);
      }
    }

    function goTo(step, focusHeading) {
      if (finished) return;
      current = step;
      for (var s = 0; s < STEPS; s++) {
        document.getElementById('panel-' + s).classList.toggle('is-hidden', s !== step);
      }
      document.getElementById('panel-done').classList.add('is-hidden');
      paintRail();
      announcer.textContent = 'Step ' + (step + 1) + ' of ' + STEPS + ': ' + STEP_NAMES[step];
      if (focusHeading !== false) document.getElementById('head-' + step).focus();
      if (step === 3) runChecks();
    }

    function markDone(step) {
      done[step] = true;
      var next = document.getElementById('next-' + step);
      if (next) next.disabled = false;
      railButtons[step].classList.remove('is-error');
      paintRail();
    }

    function markError(step) {
      railButtons[step].classList.add('is-error');
    }

    railButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        var target = Number(button.getAttribute('data-step'));
        if (reachable(target)) goTo(target);
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-goto]'), function (button) {
      button.addEventListener('click', function () {
        goTo(Number(button.getAttribute('data-goto')));
      });
    });

    for (i = 0; i < STEPS - 1; i++) {
      (function (from) {
        var next = document.getElementById('next-' + from);
        if (next) next.addEventListener('click', function () { goTo(from + 1); });
      })(i);
    }

    // ── Step 0: database ──────────────────────────────────
    var btnInit = document.getElementById('btn-init');
    btnInit.addEventListener('click', function () {
      clearAlert(0);
      setBusy(btnInit, true, 'Creating tables');
      log('log-init', 'Starting database initialization', 'info');

      api('/__bootstrap__/api/init', { method: 'POST' })
        .then(function (data) {
          var kv = data.kvCleared;
          if (kv) {
            if (kv.skipped) log('log-init', 'No KV namespace bound, so the cache wipe was skipped.', '');
            else log('log-init', 'Cleared ' + kv.deleted + ' cached KV keys.', 'ok');
          }
          var auto = data.autoInit;
          if (auto) {
            if (auto.tablesCreated && auto.tablesCreated.length) log('log-init', 'Created ' + auto.tablesCreated.length + (auto.tablesCreated.length === 1 ? ' table: ' : ' tables: ') + auto.tablesCreated.join(', '), 'ok');
            if (auto.tablesSkipped && auto.tablesSkipped.length) log('log-init', 'Already present: ' + auto.tablesSkipped.join(', '), '');
            if (auto.columnsAdded && auto.columnsAdded.length) log('log-init', 'Added columns: ' + auto.columnsAdded.join(', '), 'ok');
            if (auto.customMigrationsRun && auto.customMigrationsRun.length) log('log-init', 'Ran migrations: ' + auto.customMigrationsRun.join(', '), 'ok');
            if (auto.errors && auto.errors.length) auto.errors.forEach(function (msg) { log('log-init', 'Warning: ' + msg, 'err'); });
          }
          var sql = data.sqlMigrations;
          if (sql) {
            if (sql.executed && sql.executed.length) log('log-init', 'Core SQL migrations: ' + sql.executed.join(', '), 'ok');
            if (sql.skipped && sql.skipped.length) log('log-init', 'Already applied: ' + sql.skipped.join(', '), '');
            if (sql.errors && sql.errors.length) sql.errors.forEach(function (msg) { log('log-init', msg, 'err'); });
          }
          // handleInit returns 200 even when individual migrations failed, so
          // never claim the schema is ready over the top of red output.
          var problems = ((sql && sql.errors) || []).length + ((auto && auto.errors) || []).length;
          if (problems > 0) {
            showAlert(
              0,
              'Migrations finished with ' + problems + ' error' + (problems === 1 ? '' : 's'),
              'The schema may be incomplete. Review the output above and fix the cause before continuing.'
            );
            setBusy(btnInit, false, 'Run again');
            // Unlock the next step but keep the step flagged; markDone clears the
            // error class, so it has to run first.
            markDone(0);
            markError(0);
            document.getElementById('next-0').textContent = 'Continue anyway';
            return;
          }
          log('log-init', 'Database ready.', 'ok');
          setBusy(btnInit, false, 'Tables created');
          btnInit.disabled = true;
          markDone(0);
          document.getElementById('next-0').focus();
        })
        .catch(function (err) {
          if (isAuthError(err)) {
            showAlert(0, 'That setup token was not accepted', 'Check BOOTSTRAP_OWNER_SECRET in your worker environment, then try again.');
            flagToken('That setup token was not accepted.');
          } else {
            showAlert(0, 'Could not create the schema', err.message);
          }
          log('log-init', err.message, 'err');
          setBusy(btnInit, false, 'Try again');
          markError(0);
        });
    });

    // ── Step 1: roles ─────────────────────────────────────
    var btnSeed = document.getElementById('btn-seed');
    btnSeed.addEventListener('click', function () {
      clearAlert(1);
      setBusy(btnSeed, true, 'Seeding');
      log('log-seed', 'Seeding roles and permissions', 'info');

      api('/__bootstrap__/api/seed', { method: 'POST' })
        .then(function (data) {
          if (data.roles) {
            if (data.roles.created && data.roles.created.length) log('log-seed', 'Created or healed: ' + data.roles.created.join(', '), 'ok');
            else log('log-seed', 'Every system role already matches code.', 'ok');
            if (data.roles.existing && data.roles.existing.length) log('log-seed', 'Roles present: ' + data.roles.existing.join(', '), '');
          }
          log('log-seed', 'Roles and permissions ready.', 'ok');
          setBusy(btnSeed, false, 'Roles seeded');
          btnSeed.disabled = true;
          markDone(1);
          document.getElementById('next-1').focus();
        })
        .catch(function (err) {
          if (isAuthError(err)) {
            showAlert(1, 'That setup token was not accepted', 'Check BOOTSTRAP_OWNER_SECRET in your worker environment, then try again.');
            flagToken('That setup token was not accepted.');
          } else {
            showAlert(1, 'Could not seed roles', err.message);
          }
          log('log-seed', err.message, 'err');
          setBusy(btnSeed, false, 'Try again');
          markError(1);
        });
    });

    // ── Step 2: owner ─────────────────────────────────────
    var ownerForm = document.getElementById('owner-form');
    var btnOwner = document.getElementById('btn-owner');
    var nameInput = document.getElementById('owner-name');
    var emailInput = document.getElementById('owner-email');
    var passInput = document.getElementById('owner-password');
    var emailError = document.getElementById('owner-email-error');
    var passError = document.getElementById('owner-password-error');

    // Mirrors the server-side rule in worker/bootstrap/routes.ts (handleCreateOwner).
    var RULES = {
      len: function (value) { return value.length >= 8; },
      upper: function (value) { return /[A-Z]/.test(value); },
      special: function (value) { return /[!@#$%^&*(),.?":{}|<>]/.test(value); },
    };

    function paintRequirements() {
      var value = passInput.value || '';
      var allMet = true;
      Array.prototype.forEach.call(document.querySelectorAll('#pw-reqs .req'), function (item) {
        var met = RULES[item.getAttribute('data-req')](value);
        item.setAttribute('data-met', met ? 'true' : 'false');
        item.querySelector('.req-mark').textContent = met ? '\\u2713' : '\\u25CB';
        if (!met) allMet = false;
      });
      return allMet;
    }
    passInput.addEventListener('input', paintRequirements);

    ownerForm.addEventListener('submit', function (event) {
      event.preventDefault();
      clearAlert(2);
      emailError.textContent = '';
      passError.textContent = '';
      emailInput.removeAttribute('aria-invalid');
      passInput.removeAttribute('aria-invalid');

      var email = (emailInput.value || '').trim();
      var password = passInput.value || '';
      var name = (nameInput.value || '').trim();

      if (!email || email.indexOf('@') < 1) {
        emailError.textContent = 'Enter a valid email address.';
        emailInput.setAttribute('aria-invalid', 'true');
        emailInput.focus();
        return;
      }
      if (!paintRequirements()) {
        passError.textContent = 'Your password does not meet every requirement above yet.';
        passInput.setAttribute('aria-invalid', 'true');
        passInput.focus();
        return;
      }

      setBusy(btnOwner, true, 'Creating account');
      log('log-owner', 'Creating the platform owner: ' + email, 'info');

      // A stale client session would be adopted by the app right after this
      // account is created, so clear it first. staleKeys() honours KEEP, which
      // preserves harmless UI preferences: wiping ottabase.theme here would
      // throw away the scheme the operator just picked in the masthead.
      try {
        staleKeys().forEach(function (key) { localStorage.removeItem(key); });
      } catch (e) { /* storage may be blocked */ }

      api('/__bootstrap__/api/create-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password, name: name }),
      })
        .then(function (data) {
          ownerEmail = data.user.email;
          log('log-owner', 'Created ' + data.user.email + ' with the ' + data.user.role + ' role.', 'ok');
          // Keep the raw id in the output: an operator needs it to look the
          // row up in D1 when checking tenant scoping.
          if (data.organizationId) log('log-owner', 'Personal workspace created: ' + data.organizationId, 'ok');
          setBusy(btnOwner, false, 'Account created');
          btnOwner.disabled = true;
          nameInput.disabled = true;
          emailInput.disabled = true;
          passInput.disabled = true;
          markDone(2);
          document.getElementById('next-2').focus();
        })
        .catch(function (err) {
          var fieldErrors = err.body && err.body.errors;
          if (fieldErrors) {
            if (fieldErrors.email) { emailError.textContent = fieldErrors.email; emailInput.setAttribute('aria-invalid', 'true'); }
            if (fieldErrors.password) { passError.textContent = fieldErrors.password; passInput.setAttribute('aria-invalid', 'true'); }
          } else if (isAuthError(err)) {
            showAlert(2, 'That setup token was not accepted', 'Check BOOTSTRAP_OWNER_SECRET in your worker environment, then try again.');
            flagToken('That setup token was not accepted.');
          } else if (err.status === 409) {
            showAlert(2, 'An account already exists', 'The owner account can only be created during first-time setup. Use the promote page at /__bootstrap__/promote-owner to grant ownership instead.');
          } else {
            showAlert(2, 'Could not create the account', err.message);
          }
          log('log-owner', err.message, 'err');
          setBusy(btnOwner, false, 'Try again');
          markError(2);
        });
    });

    // ── Step 3: pre-flight and launch ─────────────────────
    var btnFinalize = document.getElementById('btn-finalize');
    var checksEl = document.getElementById('checks');
    var lastStatus = null;

    function checkRow(tone, label) {
      var glyph = tone === 'pass' ? '\\u2713' : tone === 'warn' ? '!' : '\\u2715';
      var word = tone === 'pass' ? 'Passed' : tone === 'warn' ? 'Warning' : 'Failed';
      var row = document.createElement('div');
      row.className = 'check check-' + tone;
      var mark = document.createElement('span');
      mark.className = 'check-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = glyph;
      var sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = word + ': ';
      var text = document.createElement('span');
      text.className = 'check-text';
      text.textContent = label;
      row.appendChild(mark);
      var wrap = document.createElement('span');
      wrap.appendChild(sr);
      wrap.appendChild(text);
      row.appendChild(wrap);
      return row;
    }

    function runChecks() {
      checksEl.innerHTML = '';
      var loading = document.createElement('div');
      loading.className = 'checks-loading';
      var spin = document.createElement('span');
      spin.className = 'spinner';
      spin.setAttribute('aria-hidden', 'true');
      loading.appendChild(spin);
      loading.appendChild(document.createTextNode('Running pre-flight checks'));
      checksEl.appendChild(loading);

      api('/__bootstrap__/api/status')
        .then(function (data) {
          lastStatus = data;
          // A READY, non-development platform gets a deliberately minimal status
          // payload (see handleStatus), so there are no counts to report on.
          if (!data.database) {
            checksEl.innerHTML = '';
            checksEl.appendChild(checkRow('pass', 'This platform is already initialized, so there is nothing to verify.'));
            btnFinalize.disabled = true;
            return;
          }
          var db = data.database || {};
          var env = data.envConfig || {};
          var bindings = data.bindings || {};
          checksEl.innerHTML = '';
          checksEl.appendChild(checkRow(db.tableCount > 5 ? 'pass' : 'fail', db.tableCount + ' tables created'));
          checksEl.appendChild(checkRow(db.roleCount >= 5 ? 'pass' : 'fail', db.roleCount + ' roles seeded'));
          checksEl.appendChild(checkRow(db.userCount > 0 ? 'pass' : 'fail', db.userCount + (db.userCount === 1 ? ' account registered' : ' accounts registered')));
          checksEl.appendChild(checkRow(bindings.d1 ? 'pass' : 'fail', 'D1 database connected'));
          checksEl.appendChild(checkRow(bindings.kv ? 'pass' : 'warn', bindings.kv ? 'KV namespace connected' : 'No KV namespace, so sessions and platform state will not be cached'));
          checksEl.appendChild(checkRow(env.authSecret ? 'pass' : 'warn', env.authSecret ? 'AUTH_SECRET configured' : 'AUTH_SECRET not set, required before production'));
          checksEl.appendChild(checkRow(env.emailProvider ? 'pass' : 'warn', env.emailProvider ? 'Email provider configured' : 'No email provider, so magic links and password resets are unavailable'));
          btnFinalize.disabled = !(db.tableCount > 0 && db.userCount > 0 && db.roleCount > 0);
        })
        .catch(function (err) {
          checksEl.innerHTML = '';
          checksEl.appendChild(checkRow('fail', 'Could not read platform status: ' + err.message));
          if (isAuthError(err)) flagToken('That setup token was not accepted.');
        });
    }

    btnFinalize.addEventListener('click', function () {
      clearAlert(3);
      setBusy(btnFinalize, true, 'Launching');
      log('log-finalize', 'Verifying and marking the platform ready', 'info');

      api('/__bootstrap__/api/finalize', { method: 'POST' })
        .then(function (data) {
          log('log-finalize', 'Platform state is now READY.', 'ok');
          finish(data.summary);
        })
        .catch(function (err) {
          if (isAuthError(err)) {
            showAlert(3, 'That setup token was not accepted', 'Check BOOTSTRAP_OWNER_SECRET in your worker environment, then try again.');
            flagToken('That setup token was not accepted.');
          } else {
            showAlert(3, 'Could not launch', err.message);
          }
          // handleFinalize names the tables it could not find, so say which ones.
          // log() writes via textContent, so table names cannot inject markup.
          if (err.body && err.body.missing && err.body.missing.length) {
            log('log-finalize', 'Missing tables: ' + err.body.missing.join(', '), 'err');
          }
          log('log-finalize', err.message, 'err');
          setBusy(btnFinalize, false, 'Try again');
          markError(3);
        });
    });

    // ── Completion ────────────────────────────────────────
    function stat(value, label) {
      var box = document.createElement('div');
      box.className = 'stat';
      var v = document.createElement('div');
      v.className = 'stat-value';
      v.textContent = value;
      var l = document.createElement('div');
      l.className = 'stat-label';
      l.textContent = label;
      box.appendChild(v);
      box.appendChild(l);
      return box;
    }

    function finish(summary) {
      for (var s = 0; s < STEPS; s++) {
        done[s] = true;
        document.getElementById('panel-' + s).classList.add('is-hidden');
      }
      current = STEPS - 1;
      paintRail();
      // Seal the flow: the panels stay in the DOM (every handler resolved its
      // elements at start-up) but nothing can navigate back to a live action.
      finished = true;
      for (var r = 0; r < STEPS; r++) railButtons[r].disabled = true;
      document.getElementById('token-card').classList.add('is-hidden');

      var stats = document.getElementById('done-stats');
      stats.innerHTML = '';
      var source = summary || (lastStatus && lastStatus.database) || null;
      if (source) {
        stats.appendChild(stat(String(source.tables !== undefined ? source.tables : source.tableCount), 'Tables'));
        stats.appendChild(stat(String(source.roles !== undefined ? source.roles : source.roleCount), 'Roles'));
        if (ownerEmail) stats.appendChild(stat(ownerEmail, 'Platform owner'));
      }

      var panel = document.getElementById('panel-done');
      panel.classList.remove('is-hidden');
      announcer.textContent = 'Setup complete. The platform is running.';
      document.getElementById('head-done').focus();
    }

    // ── Resume ────────────────────────────────────────────
    // A reload should land on the first step that still has work, not step one.
    function resume() {
      api('/__bootstrap__/api/status')
        .then(function (data) {
          lastStatus = data;
          if (data.state === 'READY') {
            document.getElementById('done-lede').textContent =
              'This platform is already set up. Sign in with your owner account to continue.';
            finish(null);
            return;
          }
          var db = data.database || {};
          var env = data.envConfig || {};
          if (env.bootstrapOwnerSecret === false) {
            tokenHint.textContent = 'BOOTSTRAP_OWNER_SECRET is not set in this environment, so no token is needed. Set it before deploying to production.';
          }
          if (db.tableCount > 5) markDone(0);
          if (db.roleCount >= 5) markDone(1);
          if (db.userCount > 0) markDone(2);
          var first = done.indexOf(false);
          goTo(first === -1 ? STEPS - 1 : first, false);
        })
        .catch(function (err) {
          if (isAuthError(err)) {
            tokenHint.textContent = 'This environment requires a setup token. Enter it to continue.';
            tokenInput.focus();
          }
          paintRail();
        });
    }

    paintRail();
    ${isReady ? 'finish(null); document.getElementById("done-lede").textContent = "This platform is already set up. Sign in with your owner account to continue.";' : 'resume();'}
  })();
  </script>
`,
    );
}

// ============================================================
// Maintenance page — panic mode
// ============================================================

export function renderMaintenancePage(state: PlatformStateResult): string {
    return baseLayout(
        'Maintenance',
        chipHtml('Degraded', 'danger'),
        `  <div class="page-head">
    <h1>The database is unreachable</h1>
    <p class="lede">This platform was running a moment ago, but its database is not answering. Usually this clears on its own.</p>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="alert alert-danger">
        <span class="alert-mark" aria-hidden="true">&#10005;</span>
        <span class="alert-title">Service degraded</span>
        <div class="alert-body">${escapeHtml(state.reason)}</div>
      </div>
      <p class="hint">
        This page checks again every 15 seconds<span id="countdown" aria-hidden="true"></span>. No action is needed if
        the database is coming back.
      </p>
      <div class="btn-row">
        <button type="button" class="btn btn-outline btn-sm" id="btn-stop">Stop checking</button>
        <button type="button" class="btn btn-outline btn-sm" id="btn-now">Check now</button>
      </div>
    </div>
  </div>
  <script>
    (function () {
      // WCAG 2.2.1: an automatic refresh must be stoppable. The countdown is
      // aria-hidden so it does not announce once a second; the sentence above
      // carries the meaning.
      var left = 15;
      var countdown = document.getElementById('countdown');
      var stop = document.getElementById('btn-stop');
      var now = document.getElementById('btn-now');
      var timer = setInterval(function () {
        left--;
        if (left <= 0) { clearInterval(timer); location.reload(); return; }
        countdown.textContent = ' (' + left + 's)';
      }, 1000);
      countdown.textContent = ' (' + left + 's)';
      stop.addEventListener('click', function () {
        clearInterval(timer);
        countdown.textContent = '';
        stop.disabled = true;
        stop.textContent = 'Automatic checks stopped';
      });
      now.addEventListener('click', function () { location.reload(); });
    })();
  </script>
`,
    );
}

// ============================================================
// Locked page — ENV override
// ============================================================

export function renderLockedPage(_state: PlatformStateResult): string {
    return baseLayout(
        'Locked',
        chipHtml('Locked', 'warn'),
        `  <div class="page-head">
    <h1>This platform is locked</h1>
    <p class="lede">Someone stopped it on purpose with an environment variable, so no page will load until that is removed.</p>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="alert alert-warn">
        <span class="alert-mark" aria-hidden="true">!</span>
        <span class="alert-title"><code>OTTABASE_LOCKED</code> is set</span>
        <div class="alert-body">While it is set, every route except the health check is halted.</div>
      </div>
      <p class="prose">Remove the variable from <code>wrangler.jsonc</code> or your Cloudflare dashboard, then redeploy.</p>
      <code class="code">// wrangler.jsonc: remove the entry, or set it to "false":
"OTTABASE_LOCKED": "false"</code>
    </div>
  </div>
`,
    );
}

// ============================================================
// Unauthorized page — no valid setup token outside a dev environment
// ============================================================
//
// Deliberately says nothing about bindings, environment variables or platform
// state: an anonymous visitor learns only that a token is required.

export function renderUnauthorizedPage(): string {
    return baseLayout(
        'Setup token required',
        chipHtml('Not available'),
        `  <div class="page-head">
    <h1>This page needs a setup token</h1>
    <p class="lede">Setup is restricted here, so it needs the token you chose when you deployed.</p>
  </div>
  <div class="card">
    <div class="card-body">
      <p class="prose">Append your <code>BOOTSTRAP_OWNER_SECRET</code> as the <code>secret</code> query parameter, or send it as an <code>X-Bootstrap-Secret</code> header.</p>
      <code class="code">https://your-app.example.com/__bootstrap__?secret=YOUR_SECRET</code>
      <p class="hint">If you did not set that variable, add it to your worker environment and redeploy. Repeated failed attempts from one address are rate limited.</p>
    </div>
  </div>
`,
    );
}

// ============================================================
// Bindings error page
// ============================================================

export function renderBindingsErrorPage(state: PlatformStateResult): string {
    const missing = Object.entries(state.bindings)
        .filter(([name, ok]) => !ok && REQUIRED_BINDINGS.includes(name))
        .map(([name]) => name);
    const optional = Object.entries(state.bindings)
        .filter(([name, ok]) => !ok && !REQUIRED_BINDINGS.includes(name))
        .map(([name]) => name);

    return baseLayout(
        'Configuration required',
        chipHtml('Not configured', 'danger'),
        `  <div class="page-head">
    <h1>Cloudflare bindings are missing</h1>
    <p class="lede">${BRAND} has nowhere to store anything yet, so it cannot start.</p>
  </div>
  <div class="card">
    <div class="card-body">
      <div>
        <h3 style="margin-bottom:0.5rem">Required</h3>
        <div class="bindings">
          ${
              missing.length
                  ? missing.map((b) => bindingRow(b, false)).join('\n          ')
                  : `<div class="binding binding-ok"><span class="binding-icon" aria-hidden="true">${icon('database')}</span><span class="binding-text"><span class="binding-head"><span class="binding-name">Everything required is connected</span></span></span></div>`
          }
        </div>
      </div>
      ${
          optional.length
              ? `<div>
        <h3 style="margin-bottom:0.5rem">Recommended</h3>
        <div class="bindings">
          ${optional.map((b) => bindingRow(b, false)).join('\n          ')}
        </div>
      </div>`
              : ''
      }
      <p class="prose">A binding is how a worker reaches a Cloudflare resource. Add the ones above to <code>wrangler.jsonc</code>, redeploy, then re-check.</p>
      <code class="code">"d1_databases": [{
  "binding": "OBCF_D1",
  "database_name": "ottabase-db",
  "database_id": "YOUR_ID"   // wrangler d1 create ottabase-db
}],
"kv_namespaces": [{
  "binding": "OBCF_KV",
  "id": "YOUR_ID"            // wrangler kv namespace create OBCF_KV
}]</code>
      <!-- interceptIfNotReady re-probes the bindings on every request, so a
           plain link is a working re-check with no script. -->
      <a class="btn btn-outline" href="/">Re-check bindings</a>
    </div>
  </div>
`,
    );
}

// ============================================================
// Helpers
// ============================================================

/**
 * What each Cloudflare binding is, in plain language AND in the exact identifier
 * you put in wrangler.jsonc. Someone meeting Cloudflare for the first time reads
 * the name and the sentence; someone who knows it reads the code and the product.
 * Neither audience has to translate for the other.
 */
interface BindingMeta {
    /** Plain-language name for what this thing does */
    name: string;
    /** The binding identifier as written in wrangler.jsonc */
    id: string;
    /** The Cloudflare product behind it */
    product: string;
    /** One line on why the platform wants it */
    desc: string;
    icon: string;
}

const BINDING_META: Record<string, BindingMeta> = {
    d1: {
        name: 'Database',
        id: 'OBCF_D1',
        product: 'D1',
        desc: 'Holds your accounts, roles and content. Nothing works without it.',
        icon: 'database',
    },
    kv: {
        name: 'Cache and sessions',
        id: 'OBCF_KV',
        product: 'KV',
        desc: 'Keeps people signed in and remembers that setup is finished.',
        icon: 'zap',
    },
    r2: {
        name: 'File storage',
        id: 'OBCF_R2',
        product: 'R2',
        desc: 'Stores uploads such as images and documents.',
        icon: 'hard-drive',
    },
    queue: {
        name: 'Background jobs',
        id: 'OBCF_QUEUE',
        product: 'Queue',
        desc: 'Runs slow work later, like sending email.',
        icon: 'inbox',
    },
    assets: {
        name: 'Static files',
        id: 'OBCF_ASSETS',
        product: 'Assets',
        desc: 'Serves the built front-end to browsers.',
        icon: 'file-code',
    },
};

/** Bindings without which the platform cannot run. Everything else degrades gracefully. */
const REQUIRED_BINDINGS = ['d1'];

/** One binding row: icon, plain name, identifier, description and status. */
function bindingRow(key: string, ok: boolean): string {
    const meta = BINDING_META[key];
    if (!meta) return '';
    const required = REQUIRED_BINDINGS.includes(key);
    const cls = ok ? 'binding-ok' : required ? 'binding-missing' : 'binding-optional';
    const status = ok ? 'Connected' : required ? 'Required' : 'Not set';
    return `<div class="binding ${cls}">
              <span class="binding-icon" aria-hidden="true">${icon(meta.icon)}</span>
              <span class="binding-text">
                <span class="binding-head"><span class="binding-name">${escapeHtml(meta.name)}</span><code>${escapeHtml(meta.id)}</code><span class="binding-product">${escapeHtml(meta.product)}</span></span>
                <span class="binding-desc">${escapeHtml(meta.desc)}</span>
              </span>
              <span class="binding-status"><span class="dot" aria-hidden="true"></span>${status}</span>
            </div>`;
}

function escapeHtml(str: string): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
