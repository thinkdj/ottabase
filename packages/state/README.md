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

export const { themeAtom, userAtom, isAuthenticatedAtom, sidebarStateAtom, isLoadingAtom } = atoms;

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
import { themeAtom, userAtom, sidebarStateAtom } from '@/ottabase/state/appState';

function Header() {
    const theme = useAtomValue(themeAtom);
    const [sidebarState, setSidebarState] = useAtom(sidebarStateAtom);
    const setUser = useSetAtom(userAtom);

    return (
        <header>
            <button onClick={() => setSidebarState({ ...sidebarState, isOpen: !sidebarState.isOpen })}>Toggle Sidebar</button>
            <span>Theme: {theme}</span>
        </header>
    );
}
```

## State Properties

| Property          | Type                              | Default                                            | Description                                                                                             |
| ----------------- | ---------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `appName`         | `string`                           | required                                            | Application name                                                                                          |
| `appId`           | `string \| undefined`              | `undefined`                                         | Application identifier (for multi-app setups)                                                             |
| `organizationId`  | `string \| null \| undefined`      | `null`                                              | Current organization/tenant identifier                                                                    |
| `theme`           | `"light" \| "dark"`                | `"light"`                                           | Current theme mode                                                                                         |
| `themeInfo`       | `ThemeInfo`                        | `{ name: 'default' }`                               | Theme name plus an optional nested `layout` config (header, navigation, contentWidth, footer, density)    |
| `user`            | `BaseUser \| null`                 | `null`                                              | Current user object                                                                                        |
| `isAuthenticated` | `boolean`                          | `false`                                             | Auth status                                                                                                |
| `sidebarState`    | `{ isOpen, isCollapsed, width }`   | `{ isOpen: true, isCollapsed: false, width: 250 }`  | Sidebar open/collapsed state and width in pixels                                                          |
| `scale`           | `number`                           | `1.0`                                               | Global scale multiplier for UI elements                                                                   |
| `zoom`            | `number`                           | `1.0`                                               | Global zoom level for content                                                                             |
| `isLoading`       | `boolean`                          | `false`                                             | Global loading state                                                                                       |
| `language`        | `string`                           | `"en"`                                              | Current language code (e.g., `'en'`, `'es'`, `'fr'`, `'de'`)                                              |

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

## Session Sync (app integration)

In Ottabase apps the `userAtom` is kept in sync with the auth session via `useSession().user`. After you mutate
`/api/users/me`, call `refreshSession()` (or `updateUser()`) so the session cache (persisted via `atomWithStorage`)
picks up the server-side profile version bump (`auth:profile:version:{userId}`) without hitting D1 on every request.
This keeps global state, UI headers, and KV-backed JWTs consistent while avoiding unnecessary polling.

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
