# @ottabase/spotlight — agent notes

React command palette (Cmd+K style) with debounced, abortable async search. Full docs: ./README.md

## Use when

- Adding a keyboard-triggered global search/command palette to a React app, especially with async API-backed results.
- NOT for non-React contexts or plain inline search inputs without a modal palette.

## Imports

    import { SpotlightProvider, Spotlight, useSpotlight, useSpotlightSearch } from '@ottabase/spotlight';
    import { createApiSearchHandler, createApiSearchHandlerWithSignal } from '@ottabase/spotlight';
    import type { SpotlightConfig, SpotlightProps, SpotlightResult, SpotlightContextValue } from '@ottabase/spotlight';
    import type { UseSpotlightSearchOptions, UseSpotlightSearchReturn, CreateApiSearchHandlerOptions } from '@ottabase/spotlight';

## Canonical usage

    <SpotlightProvider
        shortcuts={['mod+k', '/']}
        minQueryLength={2}
        onSearch={async (query, signal) => {
            const res = await fetch(`/api/search?q=${query}`, { signal });
            return res.json(); // SpotlightResult[]: { id, label, description?, icon?, onSelect? }
        }}
    >
        {children}
    </SpotlightProvider>

    // Programmatic control (inside provider)
    const { open, setOpen, toggle } = useSpotlight();

    // With @ottabase/api (optional peer)
    const onSearch = createApiSearchHandler({
        api,
        endpoint: '/api/search',
        transform: (item) => ({ id: item.id, label: item.title }),
    });

## Gotchas

- Default trigger shortcut is '/' (not mod+k); pass shortcuts={['mod+k']} to change. Shortcuts are ignored while typing in inputs/textareas/contentEditable.
- minQueryLength defaults to 0: any non-empty query fires a search (empty/whitespace never does). Raise it to avoid 1-char API calls.
- createApiSearchHandler does NOT propagate AbortSignal (@ottabase/api limitation); use createApiSearchHandlerWithSignal for real request cancellation.
- Consumer must have Tailwind CSS; theming via dark: variant. react, react-dom, @radix-ui/react-dialog, @tabler/icons-react are peer deps.
- Defaults: searchDebounceMs 300, maxResults 50. Depends on @ottabase/ui-shadcn and @ottabase/config via workspace:*.
