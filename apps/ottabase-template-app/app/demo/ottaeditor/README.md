# OttaEditor Demo

This demo showcases the new typesafe plugin configuration system for `@ottabase/ottaeditor`.

## What's Demonstrated

### Editor 1: All Default Plugins
Loads all 15 default plugins using `defaultPlugins: 'all'`

### Editor 2: Selective + Custom Plugin
- Only loads `header` and `paragraph` from defaults
- Adds a custom `CustomAlertPlugin` using `additionalPlugins`

## Files

- **`page.tsx`** - Demo page with two editor instances
- **`CustomAlertPlugin.ts`** - Example custom EditorJS plugin

## Key Features Shown

1. **Typesafe plugin selection** - Use `DEFAULT_PLUGIN_NAMES` constants
2. **'all' option** - Load all plugins with a single keyword
3. **Custom plugins** - Easy integration with `additionalPlugins`
4. **Live status** - React state updates when editor is ready

## Custom Plugin Example

The `CustomAlertPlugin` demonstrates:
- BlockTool interface implementation
- Custom UI rendering with dropdowns and textareas
- Data validation
- Inline styling injection
- Different alert types (info, warning, success, error)

This serves as a template for creating your own custom EditorJS plugins.
