# @ottabase/ottaselect

A select component that accepts **any object format** and always returns a standardized output. Perfect for React applications with dynamic data sources and CrudHub integration.

## Key Features

- **Flexible Input** - Accepts any object with `id` and `name`/`label`/`title` properties
- **Standardized Output** - Always returns `{ id, name, data }` format where `data` contains the original object
- **Single and Multi-select modes** - Choose between selecting one item or multiple items
- **Real-time search** - Debounced search with client-side or server-side filtering
- **CrudHub Integration** - Built-in async collection fetching support
- **Loading & Error states** - Beautiful loading indicators and error handling
- **Keyboard navigation** - Full keyboard support (Arrow keys, Enter, Escape)
- **Clear functionality** - Optional clear button for easy deselection
- **Custom headers/footers** - Add custom UI elements above and below the list
- **Optimized item merging** - Selected items always visible and properly merged with collection
- **Minimalistic design** - Clean, modern UI based on Tailwind CSS

## Installation

```bash
pnpm add @ottabase/ottaselect
```

## Core Concept

**Input**: Any object with these properties:
- `id` (required) - Unique identifier
- `name` OR `label` OR `title` (required) - Display text (checks in that order)
- ...any other properties

**Output**: Original object with normalized `id` and `name`:
```typescript
{
  id: string,        // Normalized to string
  name: string,      // Normalized from name/label/title
  ...allOtherProps   // All original properties preserved
}
```

## Usage

### Basic Single Select

```tsx
import { OttaSelect, OttaSelectItem } from '@ottabase/ottaselect';
import { useState } from 'react';

// Your data can have any shape - just needs id and name/label/title
const products = [
  { id: '1', name: 'Apple', category: 'Fruit', price: 2.99, inStock: true },
  { id: '2', name: 'Banana', category: 'Fruit', price: 1.99, inStock: true },
  { id: '3', name: 'Carrot', category: 'Vegetable', price: 0.99, inStock: false },
];

function MyComponent() {
  const [value, setValue] = useState<OttaSelectItem | null>(null);

  return (
    <OttaSelect
      mode="single"
      items={products}
      value={value}
      onChange={setValue}
      placeholder="Select a product"
    />
  );
}

// On selection, you get the object with normalized id and name:
// {
//   id: '1',
//   name: 'Apple',
//   category: 'Fruit',
//   price: 2.99,
//   inStock: true
// }
```

### Flexible Input with "label" Property

```tsx
// Works with 'label' instead of 'name'
const users = [
  { id: 'user-1', label: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { id: 'user-2', label: 'Jane Smith', email: 'jane@example.com', role: 'User' },
];

<OttaSelect
  mode="single"
  items={users}
  value={value}
  onChange={setValue}
  placeholder="Select a user"
/>

// Output (label normalized to name):
// {
//   id: 'user-1',
//   label: 'John Doe',
//   name: 'John Doe',    // Normalized from 'label'
//   email: 'john@example.com',
//   role: 'Admin'
// }
```

### Flexible Input with "title" Property

```tsx
// Works with 'title' too (fallback chain: name → label → title)
const documents = [
  { id: 'doc-1', title: 'Getting Started', type: 'Tutorial', pages: 12 },
  { id: 'doc-2', title: 'API Reference', type: 'Reference', pages: 45 },
];

<OttaSelect
  mode="single"
  items={documents}
  value={value}
  onChange={setValue}
  placeholder="Select a document"
/>

// Output (title normalized to name):
// {
//   id: 'doc-1',
//   title: 'Getting Started',
//   name: 'Getting Started',  // Normalized from 'title'
//   type: 'Tutorial',
//   pages: 12
// }
```

### Multi Select

```tsx
import { OttaSelectItem } from '@ottabase/ottaselect';

function MyComponent() {
  const [value, setValue] = useState<OttaSelectItem[] | null>(null);

  return (
    <OttaSelect
      mode="multiple"
      items={products}
      value={value}
      onChange={setValue}
      placeholder="Select products"
    />
  );
}

// Output (array format with all properties):
// [
//   { id: '1', name: 'Apple', category: 'Fruit', price: 2.99, inStock: true },
//   { id: '2', name: 'Banana', category: 'Fruit', price: 1.99, inStock: true }
// ]
// or null when all items are deselected
```

### With Async Fetch (CrudHub Integration)

```tsx
// Your API can return any object format
async function fetchUsers(searchQuery: string) {
  const response = await fetch(`/api/users?search=${searchQuery}`);
  const users = await response.json();

  // Return objects with any shape - component normalizes them
  return users; // e.g., [{ id: 1, label: 'John', email: '...', ... }]
}

function UserSelector() {
  const [selectedUser, setSelectedUser] = useState<OttaSelectItem | null>(null);

  return (
    <OttaSelect
      mode="single"
      fetchCollection={fetchUsers}
      value={selectedUser}
      onChange={setSelectedUser}
      placeholder="Search users..."
      searchDebounceMs={300}
      loadingMessage="Loading users..."
      errorMessage="Failed to load users"
    />
  );
}

// Output with normalized id and name:
// {
//   id: '1',
//   label: 'John',
//   name: 'John',  // Normalized from 'label'
//   email: 'john@example.com',
//   role: 'Admin',
//   ...allOtherProps
// }
```

### Accessing Original Data

```tsx
const [selected, setSelected] = useState<OttaSelectItem | null>(null);

// After selection, access properties directly
if (selected) {
  console.log(selected.id);        // Normalized id (string)
  console.log(selected.name);      // Normalized name (from name/label/title)
  console.log(selected.price);     // Access original properties directly
  console.log(selected.category);  // All original properties are preserved
  console.log(selected.inStock);   // Any custom property
}
```

### Atomic Import (Better Tree Shaking)

```tsx
// Atomic import - only imports this component
import { OttaSelect } from '@ottabase/ottaselect/ottaselect';

// Barrel import - imports all exports
import { OttaSelect } from '@ottabase/ottaselect';
```

## TypeScript Types

```typescript
// Output item - original object with normalized id and name
interface OttaSelectItem extends Record<string, any> {
  id: string;   // Normalized to string
  name: string; // Normalized from name/label/title
  // ...all other original properties preserved
}

// Input item - can be any object
type OttaSelectInputItem = Record<string, any>;

interface OttaSelectProps {
  // Mode configuration
  mode?: 'single' | 'multiple';  // Default: 'single'

  // Value management - always uses standardized format
  value?: OttaSelectItem | OttaSelectItem[] | null;
  onChange?: (value: OttaSelectItem | OttaSelectItem[] | null) => void;

  // Data source - accepts any object format
  items?: OttaSelectInputItem[];  // Static items
  fetchCollection?: (searchQuery: string) => Promise<OttaSelectInputItem[]>;  // Async

  // Search configuration
  searchable?: boolean;  // Default: true
  searchDebounceMs?: number;  // Default: 300
  searchPlaceholder?: string;  // Default: 'Search...'

  // UI customization
  placeholder?: string;  // Default: 'Select an option'
  disabled?: boolean;  // Default: false
  clearable?: boolean;  // Default: true
  header?: React.ReactNode;  // Custom header content
  footer?: React.ReactNode;  // Custom footer content

  // Styling
  className?: string;  // Container className
  dropdownClassName?: string;  // Dropdown className

  // Display options
  maxDisplayItems?: number;  // Default: 100
  emptyMessage?: string;  // Default: 'No options found'
  loadingMessage?: string;  // Default: 'Loading...'
  errorMessage?: string;  // Default: 'Error loading options'
}
```

## Output Format

### Single Mode
When `mode="single"`, returns:
- A single `OttaSelectItem` object when an item is selected
- `null` when no item is selected

```typescript
{
  id: '1',
  name: 'Apple',
  category: 'Fruit',
  price: 2.99,
  ...allOtherProps
}
// or null
```

### Multiple Mode
When `mode="multiple"`, returns:
- An array of `OttaSelectItem` objects when items are selected
- `null` when no items are selected (all deselected)

```typescript
[
  { id: '1', name: 'Apple', category: 'Fruit', price: 2.99 },
  { id: '2', name: 'Banana', category: 'Fruit', price: 1.99 }
]
// or null
```

## Input Flexibility

The component accepts **any object** as input as long as it has:
1. An `id` property (string or number)
2. A display text property using one of: `name`, `label`, or `title` (checked in that order)

### Examples of Valid Input Formats

```typescript
// Format 1: Using 'name'
const items1 = [
  { id: 1, name: 'Item 1', custom: 'value' }
];

// Format 2: Using 'label'
const items2 = [
  { id: 'abc', label: 'Item 1', email: 'test@example.com' }
];

// Format 3: Using 'title'
const items3 = [
  { id: '123', title: 'Item 1', type: 'document' }
];

// Format 4: Complex objects with many properties
const items4 = [
  {
    id: 'prod-1',
    name: 'Product Name',
    category: 'Electronics',
    price: 99.99,
    inStock: true,
    metadata: { weight: '1kg', color: 'blue' },
    tags: ['new', 'featured']
  }
];

// All formats work! The component normalizes them internally
// and returns { id, name, data } where data contains the original object
```

## Key Behaviors

### Name Property Fallback
The component looks for a display name in this order:
1. `item.name` - First choice
2. `item.label` - Second choice (if name doesn't exist)
3. `item.title` - Third choice (if name and label don't exist)

### Data Preservation

The original input object is **always preserved** with normalized `id` and `name`:

- Input: `{ id: 1, name: 'Apple', category: 'Fruit', price: 2.99 }`
- Output: `{ id: '1', name: 'Apple', category: 'Fruit', price: 2.99 }`

Note: `id` is normalized to a string, and `name` is added/normalized from name/label/title.

### Search Behavior

**Client-side search** (when using `items` prop):
- Filters items locally based on name matching
- Instant results, no network requests
- Good for static or smaller datasets

**Server-side search** (when using `fetchCollection` prop):
- Calls `fetchCollection` with the debounced search query
- Shows loading state during fetch
- Selected items remain visible even if not in search results
- Good for large datasets or dynamic data

### Keyboard Navigation

- **Arrow Down/Up**: Navigate through items
- **Enter**: Select focused item
- **Escape**: Close dropdown and clear search
- **Space/Enter** (on trigger): Open dropdown

## Dark Mode Support

The component includes full dark mode support using Tailwind's `dark:` variant. It automatically adapts to your application's dark mode setting.

**Features in Dark Mode:**

- Darker backgrounds (gray-800/900)
- Adjusted borders and text colors
- Proper contrast for all states (hover, focus, selected)
- Consistent icon colors
- Smooth transitions between modes

**Setup:**

Make sure your Tailwind config has dark mode enabled:

```javascript
module.exports = {
  darkMode: 'class', // or 'media' for system preference
  // ... rest of config
};
```

The component will automatically respond to dark mode when the `dark` class is applied to a parent element (typically `<html>` or `<body>`).

## Tailwind Configuration

Include the package source in your `tailwind.config.js`:

```javascript
module.exports = {
  darkMode: 'class', // Enable dark mode
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    // Include ottaselect package
    '../../packages/ottaselect/src/**/*.{js,ts,jsx,tsx}',
  ],
  // ... rest of config
};
```

## Dependencies

### Peer Dependencies
- `react` >= 18.0.0
- `react-dom` >= 18.0.0

### Dependencies
- `clsx` - Utility for conditional classNames
- `lucide-react` - Icon components
- `@ottabase/config` - Configuration utilities

## Comparison with Other Select Components

| Feature | OttaSelect | Standard Select |
|---------|-----------|----------------|
| Flexible Input | ✅ Any object format | ❌ Requires specific format |
| Standardized Output | ✅ Normalized id & name | ❌ Returns original format |
| Name Fallbacks | ✅ name/label/title | ❌ Single property only |
| Original Properties | ✅ All preserved | ❌ Lost or requires manual tracking |
| CrudHub Ready | ✅ Built-in async support | ⚠️ Manual implementation |
| Type-safe | ✅ Full TypeScript support | Varies |

## Use Cases

Perfect for:
- **CrudHub Integration** - Works seamlessly with any API response format
- **Dynamic Forms** - Handle different object shapes in one component
- **Data from Multiple Sources** - Normalize various API formats
- **Flexible Schemas** - Work with changing or inconsistent data structures
- **Legacy API Integration** - Adapt old API formats without refactoring

## Examples

Check out the Storybook stories for interactive examples:
- Flexible input formats (name, label, title)
- Single and multi-select modes
- Async fetch/CrudHub integration
- Custom headers and footers
- Loading and error states
- Keyboard navigation
- Pre-selected values
- Various configurations

## License

MIT
