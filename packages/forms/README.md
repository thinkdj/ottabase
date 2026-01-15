# @ottabase/forms

Auto-generated CRUD forms from OttaORM model metadata with built-in validation and field rendering.

## Features

- Auto-generate forms from OttaORM model metadata
- Built-in field types (text, textarea, select, checkbox, date)
- Form validation from model field metadata
- Integration with TanStack Query for data fetching
- Relationship handling (belongsTo, hasMany select fields)

## Installation

```bash
pnpm add @ottabase/forms @ottabase/ottaorm
```

## Quick Start

### Define Model with Field Metadata

```typescript
import { BaseModel } from "@ottabase/ottaorm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export class Todo extends BaseModel {
  static entity = "todos";
  static table = todosTable;

  protected static fields = {
    title: {
      type: 'string',
      editable: true,
      uiConfig: {
        label: 'Title',
        placeholder: 'Enter todo title',
      },
      formConfig: {
        visible: true,
        fieldType: 'input',
      },
      validation: {
        rules: "required",
        messages: {
          required: "Title is required",
        }
      }
    },
    completed: {
      type: 'boolean',
      editable: true,
      uiConfig: {
        label: 'Completed',
      },
      formConfig: {
        visible: true,
        fieldType: 'checkbox',
      },
    },
  };
}
```

### Generate Form

```typescript
import { ModelForm } from "@ottabase/forms";
import { Todo } from "./models/Todo";

export function TodoForm({ id, onSuccess }: { id?: string; onSuccess?: () => void }) {
  return (
    <ModelForm
      model={Todo}
      recordId={id}
      onSuccess={onSuccess}
      onCancel={() => router.back()}
    />
  );
}
```

## Common Use Cases

### Create Form

```typescript
<ModelForm
  model={Todo}
  onSuccess={() => router.push('/todos')}
/>
```

### Edit Form

```typescript
<ModelForm
  model={Todo}
  recordId="todo-123"
  onSuccess={() => router.push('/todos')}
/>
```

### Custom Field Rendering

```typescript
<ModelForm
  model={Todo}
  recordId={id}
  renderField={(fieldName, fieldConfig, value, onChange) => {
    if (fieldName === 'priority') {
      return (
        <PrioritySelector
          value={value}
          onChange={onChange}
          label={fieldConfig.uiConfig.label}
        />
      );
    }
    return null; // Use default rendering
  }}
/>
```

### With Relationship Fields

```typescript
// In your model
protected static fields = {
  userId: {
    type: 'string',
    editable: true,
    uiConfig: {
      label: 'Assigned User',
    },
    formConfig: {
      visible: true,
      fieldType: 'select',
      selectOptions: async () => {
        const users = await User.all();
        return users.map(u => ({ value: u.id, label: u.name }));
      },
    },
  },
};
```

## API Reference

### `ModelForm`

Main form component for CRUD operations.

**Props:**
- `model` - OttaORM model class
- `recordId?` - Record ID for edit mode (omit for create)
- `onSuccess?` - Callback after successful save
- `onCancel?` - Callback for cancel action
- `renderField?` - Custom field renderer
- `excludeFields?` - Array of field names to exclude

## Field Types

Supported `formConfig.fieldType` values:
- `'input'` - Text input
- `'textarea'` - Multi-line text
- `'select'` - Dropdown select
- `'checkbox'` - Boolean checkbox
- `'date'` - Date picker
- `'number'` - Number input

## License

MIT
