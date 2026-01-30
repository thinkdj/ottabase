# @ottabase/state

Simple global state management for Ottabase apps using Jotai.

## Installation

```bash
pnpm add @ottabase/state jotai
```

## Quick Start

### 1. Create App State

```typescript
// src/ottabase/state/appState.ts
import { createAppState } from '@ottabase/state';

const { appStateAtom, atoms, createAtom } = createAppState({
    appName: 'My App',
    initialState: {
        theme: 'dark',
    },
});

export const { themeAtom, userAtom, isAuthenticatedAtom, sidebarOpenAtom, sidebarCollapsedAtom, isLoadingAtom } = atoms;

export { appStateAtom, createAtom };
```

### 2. Add Provider

```tsx
// src/providers/Providers.tsx
import { ProviderState } from '@ottabase/state';

export function Providers({ children }) {
    return <ProviderState>{children}</ProviderState>;
}
```

### 3. Use in Components

```tsx
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { themeAtom, userAtom, sidebarOpenAtom } from '@/ottabase/state/appState';

function Header() {
    const theme = useAtomValue(themeAtom);
    const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom);
    const setUser = useSetAtom(userAtom);

    return (
        <header>
            <button onClick={() => setSidebarOpen(!sidebarOpen)}>Toggle Sidebar</button>
            <span>Theme: {theme}</span>
        </header>
    );
}
```

## State Properties

| Property           | Type                | Default   | Description             |
| ------------------ | ------------------- | --------- | ----------------------- |
| `appName`          | `string`            | required  | Application name        |
| `theme`            | `"light" \| "dark"` | `"light"` | Current theme           |
| `user`             | `BaseUser \| null`  | `null`    | Current user object     |
| `isAuthenticated`  | `boolean`           | `false`   | Auth status             |
| `sidebarOpen`      | `boolean`           | `true`    | Sidebar visibility      |
| `sidebarCollapsed` | `boolean`           | `false`   | Sidebar collapsed state |
| `isLoading`        | `boolean`           | `false`   | Global loading state    |

## Custom User Type

```typescript
import { createAppState, BaseUser } from '@ottabase/state';

interface AppUser extends BaseUser {
    role: 'admin' | 'user';
    preferences: { notifications: boolean };
}

const { atoms, appStateAtom } = createAppState<AppUser>({
    appName: 'My App',
});

// userAtom is now typed as AppUser | null
```

## Custom Atoms

Create focused atoms for additional properties:

```typescript
const { createAtom, appStateAtom } = createAppState({ appName: 'My App' });

// For properties in AppState
const myAtom = createAtom('theme');

// For custom state, use Jotai directly
import { atom } from 'jotai';
const customAtom = atom('custom value');
```

## API

### `createAppState(config)`

Creates the app state with atoms.

```typescript
interface AppStateConfig<TUser> {
    appName: string;
    initialState?: Partial<AppState<TUser>>;
}
```

**Returns:**

- `appStateAtom` - Main atom with entire state
- `createAtom(key)` - Creates focused atom for a property
- `atoms` - Pre-created atoms for common properties

### `ProviderState`

Jotai provider wrapper. Wrap your app root with this.

```tsx
<ProviderState>{children}</ProviderState>
```

## License

MIT
