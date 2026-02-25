# @ottabase/config

Shared configuration utilities for Ottabase applications with environment variable support.

## Features

- **`defineOttabaseConfig`** – Single user config file with full TypeScript autocomplete
- **Environment Variable Support** – Automatically reads from set environment variables
- **Type-Safe Configuration** – Full TypeScript support with strict typing
- **Flexible Defaults** – Override defaults per app or use global defaults
- **Storage Utilities** – Helper functions for consistent storage key naming

## Usage

### `defineOttabaseConfig` (recommended)

The recommended pattern for apps in this monorepo. Create a single `ottabase.config.ts` at your app root and import it
everywhere.

```typescript
// ottabase.config.ts  ← single user-owned config file
import { defineOttabaseConfig } from '@ottabase/config';

export default defineOttabaseConfig({
    appId: 'my-saas-app',
    appName: 'My SaaS App',

    meta: {
        description: 'Built on Ottabase',
        author: 'Your Name',
        companyName: 'My Company',
    },

    // Toggle built-in packages
    packages: {
        ottablog: true,
        shortlinks: true,
        referrals: true,
        brandEngine: false,
    },

    // Register custom / premium packages
    // (import tables in ottabase/config.migrations.ts, not here)
    customPackages: {
        // premiumFeature: { tables: { premiumTable } },
    },

    features: {
        referrals: { enabled: true, trackClicks: true, expiryDays: 90 },
        spotlight: { enabled: true, shortcuts: ['/'] },
    },

    theme: { colorDefault: 'tremorBlue' },
    storage: { prefix: 'my-app' },
});
```

### `createAppConfig` (low-level)

```typescript
import { createAppConfig } from '@ottabase/config';

const config = createAppConfig({
    appName: 'My Awesome App',
    appId: 'my-awesome-app',
});

console.log(config.appId); // "my-awesome-app"
```

### `userConfigToOptions`

Bridge between `OttabaseUserConfig` and `createAppConfig` options:

```typescript
import { createAppConfig, userConfigToOptions } from '@ottabase/config';
import userConfig from '../ottabase.config';

export const appConfig = createAppConfig(userConfigToOptions(userConfig));
```

### Environment Variables

```bash
APP_NAME="My App"
APP_DESCRIPTION="App description"
APP_AUTHOR="Your Name"
STORAGE_PREFIX="my-app"
UI_FRAMEWORK="mantine"    # mantine | shadcn | chakra | mui
```

### Storage Utilities

```typescript
import { createAppConfig, createStorageKey, STORAGE_KEYS } from '@ottabase/config';

const config = createAppConfig({ appName: 'My App' });
const themeKey = createStorageKey(config, STORAGE_KEYS.THEME); // "my-app-theme"
```
