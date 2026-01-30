# Theme System - Single Source of Truth

## Overview

The `@ottabase/state` package provides a **centralized theme management system** using Jotai atoms with automatic
localStorage persistence. This is the **single source of truth** for all theme state across the entire application.

## Key Concept

```
┌─────────────────────────────────────────┐
│  themeAtom (from @ottabase/state)      │
│  - Persisted to localStorage            │
│  - Single source of truth               │
│  - Values: 'light' | 'dark'             │
└──────────────┬──────────────────────────┘
               │
               ├──► All UI frameworks
               ├──► All components
               └──► All pages
```

## Implementation

### Automatic localStorage Persistence

The theme atom uses `atomWithStorage` from `jotai/utils`:

```typescript
// packages/state/src/createAppState.ts
const themeStorageAtom = atomWithStorage<'light' | 'dark'>('ottabase-theme', initialState.theme ?? 'light');
```

**Key Features:**

- Automatically saves to `localStorage['ottabase-theme']`
- Automatically loads on app init
- Survives page reloads
- No manual sync code needed

### Usage in Components

```typescript
import { useAtom } from "jotai";
import { themeAtom } from "@/ottabase/state/appGlobalState";

function MyComponent() {
  const [theme, setTheme] = useAtom(themeAtom);

  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      Toggle Theme
    </button>
  );
}
```

## Syncing UI Frameworks

UI frameworks (like Tailwind via `next-themes`, and Mantine) are synchronized with the global `themeAtom` via a
centralized hook and controlled provider components.

### The `useThemeManager` Hook

The primary mechanism for theme changes is the `useThemeManager` hook (located in the application, e.g.,
`apps/ottabase-template-app/ottabase/hooks/useThemeManager.ts`). This hook is responsible for:

1. Reading the global `themeAtom`.
2. Providing a `toggleTheme` function.
3. Updating both the Jotai atom and the `next-themes` provider to keep them in sync.

All UI components that change the theme (e.g., a dark mode button) **must** use this hook.

```typescript
// Example from useThemeManager.ts
export function useThemeManager() {
    const [globalTheme, setGlobalTheme] = useAtom(themeAtom);
    const { setTheme: setNextTheme } = useTheme(); // from next-themes

    useEffect(() => {
        // Syncs Jotai state to next-themes
        if (globalTheme && globalTheme !== resolvedTheme) {
            setNextTheme(globalTheme);
        }
    }, [globalTheme, setNextTheme, resolvedTheme]);

    const toggleTheme = () => {
        const newTheme = globalTheme === 'light' ? 'dark' : 'light';
        setGlobalTheme(newTheme); // Update the atom, which triggers the effect
    };

    return { theme: globalTheme, toggleTheme };
}
```

### Mantine Integration

The Mantine provider (`@ottabase/ui-mantine`) is configured as a **controlled component**. It accepts the current theme
via a prop (`colorScheme`) and does not manage the state itself.

```tsx
// Example usage in an app layout
import { useAtomValue } from 'jotai';
import { themeAtom } from '@/ottabase/state/appGlobalState';
import { ProviderUIMantine } from '@ottabase/ui-mantine';

export default function MantineLayout({ children }) {
    const globalTheme = useAtomValue(themeAtom);

    return <ProviderUIMantine colorScheme={globalTheme}>{children}</ProviderUIMantine>;
}
```

## Benefits

### ✅ Single Source of Truth

- One atom controls all theme logic
- No conflicting state
- Easy to debug

### ✅ Automatic Persistence

- localStorage handled automatically by Jotai
- No manual sync code
- Survives page reloads

### ✅ Framework Agnostic

- Works with any UI framework
- Simple one-way sync pattern
- Easy to add new frameworks

### ✅ Type Safe

- TypeScript enforces `'light' | 'dark'`
- Compile-time safety

### ✅ Minimal Code

- ~20 lines per framework sync
- No complex state management

## Adding New UI Frameworks

1. Create a sync component:

    ```typescript
    function NewFrameworkSync() {
        const [globalTheme] = useAtom(themeAtom);
        const { setTheme } = useNewFramework();

        useEffect(() => {
            setTheme(globalTheme);
        }, [globalTheme]);

        return null;
    }
    ```

2. Add to your provider tree:

    ```tsx
    <NewFrameworkProvider>
        <NewFrameworkSync />
        {children}
    </NewFrameworkProvider>
    ```

3. Done! Framework now syncs with global state.

## Migration from Old Systems

If you have existing theme code:

1. **Remove** all manual localStorage theme code
2. **Remove** duplicate theme state
3. **Remove** theme context providers
4. **Add** sync components for each UI framework
5. **Use** `themeAtom` directly

## API Reference

### themeAtom

```typescript
import { themeAtom } from '@/ottabase/state/appGlobalState';

// Read theme
const [theme] = useAtom(themeAtom);

// Write theme
const [theme, setTheme] = useAtom(themeAtom);
setTheme('dark');

// Write only
const setTheme = useSetAtom(themeAtom);
setTheme('light');
```

### Type

```typescript
type Theme = 'light' | 'dark';
```

### localStorage Key

```typescript
'ottabase-theme'; // Fixed key, don't change
```

## Architecture Decision

### Why Global State?

- **Single source of truth** - One place to check theme
- **Automatic persistence** - Jotai handles localStorage
- **Type safe** - TypeScript enforces valid values
- **No prop drilling** - Access anywhere with `useAtom`
- **Framework agnostic** - UI frameworks just sync with it

### Why Not Context?

- Requires provider wrapping
- Props drilling for updates
- No automatic persistence
- More boilerplate

### Why Not Redux/Zustand?

- Overkill for simple theme state
- More setup required
- Jotai is simpler and lighter

### Why Not next-themes Directly?

- Tied to Next.js
- Not framework agnostic
- Can't use in Node.js scripts
- Global state works everywhere

## Examples

### Toggle Button

```typescript
import { useAtom } from "jotai";
import { themeAtom } from "@/ottabase/state/appGlobalState";

export function ThemeToggle() {
  const [theme, setTheme] = useAtom(themeAtom);

  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
```

### Theme-aware Component

```typescript
import { useAtomValue } from "jotai";
import { themeAtom } from "@/ottabase/state/appGlobalState";

export function ThemedCard() {
  const theme = useAtomValue(themeAtom);

  return (
    <div className={theme === "dark" ? "bg-gray-900" : "bg-white"}>
      Current theme: {theme}
    </div>
  );
}
```

### Programmatic Theme Change

```typescript
import { useSetAtom } from 'jotai';
import { themeAtom } from '@/ottabase/state/appGlobalState';

export function useAutoTheme() {
    const setTheme = useSetAtom(themeAtom);

    useEffect(() => {
        const hour = new Date().getHours();
        const isDayTime = hour >= 6 && hour < 18;
        setTheme(isDayTime ? 'light' : 'dark');
    }, [setTheme]);
}
```

## Testing

To verify the system works:

1. Open DevTools → Application → Local Storage
2. Find `ottabase-theme` key
3. Toggle theme in your app
4. Verify value changes to `'light'` or `'dark'`
5. Refresh page
6. Theme should persist
7. All UI frameworks should update together

## Troubleshooting

### Theme not persisting

- Check localStorage is enabled
- Verify key is `ottabase-theme`
- Check browser console for errors

### Frameworks out of sync

- Ensure sync component is rendered
- Check useEffect dependencies
- Verify framework provider is present

### Infinite loop

- The `useThemeManager` hook is designed to prevent infinite loops by having a one-way data flow for updates: Component
  -> Jotai Atom -> `useEffect` -> `next-themes`.
- Direct updates to `localStorage` or multiple, conflicting state managers should be avoided.

## Files

- **State package**: `packages/state/src/createAppState.ts`
- **next-themes sync**: Example in app's `ProviderNextThemes.tsx`
- **Mantine sync**: Example in app's `MantineThemeSync.tsx`
