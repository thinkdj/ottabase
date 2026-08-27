/**
 * @ottabase/state
 * Simple global state management for Ottabase apps using Jotai
 */

// Export types
export type {
    AppState,
    AppStateConfig,
    BaseUser,
    ContainerPadding,
    ContentWidth,
    Density,
    HeaderVariant,
    LayoutConfig,
    NavigationVariant,
    SidebarWidth,
    Theme,
    ThemeInfo,
    SidebarState,
} from './types';

// Export main function
export { createAppState } from './createAppState';

// Export provider
export { default as ProviderState } from './ProviderState';
