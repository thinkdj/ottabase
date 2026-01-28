# @ottabase/forms

Auto-generated CRUD forms from OttaORM model metadata.

## Quick Start

```tsx
import { ModelCrud } from "@ottabase/forms";
import { Todo } from "@/ottabase/models/Todo";

// Full CRUD interface (list, create, edit, view)
<ModelCrud
  model={Todo}
  apiEndpoint="/api/ottaorm/todos"
/>
```

## Components

### ModelCrud

Complete CRUD interface with list, create, edit, and view modes.

```tsx
import { ModelCrud } from "@ottabase/forms";

<ModelCrud
  model={Todo}
  apiEndpoint="/api/ottaorm/todos"
  defaultMode="list"  // "list" | "create" | "edit" | "view"
  onSuccess={(data) => console.log("Saved:", data)}
/>
```

### ModelTable

Data table with sorting, pagination, and actions.

```tsx
import { ModelTable } from "@ottabase/forms";

<ModelTable
  model={Todo}
  data={todos}
  onEdit={(item) => setEditId(item.id)}
  onDelete={(item) => deleteTodo(item.id)}
  onView={(item) => setViewId(item.id)}
/>
```

### ModelForm

Auto-generated form from model field metadata.

```tsx
import { ModelForm } from "@ottabase/forms";

<ModelForm
  model={Todo}
  initialData={todo}
  onSubmit={async (data) => {
    await saveTodo(data);
  }}
  mode="edit"  // "create" | "edit"
/>
```

### ModelDetail

Read-only detail view.

```tsx
import { ModelDetail } from "@ottabase/forms";

<ModelDetail
  model={Todo}
  data={todo}
  onEdit={() => setMode("edit")}
/>
```

### FormField

Individual form field renderer.

```tsx
import { FormField } from "@ottabase/forms";

<FormField
  field={model.getFields().title}
  value={formData.title}
  onChange={(value) => setFormData({ ...formData, title: value })}
/>
```

## Model Configuration

Forms are generated from `fields` metadata in your OttaORM model:

```typescript
export class Todo extends BaseModel {
  static entity = "todos";
  static table = todosTable;

  protected static fields: ModelFields = {
    title: {
      type: "string",
      editable: true,
      searchable: true,
      sortable: true,
      uiConfig: {
        label: "Title",
        placeholder: "Enter title...",
        description: "Task title",
      },
      formConfig: {
        visible: true,
        fieldType: "input",  // input | textarea | select | checkbox | date
      },
      tableConfig: {
        visible: true,
        colWidth: "auto",
      },
      validation: {
        rules: "required|min:3",
        messages: {
          required: "Title is required",
          min: "Minimum 3 characters",
        },
      },
    },
  };
}
```

## Custom Model Config

Override model configuration for forms:

```tsx
import { createModelConfig, ModelCrud } from "@ottabase/forms";

const todoConfig = createModelConfig(Todo, {
  title: "Todo List",
  fields: {
    title: { formConfig: { fieldType: "textarea" } },
  },
});

<ModelCrud config={todoConfig} apiEndpoint="/api/ottaorm/todos" />
```

## Exports

```typescript
// Components
import { ModelCrud, ModelTable, ModelForm, ModelDetail, FormField } from "@ottabase/forms";

// Utilities
import { createModelConfig, defineModelConfig } from "@ottabase/forms";

// Types
import type {
  ModelConfig,
  CrudViewMode,
  FormFieldType,
  ModelCrudProps,
  ModelTableProps,
  ModelFormProps,
} from "@ottabase/forms";
```
