# @ottabase/state — agent notes
Jotai-based global app state (theme, user, sidebar, loading) for Ottabase apps. Full docs: ./README.md

## Use when
- Client-side React global UI state: theme, auth user, sidebar, scale/zoom, language, appId/organizationId.
- NOT for server-side or persisted data state, or one-off local state — use plain Jotai `atom()` or React state.

## Imports
    import { createAppState, ProviderState } from '@ottabase/state';
    import type { AppState, AppStateConfig, BaseUser, Theme, ThemeInfo, SidebarState, LayoutConfig } from '@ottabase/state';

## Canonical usage
    const { appStateAtom, atoms, createAtom } = createAppState<AppUser>({
        appName: 'My App',
        initialState: { appId: APP_ID, theme: 'light' },
    });
    export const { themeAtom, userAtom, sidebarStateAtom, isLoadingAtom } = atoms;

## Gotchas
- `jotai` is a peerDependency (catalog:) — the app must install it; wrap the tree in `ProviderState`.
- `createAtom(key)` only works for keys of `AppState`; custom state needs plain jotai `atom()`.
- Pass a `store` (jotai `createStore()`) to `ProviderState` to read atoms outside React (see apps/otta-web/src/ottabase/state/appState.ts).
