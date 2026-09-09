---
name: ottabase-component
description:
    The Ottabase way to build a UI component that behaves like a first-class framework component — CVA variants,
    data-slot parts, token-driven styling, and the brand override registry. Use for "new component", "make this
    themeable", "add a variant/size", "component parts", "override a built-in component". Encodes the two-tier model and
    the (deliberate) absence of a component factory.
---

# Building a first-class component the Ottabase way

`@ottabase/ui-shadcn` components follow a consistent recipe. There is **no `styled()` / `createPolymorphicComponent`
factory** in ui-shadcn — you assemble the pieces by hand (that's the convention, not a gap). Match it and your component
participates in theming like a built-in.

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
    import { useBrandComponent } from '@ottabase/ui-shadcn/providers/brand-components';
    const Override = useBrandComponent('my-widget'); // called unconditionally
    if (Override) return <Override {...props} />;
    // else render the native element with data-slot stamps
    ```
    An app registers overrides with `<BrandComponentsProvider overrides={{ 'my-widget': MyWidget }}>` (nests/merges with
    parent).

## Two-tier model (know which you need)

- **Tier 1 — CSS via `data-slot`** for restyling (color, spacing, radius). Almost always enough.
- **Tier 2 — `useBrandComponent` override** only when the component's **DOM structure** must genuinely differ.

## Gotchas

- Don't reach for Mantine's `factory`/`createPolymorphicComponent` inside ui-shadcn work — that's the separate
  `@ottabase/ui-mantine` stack. Pick one stack per surface (ui-shadcn is the documented default).
- Accessibility: build on Radix/cmdk primitives so focus trap / Escape / ARIA come for free; a hand-rolled interactive
  component owns all of that itself.
- Always ship dark-mode-correct styling (tokens make this automatic).

## Authoritative sources

`packages/ui-shadcn/providers/brand-components.tsx`, `components/ui/button.tsx` + `input.tsx` (the reference
implementations), `AGENTS.MD` → "Theme-safe UI". Full docs: `/llms-full.txt`.
