# @ottabase/state

Type-safe, flexible state management for React applications built on Jotai, designed for monorepo environments.

## Features

- Type-safe global state management with TypeScript
- Factory pattern for isolated state instances per app
- Derived atoms for granular updates and optimized re-renders
- Generic support for custom user types
- Next.js 13+ App Router compatible and SSR-friendly

## Installation

```bash
pnpm add @ottabase/state jotai
```

## Quick Start

### 1. Create Your App State

```typescript
// ottabase/state/appGlobalState.ts
import { createDefaultAppState } from "@ottabase/state";

const appState = createDefaultAppState();

export const { appStateAtom, atoms, createLensedAtom } = appState;
export const {
  themeAtom,
  scaleAtom,
  userAtom,
  isMobileSidebarOpenAtom,
  isDesktopSidebarOpenAtom
} = atoms;
```

### 2. Setup Provider

```tsx
// app/providers.tsx
"use client";
import { ProviderState } from "@ottabase/state";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ProviderState>{children}</ProviderState>;
}
```

```tsx
// app/layout.tsx
import { Providers } from "./providers";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### 3. Use in Components

```tsx
"use client";
import { useAtom } from "jotai";
import { scaleAtom, themeAtom } from "@/ottabase/state/appGlobalState";

function Settings() {
  const [scale, setScale] = useAtom(scaleAtom);
  const [theme, setTheme] = useAtom(themeAtom);

  return (
    <div>
      <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
        Toggle Theme
      </button>
      <button onClick={() => setScale(s => s + 0.1)}>Zoom In</button>
    </div>
  );
}
```

## Common Use Cases

### Custom User Types

```typescript
// types/user.ts
import type { BaseUser } from "@ottabase/state";

export interface AppUser extends BaseUser {
  role: "admin" | "editor" | "viewer";
  preferences: {
    notifications: boolean;
  };
}

// state/appGlobalState.ts
import { createAppState } from "@ottabase/state";
import type { AppUser } from "@/types/user";

const appState = createAppState<AppUser>();
export const { userAtom } = appState.atoms;
```

### Read-Only Access

```tsx
import { useAtomValue } from "jotai";
import { themeAtom, userAtom } from "@/state/appGlobalState";

function Header() {
  const theme = useAtomValue(themeAtom);
  const user = useAtomValue(userAtom);

  return (
    <header className={theme}>
      {user ? `Welcome, ${user.name}` : "Not logged in"}
    </header>
  );
}
```

### Bulk Updates

```tsx
import { useSetAtom } from "jotai";
import { appGlobalStateAtom } from "@/state/appGlobalState";

function ResetButton() {
  const setAppState = useSetAtom(appGlobalStateAtom);

  const handleReset = () => {
    setAppState(prev => ({
      ...prev,
      theme: "light",
      scale: 1.0,
      isMobileSidebarOpen: false,
      isDesktopSidebarOpen: true,
    }));
  };

  return <button onClick={handleReset}>Reset Settings</button>;
}
```

### SSR with Initial Values

```tsx
// app/page.tsx (Server Component)
export default async function Page() {
  const user = await fetchUser();
  return <UserProfile initialUser={user} />;
}

// app/UserProfile.tsx (Client Component)
"use client";
import { ProviderState } from "@ottabase/state";
import { userAtom } from "@/state/appGlobalState";

export function UserProfile({ initialUser }) {
  return (
    <ProviderState initialValues={[[userAtom, initialUser]]}>
      <UserProfileContent />
    </ProviderState>
  );
}
```

## State Properties

```typescript
interface AppGlobalState<TUser extends BaseUser = BaseUser> {
  theme: "light" | "dark";
  scale: number;
  user: null | TUser;
  isMobileSidebarOpen: boolean;
  isDesktopSidebarOpen: boolean;
  coreModule?: string;
  currentModule?: string;
  cursorTheme: CursorTheme;
  selectionColor: TextSelectionColor;
  layoutProvider: LayoutProvider;
  layoutPreset: LayoutPresetType;
  layout?: SupportedLayout;
  routeContext?: any;
}
```

## API Reference

### `createAppState<TUser>(config?)`

Creates a new app state instance with custom configuration.

```typescript
const appState = createAppState<MyUser>({
  initialState: {
    theme: "dark",
    scale: 1.2,
  },
  coreModule: "admin"
});
```

### `createDefaultAppState(coreModule?)`

Convenience function for creating app state with minimal configuration.

```typescript
const appState = createDefaultAppState("dashboard");
```

### `ProviderState`

React component that provides Jotai context.

```tsx
<ProviderState initialValues={[[userAtom, serverUser]]}>
  <App />
</ProviderState>
```

## Best Practices

### 1. Create One State Instance Per App

Each app in your monorepo should create its own state instance. Don't share state instances between apps.

### 2. Use Granular Atoms for Performance

Prefer using specific property atoms over the main atom when possible.

```tsx
// Good: Only re-renders when theme changes
const theme = useAtomValue(themeAtom);

// Bad: Re-renders when ANY property changes
const { theme } = useAtomValue(appGlobalStateAtom);
```

### 3. Co-locate State Files

```
apps/my-app/
  src/
    state/
      appGlobalState.ts  ← State instance here
    components/
      Header.tsx         ← Import from @/state/appGlobalState
```

## Environment Variables

```bash
# Optional - auto-configured
NEXT_PUBLIC_CORE_MODULE=admin
```

## License

MIT
