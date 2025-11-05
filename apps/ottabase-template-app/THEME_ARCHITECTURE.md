# Theme Architecture - Single Source of Truth

This document explains the centralized theme system used across all apps and packages.

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│ SINGLE SOURCE OF TRUTH: Global State (Jotai) │
│                                              │
│         themeAtom (from @ottabase/state)     │
│  - Persists to localStorage ('ottabase-theme') │
│  - Values: 'light' | 'dark'                    │
└──────────────┬───────────────────────────────┘
               │
┌──────────────┴───────────────────────────────┐
│       useThemeManager() Hook                 │
│  - Central logic for toggling theme          │
│  - Updates a) Jotai atom & b) next-themes    │
└──────────────┬───────────────────────────────┘
               │
     ┌─────────┴───────────┐
     │                     │
┌────▼───────────┐  ┌──────▼───────────┐
│ next-themes    │  │ Mantine UI       │
│ (Tailwind CSS) │  │ (ProviderUIMantine)│
│ - Updates dark │  │ - Receives theme │
│   class on <html>│  │   via prop       │
└────────────────┘  └──────────────────┘

```

## Implementation Details

### 1. Global State (@ottabase/state)

**Location**: `packages/state/src/createAppState.ts`

The theme state is created with localStorage persistence:

```typescript
// Create a persisted theme atom with localStorage (SINGLE SOURCE OF TRUTH)
const themeStorageAtom = atomWithStorage<"light" | "dark">(
  "ottabase-theme",
  initialState.theme ?? "light"
);

// Special handling for theme to use localStorage-backed atom
if (key === "theme") {
  return atom(
    (get) => get(themeStorageAtom),
    (_get, set, update) => {
      set(themeStorageAtom, update as "light" | "dark");
      set(appGlobalStateAtom, (prev) => ({ ...prev, [key]: update }));
    },
  );
}
```

**Key Features:**

- Automatically persists to `localStorage['ottabase-theme']`
- Survives page reloads
- Single atom shared across entire app
- Type-safe: `'light' | 'dark'`

### 2. The `useThemeManager` Hook

**Location**: `apps/ottabase-template-app/ottabase/hooks/useThemeManager.ts`

The `useThemeManager` hook is now the single point of interaction for theme changes. It coordinates updates between the global Jotai state and the `next-themes` provider.

```typescript
export function useThemeManager() {
  const [globalTheme, setGlobalTheme] = useAtom(themeAtom);
  const { setTheme: setNextTheme, resolvedTheme } = useTheme();

  // Effect to keep next-themes in sync with the global state (Jotai -> next-themes)
  useEffect(() => {
    if (globalTheme && resolvedTheme !== globalTheme) {
      setNextTheme(globalTheme);
    }
  }, [globalTheme, resolvedTheme, setNextTheme]);

  const toggleTheme = () => {
    const newTheme = globalTheme === "light" ? "dark" : "light";
    setGlobalTheme(newTheme); // This triggers the useEffect above
  };

  return { theme: globalTheme, toggleTheme, setTheme: setGlobalTheme };
}
```

### 3. Mantine Integration

**Location**: `packages/ui-mantine/provider/ProviderUI.tsx` & `apps/ottabase-template-app/app/demo/mantine/layout.tsx`

The `ProviderUIMantine` component is now a **controlled component**. It receives the color scheme directly as a prop. The `MantineThemeSync` component has been removed.

**Provider Implementation (`ProviderUIMantine.tsx`):**

```tsx
const ProviderUIMantine = ({ colorScheme, ... }) => {
  return (
    <MantineProvider
      forceColorScheme={colorScheme} // Controlled by prop
      {...}
    >
      {children}
    </MantineProvider>
  );
};
```

**Usage in Mantine layout:**

```tsx
// app/demo/mantine/layout.tsx
export default function MantineLayout({ children }) {
  const globalTheme = useAtomValue(themeAtom);

  return (
    <ProviderUIMantine
      colorScheme={globalTheme}
    >
      {children}
    </ProviderUIMantine>
  );
}
```

### 4. DarkModeToggle Component

**Location**: `apps/ottabase-template-app/app/demo/components/DarkModeToggle.tsx`

All `DarkModeToggle` components MUST use the `useThemeManager` hook to ensure correct state synchronization.

```typescript
import { useThemeManager } from "@/ottabase/hooks/useThemeManager";

const DarkModeToggle = (props) => {
  const { theme, toggleTheme } = useThemeManager();

  return (
    <button onClick={toggleTheme}>
      {/* ... icon ... */}
    </button>
  );
};
```

**Flow:**

1. User clicks `DarkModeToggle`.
2. The `toggleTheme` function from `useThemeManager` is called.
3. `toggleTheme` updates the global Jotai `themeAtom`.
4. The `useEffect` inside `useThemeManager` detects the change in the atom and calls `setTheme` from `next-themes`.
5. The `<html>` class is updated by `next-themes`.
6. The `MantineLayout` re-renders because `themeAtom` changed, passing the new theme to `ProviderUIMantine`.
7. All UI systems are now in sync.

## Usage Examples

### Reading Theme

```typescript
import { useAtom } from "jotai";
import { themeAtom } from "@/ottabase/state/appGlobalState";

function MyComponent() {
  const [theme] = useAtom(themeAtom);

  return <div>Current theme: {theme}</div>;
}
```

### Changing Theme

Any component that needs to change the theme should use the `useThemeManager` hook.

```typescript
import { useThemeManager } from "@/ottabase/hooks/useThemeManager";

function ThemeButton() {
  const { setTheme } = useThemeManager();

  return (
    <button onClick={() => setTheme("dark")}>
      Switch to Dark
    </button>
  );
}
```

### Using with createAppGlobalStateAtom

```typescript
import { useSetAtom } from "jotai";
import { createAppGlobalStateAtom } from "@/ottabase/state/appGlobalState";

function ThemeToggle() {
  const setTheme = useSetAtom(createAppGlobalStateAtom("theme"));

  useEffect(() => {
    setTheme("dark");
  }, [setTheme]);
}
```

## Benefits

### ✅ Single Source of Truth

- One atom controls all theme logic
- No conflicting state across systems
- Easy to debug and reason about

### ✅ Automatic Persistence

- localStorage handled by Jotai
- No manual sync code needed
- Survives page reloads

### ✅ Framework Agnostic

- Works with Tailwind (via next-themes)
- Works with Mantine (via color scheme)
- Works with shadcn (uses Tailwind)
- Easy to add more UI frameworks

### ✅ Type Safe

- TypeScript enforces `'light' | 'dark'`
- Compile-time safety
- No runtime errors

### ✅ Minimal Code

- Sync components are tiny (~20 lines)
- No complex state management
- Easy to maintain

## Adding New UI Frameworks

To add support for another UI framework:

1. **Create a sync component**:

   ```typescript
   function NewFrameworkSync() {
     const [globalTheme] = useAtom(themeAtom);
     const { setTheme } = useNewFramework();

     useEffect(() => {
       setTheme(globalTheme);
     }, [globalTheme, setTheme]);

     return null;
   }
   ```

2. **Add to provider tree**:

   ```tsx
   <NewFrameworkProvider>
     <NewFrameworkSync />
     {children}
   </NewFrameworkProvider>
   ```

3. **Done!** Your framework now stays in sync with global state.

## File Locations

- **State package**: `packages/state/src/createAppState.ts`
- **Theme Hook**: `apps/ottabase-template-app/ottabase/hooks/useThemeManager.ts`
- **next-themes Provider**: `apps/ottabase-template-app/ottabase/providers/ProviderNextThemes.tsx`
- **Mantine Provider**: `packages/ui-mantine/provider/ProviderUI.tsx`
- **DarkModeToggle (Example)**: `apps/ottabase-template-app/app/demo/components/DarkModeToggle.tsx`

## Migration Guide

If you have existing theme code:

1. **Remove** redundant theme providers and sync components (`MantineThemeSync`).
2. **Refactor** theme-switching components to use the `useThemeManager` hook.
3. **Ensure** UI providers like `ProviderUIMantine` are controlled and receive the theme as a prop.
4. **Delete** old, complex synchronization logic.

## Testing

To verify the system works:

1. Open DevTools → Application → Local Storage
2. Find `ottabase-theme` key
3. Toggle dark mode
4. Verify value changes to 'light' or 'dark'
5. Refresh page
6. Theme should persist
7. Check all UI frameworks update together
