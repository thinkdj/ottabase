---
name: ottabase-component
description:
    The Ottabase way to build a UI component that behaves like a first-class framework component — CVA variants,
    data-slot parts, token-driven styling, and the brand override registry. Use for "new component", "make this
    themeable", "add a variant/size", "component parts", "override a built-in component". Encodes the two-tier model and
    the (deliberate) absence of a component factory.
---

# Building a first-class component the Ottabase way

`@ottabase/ui` components follow a consistent recipe. There is **no `styled()` / `createPolymorphicComponent` factory**
in `@ottabase/ui`: you assemble the pieces by hand (that's the convention, not a gap). Match it and your component
participates in theming like a built-in.

## Where it lives

A component more than one package or app can use goes in `@ottabase/ui`, whether it is a primitive or composed from
primitives (`ConfirmDialog`, `MessageBox`, `SplitPane` are examples). There is no separate shared-components package.

1. One file per component: `packages/ui/components/ui/<kebab-name>.tsx`, named exports only. Import siblings relatively
   (`./button`) and `cn` from `@ottabase/ui/lib/utils`.
2. Start the file with `'use client'` when it holds state, runs effects or reads context.
3. Register it three times: the barrel `components/ui/index.ts` (skip it for a large, rarely used component, which then
   ships only on its own entry, as `JsonEditor` does), the `componentEntries` list in `tsup.config.ts`, and an `exports`
   entry in `package.json`.
4. Tests go in `packages/ui/src/__tests__/`, stories in `packages/ui/stories/`.

A component that only one app or one package renders stays in that app or package (`Logo` lives in otta-web,
`BlogPagination` in `@ottabase/ottablog/pagination`).

## The recipe

1. **Variants/sizes via CVA** — declare a `cva(...)` literal (e.g. `buttonVariants`) with `variant` and `size` keys.
   Reuse the shared vocabulary (`variant`, `size`, `disabled`) — don't invent per-component names.
2. **Stamp named parts + state** — put `data-slot="<part>"` on every meaningful element (compound parts each get their
   own slot), plus `data-variant` / `data-size` and state attrs (`data-state`, `data-active`, `data-error`). Theme CSS
   targets `[data-slot=…]` — this is Tier 1 theming and covers ~90% of cases.
3. **Style from tokens** — read CSS variables (`--primary`, `--radius`, …), never hardcoded colors/sizes, so brand kits
   and dark mode flow through automatically.
4. **Polymorphism** — support `asChild` via Radix `<Slot>` when the element type must change (as `Button` does).
5. **Make it replaceable (Tier 2, optional)** — read the brand override registry so a fork can swap the whole
   implementation:
    ```tsx
    import { useBrandComponent } from '@ottabase/ui/brand-components';
    const Override = useBrandComponent('my-widget'); // called unconditionally
    if (Override) return <Override {...props} />;
    // else render the native element with data-slot stamps
    ```
    An app registers overrides with `<BrandComponentsProvider overrides={{ 'my-widget': MyWidget }}>` (same subpath;
    nests/merges with parent).

## Two-tier model (know which you need)

- **Tier 1 — CSS via `data-slot`** for restyling (color, spacing, radius). Almost always enough.
- **Tier 2 — `useBrandComponent` override** only when the component's **DOM structure** must genuinely differ.

## Gotchas

- Don't reach for Mantine's `factory`/`createPolymorphicComponent` inside `@ottabase/ui` work: that's the separate
  `@ottabase/ui-mantine` stack. Pick one stack per surface (`@ottabase/ui` is the documented default).
- Icons come from `lucide-react`, the set `@ottabase/ui` itself uses.
- Accessibility: build on Radix/cmdk primitives so focus trap / Escape / ARIA come for free; a hand-rolled interactive
  component owns all of that itself.
- Always ship dark-mode-correct styling (tokens make this automatic).

## Authoritative sources

`packages/ui/providers/brand-components.tsx`, `components/ui/button.tsx` + `input.tsx` (the reference implementations),
`AGENTS.MD` → "Theme-safe UI". Full docs: `/llms-full.txt`.
