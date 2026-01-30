# @ottabase/config

Shared configuration utilities for Ottabase applications with environment variable support.

## Features

- **Environment Variable Support**: Automatically reads from set environment variables
- **Type-Safe Configuration**: Full TypeScript support with strict typing
- **Flexible Defaults**: Override defaults per app or use global defaults
- **Storage Utilities**: Helper functions for consistent storage key naming
- **Multiple UI Framework Support**: Built-in support for Mantine, Shadcn, Chakra, and MUI

## Installation

```bash
pnpm add @ottabase/config
```

## Usage

### Basic Usage

```typescript
import { createAppConfig } from '@ottabase/config';

// Create config with defaults (single-app mode)
const config = createAppConfig({
    appName: 'My Awesome App',
    appId: 'my-awesome-app',
});

// For multi-app database sharing, enable the feature flag
const multiAppConfig = createAppConfig({
    appName: 'My Awesome App',
    appId: 'my-awesome-app',
    defaults: {
        features: { scopeByAppId: true },
    },
});
// IMP NOTE: Use the same `appId` for multi-app database sharing of Core Models

console.log(config.features.scopeByAppId); // false (default)
console.log(config.appId); // "my-awesome-app"
```

### With Custom Defaults

```typescript
import { createAppConfig } from '@ottabase/config';

const config = createAppConfig({
    appName: 'My App',
    defaults: {
        meta: {
            author: 'Custom Author',
            description: 'Custom description',
        },
        uiFramework: 'shadcn',
        features: {
            darkMode: false,
            analytics: true,
        },
    },
});
```

### Environment Variables

The package reads environment variables with optional prefix (default: no prefix):

```bash
# App Identity
APP_ID="my-app"           # Unique identifier for multi-app database sharing
SCOPE_BY_APP_ID="true"    # Enable appId scoping for DB queries

# App Meta
APP_NAME="My App"
APP_TITLE="My App Title"
APP_DESCRIPTION="App description"
APP_LOGO_URL="/custom-logo.png"
APP_AUTHOR="Your Name"
APP_KEYWORDS="react,tanstack,typescript"
APP_ROBOTS="index,follow"
APP_COPYRIGHT_TEXT="© 2024 Your Company"
APP_COMPANY_NAME="Your Company"

# UI Framework
UI_FRAMEWORK="mantine"    # mantine | shadcn | chakra | mui

# Storage
STORAGE_PREFIX="my-app"
```

> **Note**: Use `envPrefix` option if you need prefixed vars (e.g., for Vite: `envPrefix: "VITE_"`).

### Storage Utilities

```typescript
import { createAppConfig, createStorageKey, STORAGE_KEYS } from '@ottabase/config';

const config = createAppConfig({ appName: 'My App' });

// Create prefixed storage keys
const themeKey = createStorageKey(config, STORAGE_KEYS.THEME);
// Result: "my-app-theme"

const customKey = createStorageKey(config, 'user-settings');
// Result: "my-app-user-settings"

// Use in localStorage
localStorage.setItem(themeKey, 'dark');
```

### TypeScript Types

```typescript
import type { AppConfig, AppMeta, SupportedUIFramework } from '@ottabase/config';

// Use the types in your app
function useAppConfig(): AppConfig {
    return createAppConfig({ appName: 'My App' });
}

// Type-safe UI framework
const framework: SupportedUIFramework = 'mantine';
```

## Configuration Structure

```typescript
interface AppConfig {
    meta: {
        appName: string;
        logoUrl: string;
        title: string;
        author: string;
        description: string;
        keywords: string;
        robots: string;
        copyrightText: string;
        companyName: string;
    };
    uiFramework: 'mantine' | 'shadcn' | 'chakra' | 'mui';
    features: {
        darkMode: boolean;
        analytics: boolean;
        notifications: boolean;
    };
    api: {
        baseUrl: string;
        timeout: number;
    };
    storage: {
        prefix: string;
    };
}
```

## Examples

### Next.js App Router

```typescript
// app/layout.tsx
import { createAppConfig } from '@ottabase/config';

const config = createAppConfig({
  appName: 'My Next.js App',
});

export const metadata = {
  title: config.meta.title,
  description: config.meta.description,
  keywords: config.meta.keywords,
  robots: config.meta.robots,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### Custom Hook

```typescript
// hooks/useAppConfig.ts
import { createAppConfig } from '@ottabase/config';
import { useMemo } from 'react';

export function useAppConfig() {
    return useMemo(
        () =>
            createAppConfig({
                appName: 'My App',
                defaults: {
                    features: {
                        darkMode: true,
                        analytics: false,
                        notifications: true,
                    },
                },
            }),
        [],
    );
}
```
