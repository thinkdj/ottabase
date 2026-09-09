---
name: ottabase-form
description:
    The Ottabase way to build forms — model-driven CRUD forms via @ottabase/forms, or custom forms via the ui-shadcn
    Form primitives. Use for "build a form", "edit/create screen", "form validation", "field metadata", "a form for this
    model". Steers to the config-driven path and away from per-keystroke controlled state.
---

# Forms the Ottabase way

Two paths. Prefer the first for anything backed by a model.

## Model-backed forms (the 90% case)

Field UI + validation come from the **model's field metadata** (single source of truth — the same metadata drives the
table and detail views). Build the config, drop in the component:

```tsx
import { createModelConfig } from '@ottabase/forms'; // headless: config + Zod only
import { ModelForm, ModelCrud } from '@ottabase/forms/react'; // rendered UI lives behind /react
const config = createModelConfig(Todo);
// <ModelForm config={config} onSuccess={...} />   — a single create/edit form
// <ModelCrud config={config} />                     — full list + detail + create/edit/delete
```

The root `@ottabase/forms` is **headless** (zero rendered UI, tree-shakeable); rendered components (`FormField`,
`ModelForm`, `ModelTable`, `ModelDetail`, `ModelCrud`) import from `@ottabase/forms/react`. Define field descriptors on
the model, not in the form.

## Custom forms (not model-shaped)

Use the `@ottabase/ui-shadcn` form primitives (react-hook-form backed): `Form`, `FormField`, `FormItem`, `FormLabel`,
`FormControl`, `FormDescription`, `FormMessage`, and the `useFormField` context hook. These are uncontrolled/ref-based —
a large admin form does **not** re-render on every keystroke. Native `<form>` submission + `FormData` are supported.

## Rules

- **Submit through a mutation hook, never raw `fetch()`** (lint-banned). Reads via a query hook.
- Server returns field errors through `errorResponse(...)`; parse them back onto the form.
- Controlled _and_ uncontrolled both work on inputs (`value`/`onChange` and `defaultValue`). Prefer uncontrolled for big
  forms.

## Gotcha

The auto-generated `ModelForm` currently holds form state in `useState` and re-renders per keystroke — fine for small
forms; for a large administrative form prefer the react-hook-form primitives above. (Making `ModelForm` uncontrolled is
a known roadmap item.)

## Authoritative sources

`packages/forms/README.md`, `packages/forms/src/index.ts` (headless exports) + `src/react.ts`. `AGENTS.MD` → "Client
Data Layer". Full docs: `/llms-full.txt`.
