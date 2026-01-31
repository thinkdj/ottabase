/**
 * Ottablog Initialization for TanStack App
 *
 * Initialize themes, plugins, and hooks
 */

import { initOttablog } from '@ottabase/ottablog';
import { registerTheme, setActiveTheme } from '@ottabase/ottablog';
import { registerPlugin, activatePlugin } from '@ottabase/ottablog';
import { postContentPlugin } from '@ottabase/ottablog';

/**
 * Initialize ottablog system
 */
export function initBlogSystem() {
    // Initialize ottablog with default theme
    initOttablog({ defaultThemeId: 'default' });

    // Register and activate example plugin with configurable options
    const plugin = postContentPlugin.end(
        '<div class="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 my-4 rounded"><p class="text-sm text-blue-800 dark:text-blue-200"><strong>Note:</strong> This content was injected by the Post Content Plugin!</p></div>',
        {
            position: 'end', // Can be changed to 'beginning' or 'random'
            priority: 10,
            enabled: true,
            contentTypes: [], // Empty = all content types
            postIds: [], // Empty = all posts
        },
    );

    registerPlugin(plugin);
    activatePlugin('post-content-plugin');

    console.log('✅ Ottablog initialized with hooks, themes, and plugins');
}
