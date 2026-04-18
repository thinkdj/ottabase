# @ottabase/spotlight

Lightweight spotlight/command palette component with dark mode support, background blur effects, and configurable
search.

## Features

- **Lightweight** - Minimal dependencies, built on shadcn/ui Dialog
- **Dark/Light Mode** - Automatic theme support via Tailwind
- **CSS Effects** - Background blur and smooth animations
- **Keyboard Shortcuts** - Configurable trigger keys (default: `/`)
- **Configurable Search** - Custom search callback with debouncing
- **Keyboard Navigation** - Arrow keys, Enter, Escape support
- **Debounced Search** - Configurable debounce delay (default: 300ms)
- **Request Cancellation** - AbortController support for API calls
- **Loading States** - Built-in loading indicators with custom renderers
- **Error Handling** - Error states with custom error renderers
- **Event Callbacks** - onQueryChange, onResultSelect, onOpenChange hooks
- **Production Ready** - TypeScript, error boundaries, cleanup, performance optimized

## Installation

```bash
pnpm add @ottabase/spotlight
```

## Usage

### Basic Usage

```tsx
import { SpotlightProvider } from '@ottabase/spotlight';

function App() {
    return (
        <SpotlightProvider>
            <YourApp />
        </SpotlightProvider>
    );
}
```

### With API Search (Debounced & Abortable)

#### Using Fetch API

```tsx
import { SpotlightProvider, type SpotlightResult } from '@ottabase/spotlight';

function App() {
    const handleSearch = async (query: string, signal?: AbortSignal): Promise<SpotlightResult[]> => {
        // AbortSignal automatically cancels previous requests
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
            signal, // Pass abort signal to fetch
        });

        if (!response.ok) {
            throw new Error('Search failed');
        }

        const data = await response.json();
        return data.map((item: any) => ({
            id: item.id,
            label: item.title,
            description: item.description,
            keywords: item.tags,
            onSelect: () => navigate(`/items/${item.id}`),
        }));
    };

    return (
        <SpotlightProvider
            onSearch={handleSearch}
            shortcuts={['/', 'mod+k']}
            placeholder="Search pages..."
            searchDebounceMs={300}
            minQueryLength={2}
            onQueryChange={(query) => console.log('Query changed:', query)}
            onResultSelect={(result) => console.log('Selected:', result)}
        >
            <YourApp />
        </SpotlightProvider>
    );
}
```

#### Using @ottabase/api Package

```tsx
import { SpotlightProvider, createApiSearchHandler } from '@ottabase/spotlight';
import { api } from '@ottabase/api';
import { useRouter } from '@tanstack/react-router';

function App() {
    const router = useRouter();

    // Use the helper function for easy integration
    const handleSearch = createApiSearchHandler({
        api,
        endpoint: '/api/search',
        transform: (item: { id: string; title: string; description?: string; tags?: string[] }) => ({
            id: item.id,
            label: item.title,
            description: item.description,
            keywords: item.tags,
            onSelect: () => router.navigate({ to: `/items/${item.id}` }),
        }),
    });

    return (
        <SpotlightProvider
            onSearch={handleSearch}
            shortcuts={['/', 'mod+k']}
            placeholder="Search pages..."
            searchDebounceMs={300}
            minQueryLength={2}
        >
            <YourApp />
        </SpotlightProvider>
    );
}
```

#### Using @ottabase/api with Full AbortSignal Support

```tsx
import { SpotlightProvider, createApiSearchHandlerWithSignal } from '@ottabase/spotlight';

function App() {
    const handleSearch = createApiSearchHandlerWithSignal({
        endpoint: '/api/search',
        baseUrl: '/api',
        getAuthToken: () => localStorage.getItem('token'),
        transform: (item: { id: string; title: string }) => ({
            id: item.id,
            label: item.title,
            onSelect: () => navigate(`/items/${item.id}`),
        }),
    });

    return (
        <SpotlightProvider onSearch={handleSearch}>
            <YourApp />
        </SpotlightProvider>
    );
}
```

#### Using Custom API Client with AbortSignal Support

```tsx
import { SpotlightProvider, type SpotlightResult } from '@ottabase/spotlight';
import { createApiClient } from '@ottabase/api';

// Create API client with abort signal support
const apiWithSignal = (signal?: AbortSignal) => {
    const client = createApiClient({
        baseUrl: '/api',
        getAuthToken: () => localStorage.getItem('token'),
    });

    // Wrap the client to inject abort signal
    return async <T,>(endpoint: string, options: any = {}) => {
        return client<T>(endpoint, {
            ...options,
            // Note: The API client uses fetch internally, which respects AbortSignal
            // We need to pass it through the fetch options
        });
    };
};

function App() {
    const handleSearch = async (query: string, signal?: AbortSignal): Promise<SpotlightResult[]> => {
        // Create a custom fetch wrapper that uses the signal
        const customFetch = (url: string, options: RequestInit = {}) => {
            return fetch(url, {
                ...options,
                signal, // Pass abort signal to fetch
            });
        };

        // Use the API client with custom fetch
        const response = await customFetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        return data.map((item: any) => ({
            id: item.id,
            label: item.title,
            onSelect: () => navigate(`/items/${item.id}`),
        }));
    };

    return (
        <SpotlightProvider onSearch={handleSearch}>
            <YourApp />
        </SpotlightProvider>
    );
}
```

### Using the Search Hook

```tsx
import { useSpotlightSearch } from '@ottabase/spotlight';

function MyComponent() {
    const { query, setQuery, results, isLoading, error } = useSpotlightSearch({
        debounceMs: 300,
        minQueryLength: 2,
        onSearch: async (query, signal) => {
            const response = await fetch(`/api/search?q=${query}`, { signal });
            return response.json();
        },
        onError: (error) => console.error('Search error:', error),
        onSuccess: (results) => console.log('Found', results.length, 'results'),
    });

    return (
        <div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." />
            {isLoading && <div>Loading...</div>}
            {error && <div>Error: {error.message}</div>}
            <ul>
                {results.map((result) => (
                    <li key={result.id}>{result.label}</li>
                ))}
            </ul>
        </div>
    );
}
```

### Programmatic Control

```tsx
import { useSpotlight } from '@ottabase/spotlight';

function MyComponent() {
    const { open, toggle, setOpen } = useSpotlight();

    return <button onClick={toggle}>{open ? 'Close' : 'Open'} Spotlight</button>;
}
```

### Custom Renderers (Loading, Empty, Error, Results)

```tsx
import { SpotlightProvider, type SpotlightResult } from '@ottabase/spotlight';

function App() {
    const renderResult = (result: SpotlightResult, index: number, isSelected: boolean) => {
        return (
            <div className={cn('flex items-center gap-3 px-4 py-3', isSelected && 'bg-blue-500 text-white')}>
                {result.icon}
                <div>
                    <h3 className="font-semibold">{result.label}</h3>
                    {result.description && <p className="text-sm text-gray-500">{result.description}</p>}
                </div>
            </div>
        );
    };

    const renderLoading = () => (
        <div className="px-4 py-8 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="mt-2 text-sm text-gray-500">Searching...</p>
        </div>
    );

    const renderEmpty = () => (
        <div className="px-4 py-8 text-center text-gray-500">No results found. Try a different search term.</div>
    );

    const renderError = (error: Error) => (
        <div className="px-4 py-8 text-center text-red-500">
            <p>Error: {error.message}</p>
            <button onClick={() => window.location.reload()}>Retry</button>
        </div>
    );

    return (
        <SpotlightProvider
            onSearch={handleSearch}
            renderResult={renderResult}
            renderLoading={renderLoading}
            renderEmpty={renderEmpty}
            renderError={renderError}
        >
            <YourApp />
        </SpotlightProvider>
    );
}
```

### With Default Results

```tsx
import { SpotlightProvider, type SpotlightResult } from '@ottabase/spotlight';

const defaultResults: SpotlightResult[] = [
    { id: 'home', label: 'Home', onSelect: () => navigate('/') },
    { id: 'settings', label: 'Settings', onSelect: () => navigate('/settings') },
];

function App() {
    return (
        <SpotlightProvider defaultResults={defaultResults} onSearch={handleSearch}>
            <YourApp />
        </SpotlightProvider>
    );
}
```

## Configuration

### Props

| Prop               | Type                                                                                       | Default                  | Description                            |
| ------------------ | ------------------------------------------------------------------------------------------ | ------------------------ | -------------------------------------- |
| `enabled`          | `boolean`                                                                                  | `true`                   | Enable/disable spotlight               |
| `shortcuts`        | `string[]`                                                                                 | `["/"]`                  | Keyboard shortcuts to trigger          |
| `placeholder`      | `string`                                                                                   | `"Search..."`            | Input placeholder text                 |
| `emptyMessage`     | `string`                                                                                   | `"No results found"`     | Message when no results                |
| `loadingMessage`   | `string`                                                                                   | `"Searching..."`         | Loading message                        |
| `errorMessage`     | `string`                                                                                   | `"An error occurred..."` | Error message                          |
| `onSearch`         | `(query: string, signal?: AbortSignal) => Promise<SpotlightResult[]> \| SpotlightResult[]` | -                        | Search function with abort support     |
| `renderResult`     | `(result, index, isSelected) => ReactNode`                                                 | -                        | Custom result renderer                 |
| `renderLoading`    | `() => ReactNode`                                                                          | -                        | Custom loading renderer                |
| `renderEmpty`      | `() => ReactNode`                                                                          | -                        | Custom empty state renderer            |
| `renderError`      | `(error: Error) => ReactNode`                                                              | -                        | Custom error renderer                  |
| `maxResults`       | `number`                                                                                   | `50`                     | Maximum results to display             |
| `searchDebounceMs` | `number`                                                                                   | `300`                    | Debounce delay in milliseconds         |
| `minQueryLength`   | `number`                                                                                   | `0`                      | Minimum query length to trigger search |
| `onQueryChange`    | `(query: string) => void`                                                                  | -                        | Callback when query changes            |
| `onResultSelect`   | `(result: SpotlightResult) => void`                                                        | -                        | Callback when result is selected       |
| `onOpenChange`     | `(open: boolean) => void`                                                                  | -                        | Callback when spotlight opens/closes   |
| `defaultResults`   | `SpotlightResult[]`                                                                        | `[]`                     | Results shown when query is empty      |

### Keyboard Shortcuts Format

- `/` - Single key
- `mod+k` - Modifier + key (Cmd/Ctrl + K)
- `shift+/` - Shift + key
- `alt+s` - Alt + key

## Styling

The component uses Tailwind CSS and automatically adapts to dark/light mode via the `dark:` variant. The background blur
effect uses `backdrop-blur` with semi-transparent backgrounds.

## License

MIT
