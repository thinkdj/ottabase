# @ottabase/forms

Auto-generated CRUD Forms for OttaORM fat models. Zero config, real-time Zod validation, works standalone or with
ModelCrud.

## Two entry points (headless vs rendered UI)

This package ships as two subpaths so a consumer that only needs config/schema logic never pulls in the React UI (or its
UI dependencies):

| Import                  | Contents                                                                                     | Deps pulled in                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `@ottabase/forms`       | **Headless.** `createModelConfig`, `defineModelConfig`, Zod schema generation, and all types | Zero rendered UI — only `@ottabase/ottaorm` + `zod`                                            |
| `@ottabase/forms/react` | **Rendered UI.** `ModelForm`, `ModelCrud`, `ModelTable`, `ModelDetail`, `FormField`          | React + the UI packages (`@ottabase/ui`, `ui-datatable`, `ottaselect`, `lucide-react`, `clsx`) |

The UI packages are declared as **optional peer dependencies**, so installing `@ottabase/forms` for headless use does
not force them into your dependency tree. Install them only when you import from `@ottabase/forms/react`.

```tsx
// Headless — config + schema only, no UI
import { createModelConfig, defineModelConfig } from '@ottabase/forms';
import type { ModelConfig } from '@ottabase/forms';

// Rendered components live under the /react subpath
import { ModelCrud, ModelForm } from '@ottabase/forms/react';
```

## Features

- **Auto-generated Forms**: Create/edit forms instantly from OttaORM model field metadata.
- **Auto-generated Tables**: Display model data in sortable, paginated tables (powered by `@ottabase/ui-datatable`).
- **CRUD Views**: Full `ModelCrud` component for List, Create, Update, and Detail views.
- **Zod Validation**: Real-time client-side validation (on blur + on submit) built from field metadata.
- **OttaORM Validation**: Server-side validation via `Model.validate()` before create/update.
- **Standalone Forms**: Use `action` prop to POST/PATCH directly to any endpoint.
- **Model Defaults**: Respects `static defaults` from OttaORM models in create forms.
- **OttaSelect**: Relationship fields use `@ottabase/ottaselect` for single/multi-select.
- **JSON Editor**: JSON fields use the in-house `JsonEditor` from `@ottabase/ui/json-editor` (Tree + Raw modes, inline
  editing, live validation).
- **Type-safe**: Full TypeScript, seamlessly integrates with OttaORM types.

## Installation

```bash
pnpm add @ottabase/forms @ottabase/ottaorm zod
```

## Usage

### From OttaORM Model (recommended)

```tsx
import { createModelConfig } from '@ottabase/forms';
import { ModelCrud } from '@ottabase/forms/react';
import { Tag } from '@ottabase/ottaorm/models';

const tagConfig = createModelConfig(Tag);

export function TagManagement() {
    return <ModelCrud config={tagConfig} apiBasePath="/api/ottaorm" />;
}
```

### Request client integration

Rendered OttaForms components require the request client provided by `OttaQueryProvider`. This keeps authentication
headers, tenant context, cancellation, and structured HTTP status errors consistent with the rest of the app.
`ModelCrud`, standalone `ModelForm` actions, relationship lookups, and uploads all follow this single request path.

`ModelCrud` list/detail failures reach the provider's `errorReporter` once, after any safe-read retry budget is
exhausted. Its create/update/delete failures and standalone form actions use inline state (plus standalone `onError`);
relationship and upload failures render beside the field. The request transport itself never creates UI notifications.

```tsx
import { createApiClient } from '@ottabase/api';
import { defineModelConfig } from '@ottabase/forms';
import { ModelCrud } from '@ottabase/forms/react';
import { OttaQueryProvider } from '@ottabase/ottaorm/client';

const todoConfig = defineModelConfig({
    entity: 'todos',
    fields: {
        id: { type: 'id', primaryKey: true },
        title: { type: 'string', editable: true },
    },
});

const api = createApiClient();

function reportTerminalError(error: unknown) {
    // Replace with the app's toast/telemetry integration.
    console.error(error);
}

export function App({
    currentOrganizationId,
    currentUserId,
}: {
    currentOrganizationId: string | null;
    currentUserId: string | null;
}) {
    return (
        <OttaQueryProvider
            apiClient={api}
            visibilityScope={{
                appId: 'my-app',
                organizationId: currentOrganizationId,
                principalId: currentUserId,
            }}
            errorReporter={reportTerminalError}
        >
            <ModelCrud config={todoConfig} />
        </OttaQueryProvider>
    );
}
```

Configure custom transports once through `OttaQueryProvider`; model and field configuration cannot bypass the provider
client. Create and update submissions are awaited, and canonical server `fieldErrors` are rendered inline.

### Standalone Form (no ModelCrud)

```tsx
import { defineModelConfig } from '@ottabase/forms';
import { ModelForm } from '@ottabase/forms/react';

const todoConfig = defineModelConfig({
    entity: 'todos',
    displayName: 'Todo',
    fields: {
        id: { type: 'id', primaryKey: true },
        title: {
            type: 'string',
            editable: true,
            validation: { rules: 'required', messages: { required: 'Title is required' } },
        },
        done: { type: 'boolean', editable: true },
    },
});

// With action endpoint (POST directly)
<ModelForm config={todoConfig} mode="create" action="/api/todos" onSuccess={(todo) => console.log('Created:', todo)} />;

// With onSubmit callback
<ModelForm config={todoConfig} mode="create" onSubmit={(data) => saveTodo(data)} />;
```

### Individual Components

```tsx
import { ModelForm, ModelTable, ModelDetail, FormField } from '@ottabase/forms/react';
```

## Validation

Validation is driven by field metadata `validation.rules` (pipe-separated):

```typescript
fields: {
    email: {
        type: 'string',
        editable: true,
        validation: {
            rules: 'required|email',
            messages: {
                required: 'Email is required',
                email: 'Must be a valid email',
            },
        },
    },
    age: {
        type: 'integer',
        editable: true,
        validation: { rules: 'required|min:0|max:150' },
    },
}
```

**Supported rules**: `required`, `email`, `url`, `min:N`, `max:N`

### How it works

1. `createModelConfig()` / `defineModelConfig()` auto-builds Zod schemas from field metadata
2. `ModelForm` validates per-field on blur, all fields on submit
3. `BaseModel.create()` / `update()` validates server-side before DB write
4. Same field metadata drives both client and server validation (DRY)

### Server-side validation

```typescript
// Automatic - happens in BaseModel.create() and BaseModel.update()
const user = await User.create({ name: '', email: 'bad' });
// → throws Error('Validation failed: Name is required')

// Manual
const result = User.validate({ name: 'John', email: 'bad' }, 'create');
// → { success: false, errors: { email: 'Invalid email format' } }
```

## Configuration

### From Model (`createModelConfig`)

```typescript
const config = createModelConfig(Tag, {
    displayName: 'Topic', // Override display name
    apiPath: '/api/custom/tags', // Override API path
});
```

`createModelConfig` pulls model defaults from `static defaults` and `uiConfig.defaultValue` and applies them to create
forms.

### Manual (`defineModelConfig`)

```typescript
const config = defineModelConfig({
    entity: 'products',
    displayName: 'Product',
    fields: {
        id: { type: 'id', primaryKey: true },
        name: { type: 'string', editable: true, searchable: true, validation: { rules: 'required' } },
        price: { type: 'number', editable: true, validation: { rules: 'required|min:0' } },
        category: {
            type: 'string',
            editable: true,
            formConfig: {
                fieldType: 'select',
                options: [
                    { id: 'electronics', name: 'Electronics' },
                    { id: 'books', name: 'Books' },
                ],
            },
        },
    },
});
```

## Field Types

| Field Type    | Renders As                      |
| ------------- | ------------------------------- |
| `input`       | Text input                      |
| `textarea`    | Multi-line textarea             |
| `number`      | Number input with min/max/step  |
| `email`       | Email input                     |
| `password`    | Password with show/hide + hints |
| `url`         | URL input                       |
| `tel`         | Phone input                     |
| `date`        | Date picker                     |
| `datetime`    | DateTime picker                 |
| `time`        | Time picker                     |
| `boolean`     | Checkbox                        |
| `select`      | OttaSelect (single)             |
| `multiselect` | OttaSelect (multiple)           |
| `file`        | File upload with drag/drop      |
| `image`       | Image upload with preview       |
| `json`        | JSON editor (edit + tree view)  |
| `editor`      | JSON editor (EditorJS format)   |
| `hidden`      | Hidden input                    |
| `readonly`    | Read-only display               |

## Accessibility, SSR & performance

- **Accessibility** — rendered components build on the `@ottabase/ui` form primitives (react-hook-form backed): every
  field gets a label association, `aria-invalid` / `data-error` on the control, and an error message wired via
  `aria-describedby`. Keyboard and focus behavior come from those primitives; you don't re-implement them.
- **SSR** — components are client-rendered (TanStack Query). Validation is isomorphic: the same Zod schema
  (`buildZodSchema`) runs client-side for UX and server-side as the trust boundary (see
  [Server-side validation](#server-side-validation)). No special hydration handling is required.
- **Performance** — the root `@ottabase/forms` entry is headless (zero rendered UI, tree-shakeable), so importing config
  builders never pulls in React components. **Caveat:** the generated `ModelForm` currently holds field state in
  `useState` and re-renders on each keystroke — fine for typical forms; for a very large administrative form prefer the
  `@ottabase/ui` react-hook-form primitives directly (uncontrolled, no per-keystroke re-render).

## CrudHub (generic admin data screens)

CrudHub renders any model that opted in with `static admin` (see the OttaORM README) from the descriptors the worker
serves at `GET /api/admin/crudhub`. Models are server code, so nothing here imports a model class.

```tsx
import { CrudHubDirectory, CrudHubList, CrudHubDetail, CrudHubForm, useCrudHubModels } from '@ottabase/forms/react';

const models = useCrudHubModels(); // { models: CrudHubModelDescriptor[] }
<CrudHubDirectory models={models.data.models} onNavigate={(path) => navigate({ to: path })} />;
<CrudHubList model={model} state={{ page, search }} onStateChange={patch} onNavigate={go} canWrite />;
<CrudHubDetail model={model} id={id} onNavigate={go} />;
<CrudHubForm model={model} id={id} onNavigate={go} />; // id undefined = create
```

What the pieces do:

- **Directory**: search as you type, groups Core / one heading per package / App, a card per model with a lazy row count
  and chips (package, scope, read-only).
- **List**: server search on the model's search field (debounced, "Reset" while active, disabled with a hint when there
  is none), column menu (sort ascending / descending, choosing the active one clears it, hide), the stale rows stay
  under a blurred overlay while the next page loads, 5 / 10 / 20 / 50 / 100 rows per page, first / previous / next /
  last. Row menu: the model's actions (only those whose `when` passed server-side), View, Edit, Copy ID (copies
  `model:id` and flashes the row), Delete behind `ConfirmDialog`. Bulk actions for `bulk: true` actions with a summary
  toast. `page` and `search` live in the URL (the host passes them in `state`); page size, sort and visible columns are
  remembered per model in localStorage (`ottabase.crudhub.<entity>`), URL winning over storage.
- **Cells** (`CrudHubCell`): a registered client renderer first (`registerCrudHubRenderer('posts.status', fn)`), then
  the title field as a link to details plus a pencil to edit, then by type: ids shortened to `abcd…wxyz` (full in
  details, click to copy), Yes / No, dates in the user's timezone and locale with the raw value in the tooltip, JSON as
  a preview chip opening a viewer, URLs as middle-truncated external links, arrays and objects inline. Empties are typed
  and grey italic: `null`, `—` (undefined), `''`, `[]`, `{}`.
- **Details**: title, `Model · id` with copy, the model's actions, Edit and Delete; every field through the cell
  renderer in details mode; then a "Related" section for the model's `admin.relations`, one chip per related row (linked
  to its own details page when its model is in the hub; pass the directory's `models` to enable links).
- **Form**: `ModelForm` from the descriptor, "Create <model>" / "Save changes" disabled until dirty, server
  `fieldErrors` inline. After a create the host is told to replace the URL with the edit page (the new row is primed in
  the query cache, so there is no reload or refetch flash). Leaving dirty asks "Discard changes?": pass `onDirtyChange`
  and guard navigation in the host (otta-web uses a router blocker, covering links, Back and reload); without it the
  form asks on Cancel only.
- **What a caller may do**: `crudHubAbilities(model, canWrite)`. `readOnly` hides generic New / Edit / Delete but keeps
  the model's actions and a custom `routes.edit` link. `resolveListPrefs` is the URL > storage > model-default rule.

`ModelForm` gained `onDirtyChange`, `disableUntilDirty`, `submitLabel`, `hideHeader` and `cleanKey` for hosts that need
the same behaviour.

## Exports

`@ottabase/forms` (headless — no rendered UI in its import graph):

- **Utilities**: `createModelConfig`, `defineModelConfig`
- **Types**: `ModelConfig`, `ModelCrudProps`, `ModelFormProps`, `ModelTableProps`, `ModelDetailProps`, `FormFieldProps`,
  `FormFieldType`, `CrudViewMode`, `OttaModelClass`, and the re-exported OttaORM types (`ModelFieldType`,
  `ModelFieldDescriptor`, `ModelFields`, `RelationshipConfig`)

`@ottabase/forms/react` (rendered React components):

- **Components**: `ModelCrud`, `ModelForm`, `ModelTable`, `ModelDetail`, `FormField` (plus their prop types)
- **CrudHub**: `CrudHubDirectory`, `CrudHubList`, `CrudHubDetail`, `CrudHubForm`, `CrudHubCell`,
  `registerCrudHubRenderer`, `useCrudHubModels`, `useCrudHubModel`, `crudHubModelConfig`, `crudHubPaths`,
  `fillRouteTokens`, `rowTitle`, `readRemembered`, `writeRemembered`, `CRUDHUB_API`, `CRUDHUB_PATH`
