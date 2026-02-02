# @ottabase/forms

Auto-generated CRUD forms and interfaces from OttaORM model metadata. Build complete admin panels and data management
interfaces with zero configuration.

## Features

- **Auto-generated Forms** - Create, edit, and detail forms from model metadata
- **Type-Safe CRUD** - Full type support for TypeScript models
- **List View with Pagination** - Sortable, searchable data tables with built-in pagination
- **Detail View** - Key-value display with edit/delete capabilities
- **Validation Integration** - Respects model field types and validations
- **Relationship Rendering** - Handle foreign keys and relationships seamlessly
- **Integrated with TanStack Query** - Automatic caching, refetching, and mutations
- **Customizable Fields** - Override default field renderers (select, date, etc.)
- **Delete Confirmation** - Built-in modal for safe deletions
- **Responsive Design** - Mobile-friendly with Tailwind CSS
- **Dark Mode Support** - Full dark mode compatibility

## Installation

```bash
pnpm add @ottabase/forms
```

## Quick Start

```tsx
import { ModelCrud, defineModelConfig } from '@ottabase/forms';
import { User } from './models/User';

const userConfig = defineModelConfig({
    entity: 'users',
    displayName: 'User',
    fields: {
        id: { type: 'string', readonly: true },
        name: { type: 'string', label: 'Full Name' },
        email: { type: 'string', label: 'Email Address' },
        role: { type: 'select', options: ['admin', 'user', 'guest'] },
        active: { type: 'boolean' },
    },
});

function UserManagement() {
    return <ModelCrud config={userConfig} apiBasePath="/api/ottaorm" perPage={10} />;
}
```

## Components

### ModelCrud

Complete CRUD interface with list, detail, create, and edit views:

```tsx
<ModelCrud
    config={userConfig}
    apiBasePath="/api/ottaorm"
    initialMode="list"
    perPage={10}
    selectable={true}
    onCreate={(record) => console.log('Created:', record)}
    onUpdate={(record) => console.log('Updated:', record)}
    onDelete={(id) => console.log('Deleted:', id)}
/>
```

**Props:**

- `config` - Model configuration
- `apiBasePath` - Base API path (default: `/api/ottaorm`)
- `initialMode` - Initial view mode: `list`, `detail`, `create`, `edit`
- `initialRecordId` - ID to load on mount
- `perPage` - Records per page (default: 10)
- `selectable` - Enable multi-select checkbox (default: false)
- `onCreate`, `onUpdate`, `onDelete` - Callbacks for operations

### ModelTable

Standalone table view with sorting and pagination:

```tsx
import { ModelTable } from '@ottabase/forms';

<ModelTable
    config={userConfig}
    data={users}
    total={100}
    page={1}
    perPage={10}
    onPageChange={setPage}
    onView={handleView}
    onEdit={handleEdit}
    onDelete={handleDelete}
    onCreate={handleCreate}
/>;
```

### ModelForm

Standalone create/edit form:

```tsx
import { ModelForm } from '@ottabase/forms';

<ModelForm
    config={userConfig}
    mode="create"
    initialData={initialUser}
    onSubmit={handleSubmit}
    onCancel={handleCancel}
/>;
```

### ModelDetail

Standalone detail view:

```tsx
import { ModelDetail } from '@ottabase/forms';

<ModelDetail config={userConfig} data={user} onEdit={handleEdit} onDelete={handleDelete} onBack={handleBack} />;
```

### FormField

Standalone form field for custom forms:

```tsx
import { FormField } from '@ottabase/forms';

<FormField type="string" label="Name" value={name} onChange={setName} placeholder="Enter name" />;
```

## Model Configuration

Define model metadata for form generation:

```typescript
import { defineModelConfig } from '@ottabase/forms';

const config = defineModelConfig({
    entity: 'posts',
    displayName: 'Blog Post',
    primaryKey: 'id',
    defaultSort: 'createdAt',
    defaultSortDirection: 'desc',
    apiPath: '/api/posts',
    fields: {
        id: {
            type: 'string',
            label: 'ID',
            readonly: true,
        },
        title: {
            type: 'string',
            label: 'Title',
            required: true,
        },
        content: {
            type: 'text',
            label: 'Content',
        },
        status: {
            type: 'select',
            label: 'Status',
            options: ['draft', 'published', 'archived'],
            defaultValue: 'draft',
        },
        publishedAt: {
            type: 'date',
            label: 'Published Date',
        },
        featured: {
            type: 'boolean',
            label: 'Featured Post',
            defaultValue: false,
        },
        userId: {
            type: 'relation',
            label: 'Author',
            relationKey: 'userId',
            relationLabel: 'name',
        },
    },
});
```

## Field Types

Supported field types:

- `string` - Text input
- `text` - Multi-line textarea
- `number` - Number input
- `email` - Email input
- `boolean` - Checkbox
- `date` - Date picker
- `datetime` - Date and time picker
- `select` - Dropdown select
- `multiselect` - Multi-select with chips
- `relation` - Foreign key relationship
- `json` - JSON editor
- `textarea` - Long-form text

## Advanced Usage

### Custom Field Renderers

Override how specific fields are rendered:

```tsx
const config = defineModelConfig({
    entity: 'users',
    fields: {
        role: {
            type: 'select',
            options: ['admin', 'user', 'guest'],
            renderValue: (value) => {
                const icons = { admin: '👑', user: '👤', guest: '👤' };
                return `${icons[value]} ${value}`;
            },
        },
    },
});
```

### Custom API Fetch

Use custom fetch function for authentication or request interception:

```tsx
<ModelCrud
    config={userConfig}
    fetchFn={async (url, options) => {
        const token = localStorage.getItem('token');
        return fetch(url, {
            ...options,
            headers: {
                ...options?.headers,
                Authorization: `Bearer ${token}`,
            },
        });
    }}
/>
```

### Pagination Strategies

Handle different pagination response formats:

```tsx
// OttaORM wrapped response
{
  "users": [...],
  "pagination": { "page": 1, "perPage": 10, "total": 100 }
}

// Simple data response
{
  "data": [...],
  "total": 100,
  "page": 1
}

// Direct array
[...]
```

All formats are automatically detected and handled.

### Multi-Select with Search

Enable selection of multiple records:

```tsx
<ModelCrud
    config={userConfig}
    selectable={true}
    onSelectionChange={(ids) => {
        console.log('Selected IDs:', ids);
    }}
/>
```

## API Requirements

The `ModelCrud` component expects these API endpoints:

**List**: `GET /api/ottaorm/{entity}?page=1&perPage=10`

```json
{
  "data": [...],
  "pagination": { "page": 1, "perPage": 10, "total": 100 }
}
```

**Detail**: `GET /api/ottaorm/{entity}/{id}`

```json
{ "data": {...} }
```

**Create**: `POST /api/ottaorm/{entity}`

```json
{ "data": {...} }
```

**Update**: `PATCH /api/ottaorm/{entity}/{id}`

```json
{ "data": {...} }
```

**Delete**: `DELETE /api/ottaorm/{entity}/{id}`

```json
{ "success": true }
```

## Example: Complete User Management

```tsx
import { ModelCrud, defineModelConfig } from '@ottabase/forms';

const userConfig = defineModelConfig({
    entity: 'users',
    displayName: 'User',
    fields: {
        id: { type: 'string', readonly: true },
        name: { type: 'string', label: 'Name', required: true },
        email: { type: 'email', label: 'Email', required: true },
        role: {
            type: 'select',
            label: 'Role',
            options: ['admin', 'moderator', 'user'],
            defaultValue: 'user',
        },
        active: { type: 'boolean', label: 'Active', defaultValue: true },
        createdAt: { type: 'datetime', label: 'Created', readonly: true },
    },
});

export function AdminPanel() {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-8">User Management</h1>
            <ModelCrud
                config={userConfig}
                perPage={20}
                onCreate={() => window.location.reload()}
                onUpdate={() => window.location.reload()}
                onDelete={() => window.location.reload()}
            />
        </div>
    );
}
```

## License

MIT
