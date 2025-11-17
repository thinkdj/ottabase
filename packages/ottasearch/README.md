# @ottabase/ottasearch

Universal search component for Ottabase applications with D1 integration, Notion-like UI, and flexible display modes.

## Features

- 🎨 **Notion-inspired UI** - Minimal, slick interface with dark mode support
- ⌨️ **Keyboard Navigation** - Full keyboard support (Cmd/Ctrl+K, arrows, Enter, Esc)
- 🔍 **Flexible Triggers** - Button, Input, Icon, or Icon+Input
- 📺 **Display Modes** - Modal (full-screen) or Popover (dropdown)
- 📦 **Flexible Adapters** - D1, Mock, or custom data sources
- 🌙 **Dark Mode** - Built-in dark mode support via CSS classes
- ⚡ **Real-time Search** - Debounced search with loading states
- 🎯 **Grouped Results** - Organize results by category/table

## Installation

```bash
pnpm add @ottabase/ottasearch
```

## Usage

### Quick Start with Mock Data

```tsx
import { OttaSearch, createMockAdapter } from '@ottabase/ottasearch';

const mockAdapter = createMockAdapter();

function App() {
  return <OttaSearch adapter={mockAdapter} />;
}
```

### Trigger + Display Combinations

The component supports different **triggers** (what the user interacts with) and **display modes** (how results are shown):

```tsx
// Icon that expands to input with dropdown (minimal, Notion-style)
<OttaSearch
  adapter={adapter}
  trigger="icon-input"
  display="popover"
/>

// Input field with dropdown results (quick search)
<OttaSearch
  adapter={adapter}
  trigger="input"
  display="popover"
  placeholder="Search..."
/>

// Button with full-screen modal (⌘K shortcut)
<OttaSearch
  adapter={adapter}
  trigger="button"
  display="modal"
/>

// Input field that opens modal on click
<OttaSearch
  adapter={adapter}
  trigger="input"
  display="modal"
  placeholder="Click to search..."
/>
```

### With D1 Database

```tsx
import { OttaSearch } from '@ottabase/ottasearch';
import { createD1SearchAdapter } from '@ottabase/ottasearch/adapters';
import { createD1Client } from '@ottabase/cf/d1';

// In your Cloudflare Worker/Pages function
const d1Client = createD1Client({ database: env.DB });

const searchAdapter = createD1SearchAdapter({
  d1Client,
  tables: [
    {
      name: 'users',
      searchFields: ['name', 'email'],
      displayFields: ['name', 'email'],
      category: 'Users',
      icon: 'User'
    },
    {
      name: 'posts',
      searchFields: ['title', 'content'],
      displayFields: ['title'],
      category: 'Content',
      icon: 'FileText'
    },
  ],
});

function App() {
  return (
    <OttaSearch
      adapter={searchAdapter}
      trigger="icon-input"
      display="popover"
    />
  );
}
```

### Keyboard Shortcuts

- `Cmd/Ctrl + K` - Open search modal (button + modal only)
- `↑/↓` - Navigate results
- `Enter` - Select result
- `Esc` - Close search

## API

### OttaSearch Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `adapter` | `SearchAdapter` | Required | Data source adapter |
| `trigger` | `'button' \| 'input' \| 'icon' \| 'icon-input'` | `'button'` | Trigger type |
| `display` | `'modal' \| 'popover'` | `'modal'` | Display mode |
| `placeholder` | `string` | `'Search...'` | Input placeholder |
| `showShortcut` | `boolean` | `true` | Show ⌘K hint (button only) |
| `onSelect` | `(result: SearchResult) => void` | - | Result selection callback |
| `className` | `string` | - | Additional CSS classes |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size for button/icon triggers |
| `variant` | `'default' \| 'ghost' \| 'minimal'` | `'default'` | Button variant |
| `debounceMs` | `number` | `300` | Search debounce delay |
| `autoSearch` | `boolean` | `true` | Auto-search on input |
| `minQueryLength` | `number` | `1` | Min query length |

### Trigger Options

- **`button`** - Button with "Search" text and ⌘K hint
- **`input`** - Full search input field
- **`icon`** - Just a search icon
- **`icon-input`** - Icon that expands to input on click (recommended for minimal UI)

### Display Options

- **`modal`** - Full-screen Notion-like modal with recent searches
- **`popover`** - Minimal dropdown below trigger (perfect for quick searches)

### Creating Custom Adapters

```typescript
import type { SearchAdapter, SearchResult } from '@ottabase/ottasearch';

const customAdapter: SearchAdapter = {
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Your search logic
    return results;
  },
  async getRecentSearches(): Promise<SearchResult[]> {
    // Optional: Return recent searches
    return [];
  },
};
```

### SearchResult Type

```typescript
interface SearchResult {
  id: string;
  title: string;
  description?: string;  // Optional subtitle
  category?: string;     // For grouping
  icon?: string;         // Lucide icon name
  url?: string;          // Navigation URL
  metadata?: Record<string, any>;
}
```

## Examples

### Minimal Navbar Search

```tsx
// Icon that expands to search with dropdown
<OttaSearch
  adapter={adapter}
  trigger="icon-input"
  display="popover"
  size="md"
  variant="ghost"
/>
```

### Command Palette

```tsx
// Full-screen modal with ⌘K shortcut
<OttaSearch
  adapter={adapter}
  trigger="button"
  display="modal"
  showShortcut={true}
/>
```

### Quick Filter

```tsx
// Input with dropdown for filtering
<OttaSearch
  adapter={adapter}
  trigger="input"
  display="popover"
  placeholder="Filter items..."
/>
```

## License

MIT
