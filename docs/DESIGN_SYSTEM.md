# Design System v1

One set of tokens, components, words and navigation for every Ottabase surface: the admin (`otta-web`), the operator
Worker page (`otta-worker`), the `otta` command line, the bootstrap pages and the docs. The spec and the live demo are
the `ottabase.design` hub; this page is where it lives in the code.

The one rule: **green means the next step or a healthy thing. Everything else earns a tone only by needing someone. If a
person will copy it, it is mono. If a license lapses, the page stays.**

## Where it lives

| Layer              | File                                                  | What                                                                                     |
| ------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Engine defaults    | `packages/brand-engine/src/defaults.ts`               | The system as the values every theme merges on top of                                    |
| The preset         | `packages/brand-engine/src/themes/verdant.json`       | The same values as the seeded brand kit (`themePresetId: 'verdant'`)                     |
| Static fallbacks   | `packages/ui/styles/ui.css`                           | `:root` / `.dark`, the tone map (`[data-tone]`), the terminal room, the focus halo       |
| Tailwind utilities | `packages/ui-tailwind/tailwind.base.cjs`              | `text-subtle-foreground`, `bg-success-soft`, `hover:bg-primary-hover`, `animate-page-in` |
| Components         | `packages/ui/components/ui/*`                         | The recipes, each stamping `data-slot` for theme CSS                                     |
| Status language    | `packages/ui/components/ui/status-language.ts`        | Every enum → tone, label, icon (`statusOf('license', 'grace')`)                          |
| Operator page, CLI | `apps/otta-worker/worker/lib/html.ts`, `packages/cli` | The same words, no chrome; `Done.` / `Next:` / `Failed:`                                 |

## Tokens

Colours are HSL channels (`--primary: 156 51.7% 34.1%`) so every Tailwind utility takes `/alpha`. The design system's
names map onto the engine's shadcn vocabulary:

| Design system                                | Engine token                                                                                                             | Utility                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| bg / surface                                 | `background` / `card`, `popover`, `sidebar-background`                                                                   | `bg-background`, `bg-card`                                     |
| surface-2 / surface-3                        | `muted` / `secondary`                                                                                                    | `bg-muted` (hover, table head), `bg-secondary` (pressed)       |
| border / border-strong                       | `border` / `input`                                                                                                       | `border`, `border-input`                                       |
| text, text-2, text-3, text-4                 | `foreground`, `subtle-foreground`, `muted-foreground`, `faint-foreground`                                                | `text-subtle-foreground`, `text-faint-foreground`              |
| primary, hover, active                       | `primary`, `primary-hover`, `primary-active`                                                                             | `bg-primary hover:bg-primary-hover`                            |
| accent-soft / accent / accent-border         | `accent` / `accent-foreground` / `accent-line`                                                                           | `bg-accent text-accent-foreground`                             |
| focus                                        | `ring`                                                                                                                   | the global `:focus-visible` rule                               |
| green · amber · red · blue · smoke · neutral | `success` · `warning` · `destructive` · `info` · `smoke` · `neutral`, each with `-text`, `-soft`, `-line`, `-foreground` | `bg-success-soft text-success-text border-success-line`        |
| c1 … c8, grid, axis, label                   | `chart-1` … `chart-8`, `chart-grid`, `chart-axis`, `chart-label`                                                         | `fill-chart-1`                                                 |
| term-\*                                      | the `terminal` scope                                                                                                     | `<BrandScope name="terminal">` / `data-brand-scope="terminal"` |

A kit that sets only `primary` still gets correct `primary-hover`, `primary-active`, `accent-line`, and the text ladder:
`deriveColorExtras` (resolve-core) shifts them from what the kit defines. Tones never follow the brand hue; healthy
stays green.

Type: Inter for everything read, JetBrains Mono for everything copied. Radius: 7px controls, 10px cards, 14px dialogs.
Motion: 120ms controls, 200ms switches, 360ms entrances, 320ms when the theme flips (`.theming` on `<html>`).

## Components

| Piece                                                         | Use                                                                                                                                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button` variant                                              | `default` the one primary per view · `outline` secondary · `ghost` toolbars · `danger` outline in place · `destructive` solid, only inside a confirm · `loading` shows the one spinner |
| `Status domain value`                                         | A record's state from the map; `withIcon` for tight cells. `StatusChip tone` when there is no enum                                                                                     |
| `Badge`                                                       | `default` the brand chip · `secondary` a quiet tag · `outline` a neutral pill                                                                                                          |
| `Tag mono`, `EnvName`, `CountBadge`, `PremiumMark`, `LiveDot` | Metadata, an exact variable name, a count, the lock, a beacon                                                                                                                          |
| `PageHeader title description actions`                        | The page head; one description line, actions on the right                                                                                                                              |
| `Stat label value unit foot tone`                             | Numbers before narrative; an `onClick` makes it a filter tile with `pressed`                                                                                                           |
| `Alert variant`                                               | `info` · `success` · `warning` · `destructive` · `smoke`: soft fill, 3px bar, tone icon                                                                                                |
| `Empty tone variant`                                          | Five kinds, one shape; `plain` inside a card, `dashed` on its own                                                                                                                      |
| `Tabs` / `TabsList variant="segmented"`                       | Underline tabs for saved views with counts; the pill track for ranges and views                                                                                                        |
| `Table`                                                       | Sticky head on the subtle fill, 44px rows, hover, `data-state="selected"`                                                                                                              |
| `Card`, `Dialog`, `Sheet`, `DropdownMenu`                     | Surface + hairline; dialogs 14px corners; a 560px drawer for records; `DropdownMenuItem variant="destructive"`                                                                         |

Every piece stamps `data-slot`; a theme restyles it through `[data-slot=…]` CSS (Tier 1) or replaces the DOM through
`BrandComponentsProvider` (Tier 2). Nothing below a component names a hex.

## Checks for a screen

1. Same thing, same name, same look: search the screen for synonyms and for a second colour carrying one state.
2. Exceptions get colour, normal stays quiet: squint; only what needs the operator has a tone.
3. One primary action per view: more than one green button in the viewport is a bug.
4. Numbers before narrative: the top 300px answer "is anything wrong, and how much?".
5. Colour never works alone: every state carries a label or an icon; view in greyscale.
6. Installed is not licensed: lapse the license; the nav entry, the route and the free tier all survive.
