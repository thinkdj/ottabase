# @ottabase/ottaselect

A select component that accepts **any object format** and always returns a standardized output. Perfect for React
applications with dynamic data sources and CrudHub integration.

## Key Features

- **Flexible Input** - Accepts any object with `id` and `name`/`label`/`title` properties
- **Standardized Output** - Always returns normalized `{ id, name, ...originalProps }` format
- **Single and Multi-select modes** - Choose between selecting one item or multiple items
- **Custom Renderers** - Customize how items and selected values are displayed (flags, avatars, badges)
- **Chip Display** - Multi-select shows chips with overflow: "Apple, Banana +2 more"
- **Pagination Support** - Selected items persist even when not in current API response
- **Real-time search** - Debounced search with client-side or server-side filtering
- **CrudHub Integration** - Built-in async collection fetching support
- **Loading & Error states** - Beautiful loading indicators and error handling
- **Keyboard navigation** - Full keyboard support (Arrow keys, Enter, Escape)
- **Dark mode** - Full dark mode support with Tailwind CSS

## Installation

```bash
pnpm add @ottabase/ottaselect
```

## Quick Start

```tsx
import { OttaSelect, type OttaSelectItem } from '@ottabase/ottaselect';
import { useState } from 'react';

const products = [
    { id: '1', name: 'Apple', category: 'Fruit', price: 2.99 },
    { id: '2', name: 'Banana', category: 'Fruit', price: 1.99 },
];

function MyComponent() {
    const [value, setValue] = useState<OttaSelectItem | null>(null);

    return (
        <OttaSelect mode="single" items={products} value={value} onChange={setValue} placeholder="Select a product" />
    );
}
```

## Custom Renderers

### Custom Item Display (flags, avatars, badges)

```tsx
import { OttaSelect, type ItemRendererProps } from '@ottabase/ottaselect';

const countries = [
    { id: 'us', name: 'United States', flag: '🇺🇸', code: 'US' },
    { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', code: 'GB' },
    { id: 'jp', name: 'Japan', flag: '🇯🇵', code: 'JP' },
];

// Custom renderer for dropdown items
const CountryRenderer = ({ item }: ItemRendererProps) => (
    <div className="flex items-center gap-2 flex-1">
        <span className="text-lg">{item.flag}</span>
        <span>{item.name}</span>
        <span className="text-xs text-gray-500 ml-auto">{item.code}</span>
    </div>
);

function CountrySelect() {
    const [country, setCountry] = useState(null);

    return (
        <OttaSelect
            mode="single"
            items={countries}
            value={country}
            onChange={setCountry}
            renderItem={CountryRenderer}
            renderValue={(item) => (
                <span>
                    {item.flag} {item.name}
                </span>
            )}
        />
    );
}
```

### User Select with Avatar

```tsx
const users = [
    { id: 'u1', name: 'John Doe', avatar: '👨‍💼', role: 'Admin' },
    { id: 'u2', name: 'Jane Smith', avatar: '👩‍💻', role: 'Editor' },
];

const UserRenderer = ({ item }: ItemRendererProps) => (
    <div className="flex items-center gap-2 flex-1">
        <span>{item.avatar}</span>
        <span className="truncate">{item.name}</span>
        <span className="text-xs bg-blue-100 px-1.5 rounded">{item.role}</span>
    </div>
);

<OttaSelect
    items={users}
    renderItem={UserRenderer}
    renderValue={(item) => (
        <span>
            {item.avatar} {item.name}
        </span>
    )}
/>;
```

## Multi-Select with Chip Display

Multi-select automatically shows selected items as chips with overflow handling:

```
┌─────────────────────────────────────────────────┐
│ [🍎 Apple ✕] [🍌 Banana ✕] +3 more              ▼ │
└─────────────────────────────────────────────────┘
```

```tsx
const [fruits, setFruits] = useState<OttaSelectItem[] | null>(null);

<OttaSelect
    mode="multiple"
    items={fruitsAndVegetables}
    value={fruits}
    onChange={setFruits}
    showChips={true} // Default: true
/>;
```

### Disable Chips (use "N items selected")

```tsx
<OttaSelect
    mode="multiple"
    showChips={false} // Shows "3 items selected" instead
/>
```

## Pagination Support

Selected items persist even when not in the current API response - perfect for paginated APIs:

```tsx
// API only returns first 10 items, but selected items stay visible
const [selected, setSelected] = useState([
    { id: '100', name: 'India', flag: '🇮🇳' }, // Not in API response
    { id: '200', name: 'Brazil', flag: '🇧🇷' }, // Not in API response
]);

<OttaSelect
    mode="multiple"
    fetchCollection={async (search) => {
        // Returns only first 10 matches
        const res = await fetch(`/api/countries?search=${search}&limit=10`);
        return res.json();
    }}
    value={selected}
    onChange={setSelected}
    showSelectedFirst={true} // Selected items appear at top
/>;
```

**Result**: India and Brazil stay visible at the top of the dropdown even though the API doesn't return them!

## Async Fetch (API/CrudHub)

```tsx
async function fetchUsers(searchQuery: string) {
    const response = await fetch(`/api/users?search=${searchQuery}`);
    return response.json();
}

<OttaSelect
    mode="single"
    fetchCollection={fetchUsers}
    value={selectedUser}
    onChange={setSelectedUser}
    searchDebounceMs={300}
    loadingMessage="Loading users..."
    errorMessage="Failed to load users"
/>;
```

## Props Reference

```typescript
interface OttaSelectProps {
    // Mode
    mode?: 'single' | 'multiple'; // Default: 'single'

    // Value
    value?: OttaSelectItem | OttaSelectItem[] | null;
    onChange?: (value: OttaSelectItem | OttaSelectItem[] | null) => void;

    // Data source
    items?: OttaSelectInputItem[];
    fetchCollection?: (searchQuery: string) => Promise<OttaSelectInputItem[]>;

    // Search
    searchable?: boolean; // Default: true
    searchDebounceMs?: number; // Default: 300
    searchPlaceholder?: string; // Default: 'Search...'

    // UI
    placeholder?: string; // Default: 'Select an option'
    disabled?: boolean; // Default: false
    clearable?: boolean; // Default: true
    header?: React.ReactNode;
    footer?: React.ReactNode;

    // Custom Rendering
    renderItem?: (props: ItemRendererProps) => React.ReactNode;
    renderValue?: (item: OttaSelectItem) => React.ReactNode;
    renderChip?: (item: OttaSelectItem) => React.ReactNode;

    // Display
    showChips?: boolean; // Default: true (multi-select chip display)
    showSelectedFirst?: boolean; // Default: true (selected items at top)
    maxDisplayItems?: number; // Default: 100

    // Messages
    emptyMessage?: string; // Default: 'No options found'
    loadingMessage?: string; // Default: 'Loading...'
    errorMessage?: string; // Default: 'Error loading options'

    // Styling
    className?: string;
    dropdownClassName?: string;
}
```

## TypeScript Types

```typescript
// Output item - original object with normalized id and name
interface OttaSelectItem extends Record<string, any> {
    id: string; // Normalized to string
    name: string; // Normalized from name/label/title
}

// Custom renderer props
interface ItemRendererProps {
    item: OttaSelectItem;
    isSelected: boolean;
    isFocused: boolean;
}
```

## Flexible Input Formats

The component accepts any object with `id` and one of `name`/`label`/`title`:

```typescript
// All of these work:
const items1 = [{ id: 1, name: 'Item' }];
const items2 = [{ id: 'abc', label: 'Item' }];
const items3 = [{ id: '123', title: 'Item' }];

// Complex objects are preserved:
const items4 = [
    {
        id: 'prod-1',
        name: 'Product',
        price: 99.99,
        metadata: { color: 'blue' },
        tags: ['new', 'featured'],
    },
];
```

## Keyboard Navigation

- **Arrow Down/Up**: Navigate through items
- **Enter**: Select focused item
- **Escape**: Close dropdown
- **Space/Enter** (on trigger): Open dropdown

## Dark Mode

The component fully supports dark mode via Tailwind's `dark:` variant:

```javascript
// tailwind.config.js
module.exports = {
    darkMode: 'class',
    content: ['../../packages/ottaselect/src/**/*.{js,ts,jsx,tsx}'],
};
```

## License

MIT
