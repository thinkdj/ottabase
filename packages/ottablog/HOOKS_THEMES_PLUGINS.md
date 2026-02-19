# Ottablog Hooks, Themes & Plugins

Ottablog supports a WordPress-style extensibility system with hooks, themes, and plugins.

## Hooks System

Hooks allow you to modify blog post content and behavior at specific points in the rendering process.

### Available Hooks

#### Content Hooks

- `post.content.filter` - Filter/modify post content (EditorJS format)
- `post.excerpt.filter` - Filter/modify post excerpt
- `post.title.filter` - Filter/modify post title

#### Render Hooks (Actions)

- `post.render.before` - Execute before rendering starts
- `post.render.after` - Execute after rendering completes
- `post.content.before` - Execute before content rendering
- `post.content.after` - Execute after content rendering

### Using Hooks

```typescript
import { addFilter, addAction, HOOKS } from '@ottabase/ottablog';

// Add a filter hook
addFilter(
    HOOKS['post.content.filter'],
    async (content, post) => {
        // Modify content
        return modifiedContent;
    },
    10,
); // Priority (lower = earlier execution)

// Add an action hook
addAction(
    HOOKS['post.render.before'],
    async (post, props) => {
        console.log('Rendering post:', post.title);
    },
    10,
);
```

## Theme System

Themes control how blog posts are rendered visually.

### Default Theme

Ottablog includes a default theme with modern styling and dark mode support.

### Creating a Custom Theme

```typescript
import { registerTheme, setActiveTheme } from '@ottabase/ottablog';
import type { Theme } from '@ottabase/ottablog';

const myTheme: Theme = {
	metadata: {
		id: 'my-theme',
		name: 'My Custom Theme',
		description: 'A beautiful custom theme',
		version: '1.0.0',
	},
	config: {
		classes: {
			container: 'my-blog-container',
			title: 'my-title-class',
			// ... more classes
		},
	},
	renderers: {
		renderHero: (post, props) => {
			// Custom hero rendering
			return <div>...</div>;
		},
		renderTitle: (post, props) => {
			// Custom title rendering
			return <h1>...</h1>;
		},
		// ... more renderers
	},
};

// Register and activate
registerTheme(myTheme);
setActiveTheme('my-theme');
```

### Theme Renderers

Available renderer functions:

- `renderHeader` - Custom header above post
- `renderHero` - Hero image rendering
- `renderTitle` - Title rendering
- `renderMetadata` - Author, date, reading time
- `renderExcerpt` - Excerpt rendering
- `renderContent` - Main content rendering
- `renderFootnotes` - Footnotes rendering
- `renderSeries` - Series navigation
- `renderFooter` - Footer rendering
- `renderCard` - Post card rendering (for listings)

## Plugin System

Plugins extend functionality through hooks and custom renderers.

### Example Plugin: Post Content Plugin

The Post Content Plugin injects content into posts at specified positions.

```typescript
import { registerPlugin, activatePlugin, postContentPlugin } from '@ottabase/ottablog';

// Create plugin instance
const plugin = postContentPlugin.end('<div class="alert">This is injected content!</div>', {
    priority: 10,
    contentTypes: ['blog'], // Only inject for blog posts
    postIds: [], // Optional: specific post IDs
});

// Register and activate
registerPlugin(plugin);
activatePlugin('post-content-plugin');
```

### Creating a Custom Plugin

```typescript
import { registerPlugin, activatePlugin, HOOKS } from '@ottabase/ottablog';
import type { Plugin } from '@ottabase/ottablog';

const myPlugin: Plugin = {
    metadata: {
        id: 'my-plugin',
        name: 'My Plugin',
        description: 'Adds custom functionality',
        version: '1.0.0',
    },
    lifecycle: {
        onActivate: async () => {
            console.log('Plugin activated!');
        },
        onDeactivate: async () => {
            console.log('Plugin deactivated!');
        },
    },
    hooks: {
        [HOOKS['post.content.filter']]: [
            {
                callback: async (content, post) => {
                    // Modify content
                    return modifiedContent;
                },
                priority: 10,
            },
        ],
    },
};

registerPlugin(myPlugin);
activatePlugin('my-plugin');
```

## Initialization

Initialize ottablog in your app:

```typescript
import { initOttablog } from '@ottabase/ottablog';

// Initialize with default theme
initOttablog({ defaultThemeId: 'default' });
```

## Integration Example

```typescript
// apps/my-app/src/ottabase/blog/init.ts
import { initOttablog, registerTheme, registerPlugin, activatePlugin, postContentPlugin } from '@ottabase/ottablog';

export function initBlogSystem() {
    // Initialize ottablog
    initOttablog({ defaultThemeId: 'default' });

    // Register custom theme
    registerTheme(myCustomTheme);
    setActiveTheme('my-custom-theme');

    // Register and activate plugin
    const plugin = postContentPlugin.end('<div class="bg-blue-50 p-4 my-4 rounded">Plugin content!</div>', {
        priority: 10,
    });
    registerPlugin(plugin);
    activatePlugin('post-content-plugin');
}
```

Then call `initBlogSystem()` in your app's provider or main entry point.

## Priority System

Hooks execute in priority order (lower numbers = earlier execution):

- `1-5`: Very early (core functionality)
- `6-10`: Early (important modifications)
- `11-20`: Normal (default)
- `21+`: Late (final touches)

## Best Practices

1. **Use filters for data transformation** - Modify content, titles, excerpts
2. **Use actions for side effects** - Logging, analytics, external API calls
3. **Set appropriate priorities** - Lower for core functionality, higher for cosmetic changes
4. **Test plugins thoroughly** - Ensure they work with different themes
5. **Document your plugins** - Include usage examples and configuration options
