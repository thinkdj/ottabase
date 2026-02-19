# @ottabase/forms

Auto-generated CRUD Forms for OttaORM fat models. Zero config, real-time Zod validation, works standalone or with
ModelCrud.

## Features

- **Auto-generated Forms**: Create/edit forms instantly from OttaORM model field metadata.
- **Auto-generated Tables**: Display model data in sortable, paginated tables.
- **CRUD Views**: Full `ModelCrud` component for List, Create, Update, and Detail views.
- **Zod Validation**: Real-time client-side validation (on blur + on submit) built from field metadata.
- **OttaORM Validation**: Server-side validation via `Model.validate()` before create/update.
- **Standalone Forms**: Use `action` prop to POST/PATCH directly to any endpoint.
- **Model Defaults**: Respects `static defaults` from OttaORM models in create forms.
- **OttaSelect**: Relationship fields use `@ottabase/ottaselect` for single/multi-select.
- **JSON Editor**: JSON fields use `json-edit-react` with tabbed edit/tree view.
- **Type-safe**: Full TypeScript, seamlessly integrates with OttaORM types.

## Installation

```bash
pnpm add @ottabase/forms @ottabase/ottaorm zod
```

## Usage

### From OttaORM Model (recommended)

```tsx
import { ModelCrud, createModelConfig } from '@ottabase/forms';
import { User } from '@ottabase/ottaorm/models';

const userConfig = createModelConfig(User);

export function UserManagement() {
    return <ModelCrud config={userConfig} apiBasePath="/api/ottaorm" />;
}
```

### Standalone Form (no ModelCrud)

```tsx
import { ModelForm, defineModelConfig } from '@ottabase/forms';

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
import { ModelForm, ModelTable, ModelDetail, FormField } from '@ottabase/forms';
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
const config = createModelConfig(User, {
    displayName: 'Member', // Override display name
    apiPath: '/api/custom/users', // Override API path
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

## Exports

- **Components**: `ModelCrud`, `ModelForm`, `ModelTable`, `ModelDetail`, `FormField`
- **Utilities**: `createModelConfig`, `defineModelConfig`
- **Types**: `ModelConfig`, `ModelCrudProps`, `ModelFormProps`, `ModelTableProps`, `ModelDetailProps`, `FormFieldProps`
