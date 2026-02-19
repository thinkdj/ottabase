# Ottablog Studio

Management system for **themes** and **plugins**. State lives in the DB (`ottablog_themes`, `ottablog_plugins`); the app
loads it and applies it to **in-memory registries** so `BlogRenderer` uses the right theme and plugin hooks.

---

## Architecture

```
DB (ottablog_themes, ottablog_plugins)
    → StudioManager.initialize() / getState()
    → Theme registry (active theme) + Plugin registry (enabled plugins, hooks)
    → BlogRenderer: getActiveTheme() + applyFilters(...)
```

- **DB** = source of truth (which theme is active, which plugins enabled, plugin `config`).
- **Registries** = in-memory; must be synced from DB at init (client) or per request (server).
- **BlogRenderer** reads theme from registry and runs hooks (plugins register filters); no direct DB access in render.

---

## Theme registry (in-memory)

Singleton. Map of `themeId` → `Theme`; one `activeThemeId`.

```ts
import { registerTheme, setActiveTheme, getActiveTheme, getAllThemes } from '@ottabase/ottablog';

registerTheme(myTheme); // add to Map
setActiveTheme('minimal'); // set activeThemeId
const theme = getActiveTheme(); // used by BlogRenderer for layout
getAllThemes(); // list all registered
```

**Theme** = `{ metadata: { id, name, description?, ... }, renderHeader?, renderHero?, renderContent?, ... }`.  
`BlogRenderer` calls `getActiveTheme()` and uses its renderers for header, hero, content, etc.

---

## Plugin registry (in-memory)

Singleton. Map of `pluginId` → `Plugin`; Set of **active** plugin ids. Activating a plugin **registers its hooks** with
the hook system; deactivating removes them.

```ts
import { registerPlugin, activatePlugin, deactivatePlugin, isPluginActive, getPlugin } from '@ottabase/ottablog';

registerPlugin(plugin); // add to Map (not active yet)
await activatePlugin('content-injector-plugin'); // register hooks, add to active set
await deactivatePlugin('content-injector-plugin'); // remove hooks, remove from active set
isPluginActive('content-injector-plugin');
getPlugin('content-injector-plugin');
```

**Plugin** =
`{ metadata: { id, name, ... }, hooks: { 'post.content.filter': [{ callback, priority }] }, options?: {...} }`.  
On `activate`, the registry calls `addFilter(hookName, callback, priority)` (and `addAction` for actions) so
`BlogRenderer`’s `applyFilters(HOOKS['post.content.filter'], content, post)` runs all active plugins’ callbacks.

---

## Hooks (used by plugins)

Filters transform data; actions run side effects. `BlogRenderer` runs e.g.:

- `applyFilters('post.title.filter', post.title, post)`
- `applyFilters('post.excerpt.filter', post.excerpt, post)`
- `applyFilters('post.content.filter', post.content, post)`

Plugins register on these via `hooks` in their definition; only **active** plugins’ callbacks run.

---

## DB models

- **OttablogTheme** – `themeId`, `name`, `isActive`, `config`, `appId`. One row per theme per app; at most one
  `isActive` per app.
- **OttablogPlugin** – `pluginId`, `name`, `enabled`, `config`, `appId`. One row per plugin per app. `config` = JSON
  (e.g. Content Injector: content, position, contentTypes, priority).

---

## StudioManager (server)

Syncs DB → registries; used by API handlers.

```ts
import { StudioManager } from '@ottabase/ottablog';

// Apply DB state to registries (set active theme, activate enabled plugins by id)
await StudioManager.initialize(appId);

// Read DB state for admin UI (themes + plugins lists)
const state = await StudioManager.getState(appId);
// { activeThemeId, themes: StudioThemeState[], plugins: StudioPluginState[] }
```

`initialize` does **not** apply plugin `config`; that’s done on the client when building plugin instances from
`row.config`.

---

## API (worker)

| Method | Path                              | Body                    | Action                                                                                 |
| ------ | --------------------------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| GET    | `/api/blog/studio/state`          | -                       | `StudioManager.getState(appId)`; optionally seed default theme + plugin rows if empty. |
| POST   | `/api/blog/studio/theme/activate` | `{ themeId }`           | Find or create theme row, `theme.activate({ appId })`.                                 |
| POST   | `/api/blog/studio/plugin/enable`  | `{ pluginId, enabled }` | Find or create plugin row, set `enabled`, save.                                        |
| POST   | `/api/blog/studio/plugin/config`  | `{ pluginId, config }`  | `pluginRow.updateConfig(config)`.                                                      |

---

## Client init

1. **Register defaults**: `initOttablog()`, then `registerPlugin(contentInjectorPlugin.end(...))` with a default static
   content (fallback until state is applied).
2. **Fetch state**: `GET /api/blog/studio/state`. Use an **in-flight dedupe** so concurrent calls (e.g. React Strict
   Mode) share one request: if a request is already in flight, await that promise instead of firing another.
3. **Apply state**:
    - `setActiveTheme(activeThemeId)`.
    - For each plugin that is **disabled** in state (e.g. content-injector): if registered, `deactivatePlugin(pluginId)`
      so the default static plugin does not run.
    - For each **enabled** plugin with `config`: for **Content Injector**, **replace** the default plugin with the
      config-based one: if already registered, `deactivatePlugin(pluginId)` (removes hooks), then
      `createContentInjectorPlugin(config)`, `registerPlugin(plugin)`, `activatePlugin(pluginId)`. Rendered content then
      comes from DB config, not the default static message. For other plugins, create from config, register, activate.
4. Set `isReady` (e.g. BlogStudioContext) and key `BlogRenderer` on it so the tree re-mounts after registries are
   updated.

```ts
// Example: apply studio state (simplified; with Content Injector replacement)
const state = await api('/api/blog/studio/state');
if (state.activeThemeId) setActiveTheme(state.activeThemeId);
// Deactivate disabled plugins (e.g. content-injector when disabled)
for (const p of state.plugins.filter((x) => !x.enabled && x.pluginId === 'content-injector-plugin'))
    if (hasPlugin(p.pluginId)) await deactivatePlugin(p.pluginId);
// Apply enabled plugins: replace default with config-based for Content Injector
for (const p of state.plugins.filter((x) => x.enabled)) {
    if (p.pluginId === 'content-injector-plugin') {
        if (hasPlugin(p.pluginId)) await deactivatePlugin(p.pluginId);
        const plugin = createContentInjectorPlugin(p.config || {});
        registerPlugin(plugin);
    }
    await activatePlugin(p.pluginId);
}
```

---

## Admin UI

- **Blog Studio** page: list themes (Activate) and plugins (Enable/Enabled + Configure for Content Injector).
- State is loaded with **React Query** (`GET /api/blog/studio/state`) so multiple consumers share one request and Strict
  Mode does not double-fetch.
- Enable/disable only on the row; no “enabled” in config modal.
- Config modal: Content, Position, Content types, Priority → `POST /api/blog/studio/plugin/config`.

---

## Content Injector – security (XSS)

Content is rendered as HTML in EditorJS paragraph blocks. Only allow input from trusted admins, or sanitize HTML (e.g.
DOMPurify) in the admin UI before saving to prevent XSS.

## Content Injector config (JSON)

| Key            | Type                               | Description                          |
| -------------- | ---------------------------------- | ------------------------------------ |
| `content`      | string                             | HTML to inject.                      |
| `position`     | `'beginning' \| 'end' \| 'random'` | Where to inject.                     |
| `contentTypes` | string[]                           | Filter by content type; empty = all. |
| `priority`     | number                             | Hook priority.                       |

---

## Adding a new theme

1. Implement `Theme` (metadata + renderers). See `themes/default.tsx`.
2. Register at init: `registerTheme(myTheme)`.
3. Ensure a row exists so Studio lists it: seed in `GET /api/blog/studio/state` (e.g. create rows for `getAllThemes()`)
   or let `POST theme/activate` find-or-create by `themeId`.

```ts
const myTheme = { metadata: { id: 'my-theme', name: 'My Theme' }, renderContent: (post, props) => <div>...</div> };
registerTheme(myTheme);
```

---

## Adding a new plugin

1. Implement `Plugin` (metadata + hooks). See `plugins/content-injector-plugin.tsx`.
2. Register at init: `registerPlugin(myPlugin)` or create from config then register + activate.
3. Ensure a row exists: seed in `GET /api/blog/studio/state` or let `POST plugin/enable` find-or-create.
4. Optional config: store in `OttablogPlugin.config`; in client apply state, build options from `row.config`, create
   plugin, register, activate; add Configure modal in admin and `POST /api/blog/studio/plugin/config`.

```ts
const plugin = {
    metadata: { id: 'my-plugin', name: 'My Plugin' },
    hooks: {
        [HOOKS['post.content.filter']]: [{ callback: async (content, post) => content, priority: 10 }],
    },
};
registerPlugin(plugin);
await activatePlugin('my-plugin');
```

---

## Exports

- **Studio**: `StudioManager`, `StudioState`, `StudioThemeState`, `StudioPluginState`.
- **Theme**: `registerTheme`, `setActiveTheme`, `getActiveTheme`, `getAllThemes`, `getTheme`, `hasTheme`.
- **Plugin**: `registerPlugin`, `getPlugin`, `getAllPlugins`, `activatePlugin`, `deactivatePlugin`, `isPluginActive`,
  `getActivePlugins`, `hasPlugin`.
- **Content Injector**: `createContentInjectorPlugin`, `contentInjectorPlugin` (`.begin()`, `.end()`, `.random()`),
  `updateContentInjectorPluginConfig`.
