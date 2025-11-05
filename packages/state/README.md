# @ottabase/state

A type-safe, flexible state management package for React applications built on [Jotai](https://jotai.org/). Designed for monorepo environments where multiple apps need isolated, yet consistent state management patterns.

## Features

- Type-safe global state management with TypeScript
- Factory pattern for creating isolated state instances per app
- Derived atoms for granular updates and optimized re-renders
- Generic support for custom user types
- Zero runtime dependencies (only peer dependencies)
- Next.js 13+ App Router compatible
- SSR-friendly
- Dual format builds (CommonJS + ESM)

## Installation

```bash
pnpm add @ottabase/state jotai
```

### Peer Dependencies

- `jotai` ^2.14.0
- `react` ^18.0.0

## Quick Start

### 1. Create Your App State

Create a state instance for your app (usually in a dedicated file). This file becomes the single source of truth for your app's global state exports.

```typescript
// ottabase/state/appGlobalState.ts
import { createDefaultAppState } from "@ottabase/state";

// 1. Create the state instance.
const appState = createDefaultAppState();

// 2. Export the main atom and derived, lensed atoms.
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

Wrap your app's root layout with the `ProviderState` component. It's recommended to do this within a dedicated `providers.tsx` file.

```tsx
// app/providers.tsx
"use client";

import { ProviderState } from "@ottabase/state";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ProviderState>
      {children}
    </ProviderState>
  );
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

The recommended pattern is to use the granular, lensed atoms. This ensures your components only re-render when the specific slice of state they depend on actually changes, maximizing performance.

```tsx
"use client";

import { useAtom } from "jotai";
import { scaleAtom } from "@/ottabase/state/appGlobalState";

function ScaleControl() {
  // This component will ONLY re-render when the `scale` value changes.
  const [scale, setScale] = useAtom(scaleAtom);

  return (
    <div>
      <p>Current scale: {scale.toFixed(1)}x</p>
      <button onClick={() => setScale(s => s + 0.1)}>
        +
      </button>
      <button onClick={() => setScale(s => s - 0.1)}>
        -
      </button>
    </div>
  );
}
```

## API Reference

### `createAppState<TUser>(config?)`

Creates a new app state instance with custom configuration.

**Type Parameters:**

- `TUser extends BaseUser` - Custom user type (optional)

**Parameters:**

```typescript
interface AppStateConfig<TUser extends BaseUser> {
  initialState?: Partial<AppGlobalState<TUser>>;
  coreModule?: string;
  envPrefix?: string; // Default: "NEXT_PUBLIC_"
}
```

**Returns:**

```typescript
{
  appGlobalStateAtom: WritableAtom<AppGlobalState<TUser>>,
  createAppGlobalStateAtom: <K extends keyof AppGlobalState<TUser>>(
    key: K
  ) => WritableAtom<AppGlobalState<TUser>[K]>,
  atoms: {
    isMobileSidebarOpenAtom,
    isDesktopSidebarOpenAtom,
    themeAtom,
    scaleAtom,
    userAtom,
    coreModuleAtom,
    currentModuleAtom,
    cursorThemeAtom,
    selectionColorAtom,
    layoutProviderAtom,
    layoutPresetAtom,
    layoutAtom,
    routeContextAtom,
  }
}
```

**Example:**

```typescript
import { createAppState, type BaseUser } from "@ottabase/state";

// With custom user type
interface MyUser extends BaseUser {
  role: "admin" | "user";
  permissions: string[];
}

const appState = createAppState<MyUser>({
  initialState: {
    theme: "dark",
    scale: 1.2,
    user: null,
  },
  coreModule: "admin"
});
```

### `createDefaultAppState(coreModule?)`

Convenience function to create app state with minimal configuration.

**Parameters:**

- `coreModule?: string` - Initial core module value

**Returns:** Same as `createAppState()`

**Example:**

```typescript
const appState = createDefaultAppState("dashboard");
```

### `ProviderState`

React component that provides Jotai context to your app.

**Props:**

```typescript
interface ProviderStateProps {
  children: React.ReactNode;
  initialValues?: Iterable<readonly [Atom<unknown>, unknown]>;
}
```

**Example:**

```tsx
// Basic usage
<ProviderState>
  <App />
</ProviderState>

// With SSR initial values
<ProviderState initialValues={[[userAtom, serverUser]]}>
  <App />
</ProviderState>
```

### State Properties

The global state object includes:

```typescript
interface AppGlobalState<TUser extends BaseUser = BaseUser> {
  theme: "light" | "dark";
  scale: number; // Default: 1.0
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
  routeContext?: any; // For storing route-specific data
}
```

### Type Exports

```typescript
// Theme types
type CursorTheme = "default" | "retro" | "neon" | "minimal";

// Selection color
interface TextSelectionColor {
  background: string;
  text: string;
}

// Layout types
type LayoutProvider = "tailwind" | "vanilla-extract" | "css-modules" | "styled-components";
type LayoutPresetType = "default" | "custom" | "fluid" | "fixed";
type SupportedLayout = "dashboard" | "editor" | "viewer";

// User type
interface BaseUser {
  id: string;
  name: string;
  email: string;
}
```

## Usage Patterns

### Pattern 1: Granular Updates (Recommended)

Use derived atoms for individual property updates. This optimizes re-renders by only updating components that subscribe to specific properties.

```tsx
import { useSetAtom } from "jotai";
import { themeAtom, scaleAtom } from "@/state/appGlobalState";

function Settings() {
  const setTheme = useSetAtom(themeAtom);
  const setScale = useSetAtom(scaleAtom);

  return (
    <>
      <button onClick={() => setTheme("dark")}>Dark Mode</button>
      <button onClick={() => setScale(1.5)}>Zoom In</button>
    </>
  );
}
```

### Pattern 2: Bulk Updates

Use the main atom when updating multiple properties at once.

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
      cursorTheme: "default",
      isMobileSidebarOpen: false,
      isDesktopSidebarOpen: true,
    }));
  };

  return <button onClick={handleReset}>Reset All Settings</button>;
}
```

### Pattern 3: Read-Only Access

Use `useAtomValue` when you only need to read state.

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

### Pattern 4: Custom Derived Atoms

Create custom derived atoms for properties not included in the pre-created atoms.

```tsx
import { useSetAtom } from "jotai";
import { createAppGlobalStateAtom } from "@/state/appGlobalState";

function RouteHandler() {
  const setRouteContext = useSetAtom(createAppGlobalStateAtom("routeContext"));

  useEffect(() => {
    setRouteContext({ pageId: "home", section: "hero" });
  }, []);

  return null;
}
```

### Pattern 5: Custom User Types

Extend the `BaseUser` interface for app-specific user data.

```typescript
// types/user.ts
import type { BaseUser } from "@ottabase/state";

export interface AppUser extends BaseUser {
  role: "admin" | "editor" | "viewer";
  preferences: {
    notifications: boolean;
    newsletter: boolean;
  };
  createdAt: string;
}

// state/appGlobalState.ts
import { createAppState } from "@ottabase/state";
import type { AppUser } from "@/types/user";

const appState = createAppState<AppUser>();
export const { userAtom } = appState.atoms;

// components/UserProfile.tsx
import { useAtomValue } from "jotai";
import { userAtom } from "@/state/appGlobalState";

function UserProfile() {
  const user = useAtomValue(userAtom);

  // TypeScript knows about custom properties
  return user ? (
    <div>
      <p>Role: {user.role}</p>
      <p>Notifications: {user.preferences.notifications ? "On" : "Off"}</p>
    </div>
  ) : null;
}
```

## Advanced Usage

### Server-Side Rendering (SSR)

Pass initial values from the server to hydrate state:

```tsx
// app/page.tsx (Server Component)
import { UserProfile } from "./UserProfile";

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

### Environment Variables

The package reads the `coreModule` from environment variables by default:

```bash
# .env.local
NEXT_PUBLIC_CORE_MODULE=admin
```

To use a different prefix:

```typescript
const appState = createAppState({
  envPrefix: "VITE_" // For Vite apps
});
```

### Storybook Integration

```tsx
// .storybook/preview.tsx
import { ProviderState } from "@ottabase/state";
import { appGlobalStateAtom } from "../src/state/appGlobalState";

export const decorators = [
  (Story, context) => {
    const initialTheme = context.globals.theme || "light";

    return (
      <ProviderState initialValues={[[appGlobalStateAtom, {
        theme: initialTheme,
        scale: 1.0,
        user: null,
        isMobileSidebarOpen: false,
        isDesktopSidebarOpen: true,
      }]]}>
        <Story />
      </ProviderState>
    );
  },
];
```

## Best Practices

### 1. Create One State Instance Per App

Each app in your monorepo should create its own state instance. Don't share state instances between apps.

```typescript
// ✅ Good: Each app has its own state file
// apps/app1/state/appGlobalState.ts
const appState = createDefaultAppState();

// apps/app2/state/appGlobalState.ts
const appState = createDefaultAppState();

// ❌ Bad: Importing state from another app
import { appGlobalStateAtom } from "../../../app1/state/appGlobalState";
```

### 2. Use Granular Atoms for Performance

Prefer using specific property atoms over the main atom when possible.

```tsx
// ✅ Good: Only re-renders when theme changes
const theme = useAtomValue(themeAtom);

// ❌ Bad: Re-renders when ANY property changes
const { theme } = useAtomValue(appGlobalStateAtom);
```

### 3. Co-locate State Files

Keep your state instance file close to where it's used.

```
apps/my-app/
  src/
    state/
      appGlobalState.ts  ← State instance here
    components/
      Header.tsx         ← Import from @/state/appGlobalState
```

### 4. Don't Mix Global and Local State

Use this package for truly global state. Use React's `useState` or Jotai's local atoms for component-specific state.

```tsx
// ✅ Good: Theme is global, menu is local
const theme = useAtomValue(themeAtom);
const [isMenuOpen, setIsMenuOpen] = useState(false);

// ❌ Bad: Adding too much to global state
// Don't add isMenuOpen to global state if only one component needs it
```

### 5. Type Your Custom User

Always extend `BaseUser` for type safety.

```typescript
// ✅ Good: Type-safe user
interface AppUser extends BaseUser {
  role: string;
}
const appState = createAppState<AppUser>();

// ❌ Bad: Losing type safety
const appState = createAppState<any>();
```

## Monorepo Usage

This package is designed for monorepo environments. Here's how to use it effectively:

### Package Structure

```
packages/
  state/          ← This package
apps/
  app1/
    src/
      state/
        appGlobalState.ts   ← App1's state instance
  app2/
    src/
      state/
        appGlobalState.ts   ← App2's state instance
```

### Dependencies

In your app's `package.json`:

```json
{
  "dependencies": {
    "@ottabase/state": "workspace:*",
    "jotai": "^2.14.0",
    "react": "^18.3.1"
  }
}
```

### Building

The package is built with `tsup` and outputs:

- CommonJS: `dist/index.js`
- ESM: `dist/index.mjs`
- TypeScript declarations: `dist/index.d.ts` and `dist/index.d.mts`

Build command:

```bash
pnpm build
```

Development mode with watch:

```bash
pnpm dev
```

## Migration Guide

### From Local State Management

If you have an existing local state management setup:

1. **Install the package:**

   ```bash
   pnpm add @ottabase/state jotai
   ```

2. **Create your state instance:**

   ```typescript
   // src/state/appGlobalState.ts
   import { createDefaultAppState } from "@ottabase/state";

   const appState = createDefaultAppState();

   export const appGlobalStateAtom = appState.appGlobalStateAtom;
   export const { themeAtom, userAtom } = appState.atoms;
   ```

3. **Replace your provider:**

   ```tsx
   // Before
   <YourCustomProvider>
     <App />
   </YourCustomProvider>

   // After
   <ProviderState>
     <App />
   </ProviderState>
   ```

4. **Update component imports:**

   ```typescript
   // Before
   import { useTheme } from "@/context/ThemeContext";

   // After
   import { useAtomValue } from "jotai";
   import { themeAtom } from "@/state/appGlobalState";
   const theme = useAtomValue(themeAtom);
   ```

## Troubleshooting

### "Cannot find module '@ottabase/state'"

Make sure you've installed the package and its peer dependencies:

```bash
pnpm add @ottabase/state jotai react
```

### "Multiple state instances detected"

You might be creating multiple state instances. Ensure you only call `createAppState()` once per app:

```typescript
// ✅ Good: Single instance
const appState = createDefaultAppState();
export const appGlobalStateAtom = appState.appGlobalStateAtom;

// ❌ Bad: Creating multiple instances
export const appState1 = createDefaultAppState();
export const appState2 = createDefaultAppState();
```

### Components not re-rendering

Make sure you've wrapped your app with `ProviderState`:

```tsx
<ProviderState>
  <App />
</ProviderState>
```

### Type errors with custom user

Ensure your custom user extends `BaseUser`:

```typescript
import type { BaseUser } from "@ottabase/state";

interface MyUser extends BaseUser {
  // your custom fields
}
```

## Contributing

This package is part of the Ottabase monorepo. To contribute:

1. Make your changes in `packages/state/src/`
2. Run tests: `pnpm test`
3. Build: `pnpm build`
4. Test in an app: `pnpm dev` (watch mode)

## License

MIT

## Related Packages

- [@ottabase/ui](../ui) - UI component library
- [@ottabase/utils](../utils) - Utility functions
- [Jotai](https://jotai.org/) - Primitive and flexible state management for React
