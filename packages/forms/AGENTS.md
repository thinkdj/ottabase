# @ottabase/forms — agent notes

React CRUD UI (list/create/edit/detail) auto-generated from OttaORM model metadata. Full docs: ./README.md

## Use when

- Building admin/CRUD React UIs for OttaORM models, or metadata-driven standalone forms with Zod validation.
- NOT for fully custom, non-model form layouts, or server-side-only validation (that lives in OttaORM's Model.validate).

## Imports

```ts
import { ModelCrud, ModelForm, ModelTable, ModelDetail, FormField } from '@ottabase/forms';
import { createModelConfig, defineModelConfig } from '@ottabase/forms';
import type { ModelConfig, ModelCrudProps, ModelFormProps, OttaModelClass } from '@ottabase/forms';
```

## Canonical usage

```tsx
// Full CRUD from a model class (must be inside a QueryClientProvider)
const userConfig = createModelConfig(User, { displayName: 'User' });
<ModelCrud config={userConfig} apiBasePath='/api/ottaorm' />;
```

```tsx
// Standalone form without ModelCrud: POSTs directly to `action`
const cfg = defineModelConfig({
    entity: 'products',
    fields: {
        id: { type: 'id', primaryKey: true },
        name: { type: 'string', editable: true, searchable: true },
    },
});
<ModelForm config={cfg} mode='create' action='/api/ottaorm/products' onSuccess={(r) => {}} />;
```

## Gotchas

- Peer deps (not bundled): @ottabase/ottaorm, @tanstack/react-query, react, react-dom, zod.
- ModelCrud uses TanStack Query hooks — wrap in QueryClientProvider. Endpoint is `config.apiPath || apiBasePath + '/' + entity` (apiBasePath defaults to '/api/ottaorm').
- Zod schemas are auto-built from field metadata via ottaorm's buildZodSchema; pipe-separated rule strings support required, email, url, min:N, max:N.
- ModelForm: `action` overrides `onSubmit` (POST for create, PATCH for edit); pass server 422 field errors via `serverErrors`.
- Relationship/select fields render via @ottabase/ottaselect; JSON/object fields via @ottabase/ui-components JsonEditor.
- Model `writable.create/update` allowlists on the model class scope which fields the generated schemas accept.
