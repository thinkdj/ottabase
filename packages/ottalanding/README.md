# @ottabase/ottalanding

Database-backed landing sites for Ottabase apps. The whole marketing site is typed content in D1: site settings,
navigation, footer and every page's sections. It is edited in otta-web's admin and rendered by one of three themes.
Switching theme never touches content.

```text
otta-web admin (/admin/content/landing) ──writes──▶ D1 (landing_sites, landing_pages) ◀──reads── apps/otta-landing
                                                     │
                                       @ottabase/ottalanding (models + contracts + themes)
```

## What's in the box

| Entry                          | Contents                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `@ottabase/ottalanding`        | Headless: `LandingSite` / `LandingPage` models, tables, section catalog, Zod schemas, theme metadata, starter content |
| `@ottabase/ottalanding/schema` | The Drizzle tables only (for migration registries)                                                                    |
| `@ottabase/ottalanding/react`  | `LandingView` (server-safe page renderer) and `LandingPreview` (client, scaled admin preview)                         |

The package ships TypeScript source and has no build step (the src-exports carve-out in `AGENTS.MD`). Apps that render
it must transpile it and include `packages/ottalanding/src/**` in their Tailwind `content`.

## Content model

**Site** (`landing_sites`, one row per app, `settings` JSON): name, tagline, public URL, theme, navigation links, a nav
button, footer links and a footer note.

**Page** (`landing_pages`, unique per `(app_id, path)`): path, title, description, published flag, and an ordered
`sections` JSON array.

**Sections**, an opinionated catalog where each type has the fields a good landing page needs:

| Type           | Fields                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `hero`         | eyebrow, headline\*, subheadline, buttons, image URL, image description                             |
| `logos`        | heading, logos (name\*, image URL)                                                                  |
| `features`     | heading, intro, features (title\*, description\*)                                                   |
| `testimonials` | heading, quotes (quote\*, name\*, role, photo URL)                                                  |
| `pricing`      | heading, intro, plans (name\*, price\*, period, description, included lines, button, featured flag) |
| `faq`          | heading, questions (question\*, answer\*)                                                           |
| `cta`          | heading\*, supporting line, buttons                                                                 |
| `text`         | heading, body\* (paragraphs separated by blank lines)                                               |

### One descriptor, three jobs

Every shape is declared once as **field descriptors** (`SECTIONS[type].fields`, `SITE_FIELDS`). From that one
declaration:

- `Data<F>` derives the TypeScript type (`SectionData<'pricing'>` requires `name` and `price`, and `featured` is a
  boolean),
- `toZod(F)` builds the runtime validator used by the models (server) and the admin (browser),
- otta-web's `FieldsForm` renders the editing form.

Adding a field is a one-line change, and the type, the validation and the admin form all follow.

Links accept `https://`, site-relative `/path` (not protocol-relative), `#anchor`, `mailto:` and `tel:`. A field marked
`absolute` (the site's public URL) accepts only a full `http(s)://host` address. Every rendered href and image `src`
also goes through `sanitizeUrl`.

**Stored data is read leniently.** Rules can tighten over time, so `getSettings()` uses `parseLenient()`: every valid
setting is kept, invalid list items are dropped, and only a field that no longer fits falls back to its starter value.
One bad field can never revert the whole site. Stored sections work the same way: `parseSections()` drops only the
invalid section.

**Accessibility:** every page has exactly one `<h1>`: the first hero's headline (later heroes render `<h2>`), or a
visually hidden title (`<LandingView title>`) when a page has no hero. Hero images use their **image description** as
`alt`, and are treated as decorative when it's empty.

## Models

```ts
import { LandingPage, LandingSite } from '@ottabase/ottalanding';

await LandingSite.findForApp(appId); // public read; null until set up, never writes
await LandingSite.ensureForApp(appId); // admin/init: seeds starter settings + pages once (idempotent)
await LandingSite.saveSettings(appId, input); // validates; throws DomainValidationError with fieldErrors
site.getSettings(); // validated settings, field by field (see above)

await LandingPage.findPublished(appId, '/pricing'); // public read
await LandingPage.forApp(appId);
await LandingPage.createFor(appId, input); // validates, unique path → PATH_TAKEN
await LandingPage.updateFor(appId, id, input); // null if the page is not in this app
await LandingPage.deleteFor(appId, id); // the home page can't be deleted (HOME_PAGE_REQUIRED)
page.toPage(); // plain data; stored sections that no longer match the catalog are dropped
```

Validation failures throw the ORM's `DomainValidationError` with dotted field paths (`sections.2.data.items.0.title`),
which the admin shows on the exact input.

**Scoping:** content is app-global and platform-owned, like brand data, so it's keyed by `appId` only. The app always
comes from server configuration, never from the request.

## Themes

| Theme       | Preset     | Character                                                                                                    |
| ----------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `launch`    | `neo`      | Modern SaaS: frosted sticky nav, centered hero, split features, tiered pricing, solid closing panel          |
| `editorial` | `rose`     | Long-form magazine: side navigation, large serif, logos as a sentence, pricing as a menu, drop cap on prose  |
| `bold`      | `midnight` | Dark and loud: oversized type, logo ticker (respects reduced motion), bento features, inverted featured plan |

A theme is a Brand Engine preset for colours, type and radius, plus its own React components: a `Shell` (navigation and
footer) and one component per section type. `themeStyles(themeId, selector)` returns the preset's tokens for **both**
colour schemes. Use `:root` on the live site and a scoping selector for previews.

```tsx
import { getTheme, schemeInitScript, themeStyles } from '@ottabase/ottalanding';
import { LandingView } from '@ottabase/ottalanding/react';

const theme = getTheme(site.theme);
const { css, fonts } = themeStyles(theme.id); // inject in <head>
<html data-scheme={theme.scheme} suppressHydrationWarning>
    <head>
        <script dangerouslySetInnerHTML={{ __html: schemeInitScript() }} /> {/* before the styles */}…
    </head>
    <LandingView site={site} sections={page.sections} currentPath="/pricing" />
</html>;
```

### Light and dark

Every theme has a designed default (Launch and Editorial are light, Bold is dark) and a full palette for the other mode,
taken from its preset.

- **Visitors** switch with the toggle in the navigation (`SchemeToggle`). It sets `data-scheme` on `<html>` and saves
  the choice in `localStorage` under `ottalanding.scheme`.
- **First paint** is already correct: `schemeInitScript()` re-applies a saved choice before the stylesheet paints.
  Without a saved choice, the theme's default (server-rendered as `data-scheme`) stays.
- **CSS:** `selector` holds the default palette, and `selector[data-scheme="light|dark"]` pins either one. Components
  use only design tokens, so nothing inside a theme needs a `dark:` variant.
- **Admin preview:** `<LandingPreview scheme="dark">` renders a page in either mode inside its own scoped frame.

All three themes share:

- a light/dark switch in the navigation
- sanitized links, with external links opening in a new tab
- a JS-free `<details>` mobile menu
- visible focus rings
- `aria-current` on the active nav link
- an anchor id on the first section of each type, so `/#pricing` works

### Adding a theme

1. Add an entry to `THEMES` (`src/themes.ts`) with a built-in preset and color scheme.
2. Create `src/react/themes/<id>.tsx` exporting a `ThemeComponents` object (a `Shell` plus all eight sections;
   TypeScript enforces completeness).
3. Register it in `THEME_COMPONENTS` (`src/react/view.tsx`).

The admin theme picker, the validation and the site renderer pick it up automatically.

### Adding a section type

Add it to `SECTIONS` (`src/sections.ts`), then implement it in every theme. TypeScript lists each theme that is missing
it.

## App integration (otta-web)

Registered as a built-in package (`packages.ottalanding`):

- tables in `config.migrations.ts`
- `db/schema.ts`
- models in `db-utils.ts`, with a defensive app-scoped, platform-admin RLS policy (generic CRUD default-denies them)
- `/api/landing` routes, platform admin only
- admin pages at `/admin/content/landing`
- starter content seeded by `/api/ottaorm/init`

## Testing

```bash
pnpm --filter @ottabase/ottalanding test
```

The model tests run against a real in-memory SQLite database (`node:sqlite` behind a D1-shaped shim) and create the
tables through OttaORM's own auto-migration. They cover constraints, JSON casts and app isolation. The theme tests
server-render every theme with the starter content and check link sanitization and anchors.

## License

MIT
