# @ottabase/ottasearch

Universal search component for Ottabase applications with D1 integration, Notion-like UI, and flexible display modes.

## Features

- 🎨 **Notion-inspired UI** - Minimal, slick interface with dark mode support
- ⌨️ **Keyboard Navigation** - Full keyboard support (Cmd/Ctrl+K, arrows, Enter, Esc)
- 🔍 **Flexible Triggers** - Button, Input, Icon, or Icon+Input
- 📺 **Display Modes** - Modal (full-screen) or Popover (dropdown)
- 📦 **Flexible Adapters** - D1, Mock, API, or custom data sources
- 🌙 **Dark Mode** - Built-in dark mode support via CSS classes
- ⚡ **Real-time Search** - Debounced search with loading states
- 🎯 **Grouped Results** - Organize results by category/table
- ✨ **Search Highlights** - Automatic query highlighting in results
- 🎭 **Search Scopes** - Filter results by configurable scopes/categories
- 💾 **Recent Searches** - Automatic persistence to localStorage (last 5)
- 🎨 **Custom Empty States** - Configurable empty state with messages & suggestions

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
| `scopes` | `SearchScope[]` | - | Available search scopes |
| `emptyStateConfig` | `EmptyStateConfig` | - | Empty state configuration |

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

## Advanced Features

### Search Highlights

Search terms are automatically highlighted in results using the `highlightTextParts()` utility:

```tsx
import { highlightTextParts } from '@ottabase/ottasearch';

// Manually highlight text (returns array of {text, highlight} parts)
const parts = highlightTextParts('Alice Johnson', 'alice');
// [{ text: 'Alice', highlight: true }, { text: ' Johnson', highlight: false }]

// Render with highlighting
parts.map((part, idx) =>
  part.highlight ? (
    <mark key={idx} className="bg-yellow-200">{part.text}</mark>
  ) : (
    <span key={idx}>{part.text}</span>
  )
)
```

Highlights are automatically applied in `SearchModal` and `SearchPopover` components.

### Search Scopes

Filter search results by predefined scopes (categories):

```tsx
import type { SearchScope } from '@ottabase/ottasearch';

const scopes: SearchScope[] = [
  { id: 'users', name: 'Users', icon: 'User', description: 'Search users' },
  { id: 'docs', name: 'Documents', icon: 'FileText', description: 'Search documents' },
  { id: 'projects', name: 'Projects', icon: 'FolderOpen' },
];

<OttaSearch
  adapter={adapter}
  scopes={scopes}
  trigger="button"
  display="modal"
/>
```

Scopes appear as filter tabs in the search modal. The adapter receives the active scope in search options:

```typescript
// In your custom adapter
async search(query: string, options?: SearchOptions) {
  const scope = options?.scope; // e.g., 'users'
  // Filter results by scope...
}
```

### Empty State Customization

Customize the empty state when no results are found:

```tsx
import type { EmptyStateConfig } from '@ottabase/ottasearch';

// With custom message
<OttaSearch
  adapter={adapter}
  emptyStateConfig={{
    message: 'No matches found. Try different keywords.',
  }}
/>

// With suggestions
<OttaSearch
  adapter={adapter}
  emptyStateConfig={{
    message: 'No results found',
    suggestions: [
      { label: 'View all users', onClick: () => navigate('/users') },
      { label: 'Browse docs', onClick: () => navigate('/docs') },
    ],
  }}
/>

// With custom component
const CustomEmpty = () => (
  <div className="text-center py-8">
    <h3>Nothing here!</h3>
    <p>Try searching for something else</p>
  </div>
);

<OttaSearch
  adapter={adapter}
  emptyStateConfig={{ component: CustomEmpty }}
/>
```

### Recent Searches with Persistence

Recent searches are automatically persisted to localStorage (max 5):

```tsx
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches
} from '@ottabase/ottasearch';

// Get recent searches
const recent = getRecentSearches();

// Manually add a search
addRecentSearch({
  id: 'user-1',
  title: 'Alice Johnson',
  description: 'alice@example.com',
  category: 'Users',
});

// Clear all recent searches
clearRecentSearches();
```

The `useSearch` hook and adapters automatically manage recent searches. They appear in the modal when the search query is empty.

### API Adapter

Connect to REST APIs for search results:

```tsx
import { createApiAdapter, createApiAdapterPost } from '@ottabase/ottasearch/adapters';

// GET request adapter
const apiAdapter = createApiAdapter({
  baseUrl: 'https://api.example.com',
  searchEndpoint: '/search',
  queryParam: 'q',
  headers: {
    'Authorization': 'Bearer token',
  },
  timeout: 5000,
  transform: (data) => {
    // Transform API response to SearchResult[]
    return data.results.map(item => ({
      id: item.id,
      title: item.name,
      description: item.description,
      category: item.type,
      url: `/items/${item.id}`,
    }));
  },
});

// POST request adapter
const apiAdapterPost = createApiAdapterPost({
  baseUrl: 'https://api.example.com',
  searchEndpoint: '/search',
  headers: {
    'Authorization': 'Bearer token',
    'X-Custom-Header': 'value',
  },
  transform: (data) => data.items.map(/* ... */),
});

<OttaSearch adapter={apiAdapter} />
```

**API Adapter Configuration:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | `string` | Required | Base URL for API |
| `searchEndpoint` | `string` | `'/search'` | Search endpoint path |
| `queryParam` | `string` | `'q'` | Query parameter name (GET only) |
| `headers` | `Record<string, string>` | `{}` | Custom headers |
| `timeout` | `number` | `10000` | Request timeout (ms) |
| `transform` | `(data: any) => SearchResult[]` | Auto-detect | Transform response |

The adapter automatically handles:
- Query params: `limit`, `offset`, `scope`, `categories`
- Request timeout with AbortController
- Common response formats (`data.results`, `data.items`, etc.)
- Error handling

## License

MIT
