# @ottabase/config

Shared configuration utilities for Ottabase applications with environment variable support.

This package ships two complementary config systems: `createAppConfig()` for env-driven runtime app config (UI framework, theme, storage prefix, feature toggles), and `defineOttabaseConfig()` — the single source of truth for package gating, feature configuration, email settings, and env-override resolution that real apps build their `ottabase.config.ts` on (see `apps/otta-web/ottabase/ottabase.config.ts` for a live example).

## Features

- **Environment Variable Support**: Automatically reads from set environment variables
- **Type-Safe Configuration**: Full TypeScript support with strict typing
- **Flexible Defaults**: Override defaults per app or use global defaults
- **Storage Utilities**: Helper functions for consistent storage key naming
- **Multiple UI Framework Support**: Built-in support for Mantine, Shadcn, Chakra, MUI, and Tremor
- **Ottabase App Config**: `defineOttabaseConfig()` — single source of truth for package toggles, feature configuration (referrals, spotlight, crudHub, pagination, auth behavior), email settings, and environment-variable override resolution via `resolveConfigWithEnv()`

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
            scopeByAppId: true,
            spotlight: { enabled: false },
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
UI_FRAMEWORK="mantine"    # mantine | shadcn | chakra | mui | tremor

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
// Result: "my-app.theme"

const customKey = createStorageKey(config, 'user-settings');
// Result: "my-app.user-settings"

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
    appId: string;
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
    uiFramework: 'mantine' | 'shadcn' | 'chakra' | 'mui' | 'tremor';
    ui: {
        preventFOUC: boolean;
        preventFOUCInsideIframe: boolean;
        debounceMs: number;
        layout: { minWidth: number; maxWidth: number };
        enforceGoogleFonts: boolean;
    };
    theme?: {
        colorDefault: string;
        colors: ThemeColors;
    };
    storage: {
        prefix: string;
    };
    api: {
        serverErrorHttpCode: number;
    };
    features: {
        scopeByAppId: boolean;
        spotlight: SpotlightConfig;
        crudHub: CrudHubConfig;
        auth: AuthConfig;
        pagination: PaginationConfig;
        referrals: ReferralsConfig;
    };
    model: {
        defaultRelKey: string;
    };
}
```

## Ottabase Config (`defineOttabaseConfig`)

While `createAppConfig()` covers env-driven runtime app config, `defineOttabaseConfig()` is the **single source of truth** for package gating, feature configuration, email settings, and the migrations/routes an app wires up. This is what real apps use to configure themselves — see `apps/otta-web/ottabase/ottabase.config.ts` for a live example.

```typescript
// ottabase.config.ts
import { defineOttabaseConfig } from '@ottabase/config';

export default defineOttabaseConfig({
    appId: 'otta-web',
    appName: 'My App',

    // Toggle built-in packages on/off
    packages: {
        comments: true,
        ottablog: true,
        shortlinks: true,
        referrals: true,
    },

    // Register custom/premium packages (tables + migrations)
    customPackages: {},

    // Feature configuration
    features: {
        referrals: { enabled: true, trackClicks: true, expiryDays: 90, referralParam: 'ref' },
        spotlight: { enabled: true, shortcuts: ['/'] },
        pagination: { defaultPageSize: 10, maxPageSize: 100, sizeOptions: [5, 10, 20, 50, 100] },
        crudHub: { apiBaseUrl: '/api/crudhub', urlBase: 'crudhub', urlBaseListing: 'browse' },
        authBehavior: {
            sessionMaxAge: 30 * 24 * 60 * 60,
            requireEmailVerified: false,
            disableCredentials: false,
            verbose: false,
        },
    },

    // Non-secret email settings (secrets stay in env vars)
    email: { from: 'noreply@example.com', sesRegion: 'us-east-1' },

    ui: { preventFOUC: false, debounceMs: 500, layout: { minWidth: 320, maxWidth: 1280 }, enforceGoogleFonts: true },
});
```

`defineOttabaseConfig()` validates required fields (`appId`, `appName`), merges built-in defaults with your overrides, and warns on unrecognised top-level keys.

**Helpers:**

- `isPackageEnabled(config, 'referrals')` / `isCustomPackageEnabled(config, 'myPremiumFeature')` — check whether a built-in or custom package is enabled.
- `resolveConfigWithEnv(config, env)` — applies environment-variable overrides (see `ENV_KEYS`) on top of the config file, with precedence **ENV > config file > default**. Pass the request env (e.g. Cloudflare Workers `env`) per request; secrets (auth secret, OAuth keys, API keys) must still come from env vars only, never from the config file.
- `BUILT_IN_PACKAGES` — the list of built-in package keys (`'comments' | 'ottablog' | 'shortlinks' | 'referrals'`).

**Types:** `OttabaseConfig` (the resolved config) and `OttabaseConfigInput` (what you pass to `defineOttabaseConfig()`).

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
                        spotlight: { enabled: true },
                        referrals: { enabled: false },
                    },
                },
            }),
        [],
    );
}
```
