# @ottabase/ottasearch

Universal search component for Ottabase applications with D1 integration, Notion-like UI, and mock mode for demos.

## Features

- 🎨 **Notion-inspired UI** - Minimal, slick interface with dark mode support
- ⌨️ **Keyboard Navigation** - Full keyboard support (Cmd/Ctrl+K, arrows, Enter, Esc)
- 🔍 **Multiple Variants** - Button, Input, and Modal (full-screen) modes
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
    { name: 'users', searchFields: ['name', 'email'], displayFields: ['name', 'email'] },
    { name: 'posts', searchFields: ['title', 'content'], displayFields: ['title'] },
  ],
});

function App() {
  return <OttaSearch adapter={searchAdapter} />;
}
```

### Variants

```tsx
// Modal (default) - Full-screen Notion-like experience
<OttaSearch adapter={adapter} variant="modal" />

// Button - Simple trigger button
<OttaSearch adapter={adapter} variant="button" />

// Input - Inline search with dropdown
<OttaSearch adapter={adapter} variant="input" placeholder="Search..." />
```

### Keyboard Shortcuts

- `Cmd/Ctrl + K` - Open search modal
- `↑/↓` - Navigate results
- `Enter` - Select result
- `Esc` - Close modal

## API

### OttaSearch Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `adapter` | `SearchAdapter` | Required | Data source adapter |
| `variant` | `'modal' \| 'button' \| 'input'` | `'modal'` | UI variant |
| `placeholder` | `string` | `'Search...'` | Input placeholder |
| `shortcut` | `string` | `'⌘K'` | Keyboard shortcut display |
| `onSelect` | `(result: SearchResult) => void` | - | Result selection callback |
| `className` | `string` | - | Additional CSS classes |

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

## License

MIT
