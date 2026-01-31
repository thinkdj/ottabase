# Ottablog Extensibility System

WordPress-style themes and plugins management system for Ottablog.

## Overview

The extensibility system provides a unified interface for managing themes and plugins with database persistence. All
theme activation, plugin enable/disable, and configuration changes are managed through the `ExtensibilityManager`.

## Models

### OttablogTheme

Stores theme registry state, active status, and configuration.

**Fields:**

- `id` - Unique identifier
- `themeId` - Theme identifier (matches registry `theme.metadata.id`)
- `name` - Theme name
- `description` - Theme description
- `version` - Theme version
- `author` - Theme author
- `url` - Theme URL
- `screenshot` - Screenshot URL
- `isActive` - Active status (only one theme can be active per appId)
- `config` - Theme configuration (flexible JSON meta)
- `appId` - App identifier for multi-tenant support
- `createdAt`, `updatedAt` - Timestamps

### OttablogPlugin

Stores plugin registry state, enabled status, and configuration.

**Fields:**

- `id` - Unique identifier
- `pluginId` - Plugin identifier (matches registry `plugin.metadata.id`)
- `name` - Plugin name
- `description` - Plugin description
- `version` - Plugin version
- `author` - Plugin author
- `url` - Plugin URL
- `enabled` - Enabled status
- `config` - Plugin configuration (flexible JSON meta)
- `appId` - App identifier for multi-tenant support
- `createdAt`, `updatedAt` - Timestamps

## ExtensibilityManager

Unified interface for managing themes and plugins.

### Initialization

```typescript
import { createExtensibilityManager } from '@ottabase/ottablog';

// Create manager instance
const manager = createExtensibilityManager({ appId: 'my-app' });

// Initialize: syncs themes/plugins, activates enabled plugins, sets active theme
await manager.initialize();
```

### Theme Management

```typescript
// Sync registered themes with database
await manager.syncThemes();

// Activate a theme (deactivates others)
await manager.activateTheme('default');

// Get active theme
const activeTheme = await manager.getActiveTheme();

// Update theme configuration
await manager.updateThemeConfig('default', {
    customColor: '#ff0000',
    showAuthor: true,
});

// Merge configuration (preserves existing keys)
await manager.mergeThemeConfig('default', {
    showAuthor: false,
});

// Get theme configuration
const config = await manager.getThemeConfig('default');

// Get all themes
const themes = await manager.getAllThemes();
```

### Plugin Management

```typescript
// Sync registered plugins with database
await manager.syncPlugins();

// Enable a plugin
await manager.enablePlugin('post-content-plugin');

// Disable a plugin
await manager.disablePlugin('post-content-plugin');

// Check if plugin is enabled
const isEnabled = await manager.isPluginEnabled('post-content-plugin');

// Update plugin configuration
await manager.updatePluginConfig('post-content-plugin', {
    content: '<div>Custom content</div>',
    position: 'end',
    priority: 20,
});

// Merge configuration (preserves existing keys)
await manager.mergePluginConfig('post-content-plugin', {
    priority: 15,
});

// Get plugin configuration
const config = await manager.getPluginConfig('post-content-plugin');

// Get enabled plugins
const enabledPlugins = await manager.getEnabledPlugins();

// Get all plugins
const plugins = await manager.getAllPlugins();
```

### Sync Operations

```typescript
// Sync themes and plugins
await manager.syncAll();

// Or individually
await manager.syncThemes();
await manager.syncPlugins();
```

## Usage Pattern

### 1. Register Themes/Plugins

```typescript
import { initOttablog, registerTheme, registerPlugin } from '@ottabase/ottablog';

// Initialize ottablog (registers default themes)
initOttablog();

// Register custom theme
registerTheme(myCustomTheme);

// Register custom plugin
registerPlugin(myCustomPlugin);
```

### 2. Initialize Extensibility Manager

```typescript
import { createExtensibilityManager } from '@ottabase/ottablog';

const manager = createExtensibilityManager({ appId: 'my-app' });

// This will:
// - Sync registered themes/plugins to database
// - Activate enabled plugins
// - Set active theme from database
await manager.initialize();
```

### 3. Admin UI Integration

The `ExtensibilityManager` can be exposed to your TanStack admin interface:

```typescript
// API route: /api/blog/extensibility/themes
export async function GET(request: Request) {
    const manager = createExtensibilityManager({ appId: getAppId(request) });
    const themes = await manager.getAllThemes();
    return Response.json(themes);
}

// API route: /api/blog/extensibility/themes/:themeId/activate
export async function POST(request: Request, { params }: { params: { themeId: string } }) {
    const manager = createExtensibilityManager({ appId: getAppId(request) });
    await manager.activateTheme(params.themeId);
    return Response.json({ success: true });
}

// API route: /api/blog/extensibility/plugins/:pluginId/enable
export async function POST(request: Request, { params }: { params: { pluginId: string } }) {
    const manager = createExtensibilityManager({ appId: getAppId(request) });
    await manager.enablePlugin(params.pluginId);
    return Response.json({ success: true });
}

// API route: /api/blog/extensibility/plugins/:pluginId/config
export async function PUT(request: Request, { params }: { params: { pluginId: string } }) {
    const manager = createExtensibilityManager({ appId: getAppId(request) });
    const config = await request.json();
    await manager.updatePluginConfig(params.pluginId, config);
    return Response.json({ success: true });
}
```

## Best Practices

1. **Always sync before activation**: The manager automatically syncs before activating themes/plugins, but you can
   manually sync when registering new themes/plugins.

2. **Use appId for multi-tenant**: Pass `appId` to the manager constructor for multi-tenant support.

3. **Initialize on app startup**: Call `manager.initialize()` when your app starts to load active theme and enabled
   plugins from database.

4. **Config is flexible JSON**: Use the `config` field for any plugin/theme-specific settings. The manager provides
   `updateConfig()` (replace) and `mergeConfig()` (merge) methods.

5. **Only one active theme**: The system ensures only one theme is active per appId. Activating a theme automatically
   deactivates others.

6. **Database-first**: All state is persisted in the database. The registry is synced with the database, not the other
   way around.

## Database Schema

Add to your schema:

```typescript
// ottabase/db/schema.ts
export { ottablogPluginsTable, ottablogThemesTable } from '@ottabase/ottablog';
```

Then run migrations:

```bash
curl -X POST http://localhost:3000/api/ottaorm/init
```
