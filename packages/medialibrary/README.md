# @ottabase/medialibrary

Shared media-library primitives for Ottabase apps.

This package provides:

- Media classification and upload-to-record normalization helpers.
- Reusable preview components for images, video, audio, and documents.
- A production-ready lightbox provider with fullscreen viewing, keyboard navigation, and thumbnail strip support.
- Two viewer styles: the default admin/editor viewer and an immersive public-gallery viewer.

> **Note:** The `media` table schema and `Media` model now live in `@ottabase/ottaorm` as a core table. This package
> re-exports them for backward compatibility.

## Entry Points

The package is split so that non-UI consumers never pull in rendered React or icon dependencies. All rendered UI lives
behind a single isolated subpath.

| Import                          | Contents                                                                                                                                                                                                                         | Pulls in React / icons? |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `@ottabase/medialibrary`        | **Pure.** mime/kind helpers, upload-to-record normalization, selection/viewer payload mappers, the lightbox **state machine**, the headless `useMediaLightboxUrlSync` hook, and all type-only exports. Imports zero rendered UI. | No (hook is react-only) |
| `@ottabase/medialibrary/schema` | `mediaTable` + `MediaType` / `NewMediaType` (re-exported from `@ottabase/ottaorm`). Schema/migration wiring.                                                                                                                     | No                      |
| `@ottabase/medialibrary/react`  | **Rendered UI.** `MediaLightbox`, `MediaImmersiveLightbox`, `MediaLightboxProvider` (+ `useMediaLightboxRegistration`, `useOptionalMediaLightbox`), `MediaPreview`, `ZoomableImage`.                                             | Yes                     |

Because rendered UI is isolated, `react`, `react-dom`, and `@tabler/icons-react` are **optional** peer dependencies —
callers that only use the pure helpers, schema, or the state machine do not need them installed. The package sets
`"sideEffects": false` for tree-shaking.

### Pure root

```typescript
import {
    getMediaKindFromMimeType, // mime → 'image' | 'video' | 'audio' | 'document'
    createMediaLibraryRecordInput, // upload result → DB record input
    toMediaSelectionPayload, // media → editor picker payload
    createMediaLightboxState, // pure lightbox state machine
    getAdjacentMediaIndex,
    clampMediaIndex,
    useMediaLightboxUrlSync, // headless deep-link hook (react-only, no JSX)
} from '@ottabase/medialibrary';
```

### Rendered UI

```tsx
import {
    MediaLightboxProvider,
    MediaLightbox,
    MediaImmersiveLightbox,
    MediaPreview,
    ZoomableImage,
    useMediaLightboxRegistration,
    useOptionalMediaLightbox,
} from '@ottabase/medialibrary/react';
```

The app still owns the OttaORM `BaseModel` class and route wiring, which keeps the package reusable across multiple
Ottabase apps.

## Basic Usage

```typescript
import { createMediaLibraryRecordInput } from '@ottabase/medialibrary';

const record = createMediaLibraryRecordInput({
    provider: 'r2',
    storageKey: 'uploads/cover.webp',
    url: '/api/upload/file/uploads/cover.webp',
    fileName: 'cover.webp',
    mimeType: 'image/webp',
    fileSize: 248102,
    appId: 'otta-web',
    userId: 'user-123',
});
```

## Wrap Renderer Output

```tsx
import { MediaLightboxProvider } from '@ottabase/medialibrary/react';
import { Blocks, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';

// Admin / editor preview — shows metadata sidebar
export function PostPreview({ content }: { content: any }) {
    return (
        <MediaLightboxProvider>
            <Blocks data={content} renderers={customRenderers} config={defaultEJSRConfigs} />
        </MediaLightboxProvider>
    );
}

// Public blog page — cinematic gallery with auto-hiding controls
export function PostContent({ content }: { content: any }) {
    return (
        <MediaLightboxProvider variant="immersive">
            <Blocks data={content} renderers={customRenderers} config={defaultEJSRConfigs} />
        </MediaLightboxProvider>
    );
}
```

When the renderer's image blocks are inside the provider, they automatically register themselves for:

- fullscreen preview
- previous / next navigation
- keyboard controls (Escape, Arrow keys)
- bottom thumbnail rail
- auto-hiding controls after inactivity (immersive only)
- caption/title overlay (immersive only)

`variant="default"` — rich admin/editor viewer with metadata sidebar, download, and open-in-tab actions.
`variant="immersive"` — cinematic end-user gallery: pure black backdrop, auto-hiding chrome, caption overlay, smooth
thumbnail scrolling.

### Lightbox Lifecycle Hooks

`MediaLightboxProvider` supports lifecycle callbacks:

- `onOpen(item, index)` — fired when the lightbox opens.
- `onNavigate(item, index, direction)` — fired when the active item changes while open (`previous`, `next`, `jump`).
- `onClose()` — fired when the lightbox closes.

```tsx
<MediaLightboxProvider
    onOpen={(item) => console.log('opened', item.id)}
    onNavigate={(item, index, direction) => console.log('navigate', { item, index, direction })}
    onClose={() => console.log('closed')}
>
    <Blocks data={content} renderers={customRenderers} config={defaultEJSRConfigs} />
</MediaLightboxProvider>
```

### Deep-linkable Gallery Items

You can sync lightbox state with the URL query string using `syncWithUrl`:

```tsx
// Uses ?mgi=<registryKey>
<MediaLightboxProvider syncWithUrl>
    <Blocks data={content} renderers={customRenderers} config={defaultEJSRConfigs} />
</MediaLightboxProvider>

// Custom query parameter name
<MediaLightboxProvider syncWithUrl={{ paramName: 'media' }}>
    <Blocks data={content} renderers={customRenderers} config={defaultEJSRConfigs} />
</MediaLightboxProvider>
```

Behavior:

- opening pushes a history entry with the active item key
- next/previous updates replace the existing entry
- back/forward rehydrates the lightbox item or closes when the param is removed

### Lightbox CSS Custom Properties

Lightbox media uses the app's runtime `--radius` theme token for both the media container and the visible image/video,
with a `0.75rem` fallback when no theme stylesheet is present. The immersive lightbox also exposes CSS custom properties
for border-radius customization of its thumbnail UI:

```css
/* Defaults — override in your own CSS to customise */
--lb-strip-radius: 0.75rem; /* thumbnail strip container */
--lb-thumb-radius: 0.5rem; /* individual thumbnail buttons */
```

## Editor Picker Payload

```typescript
import { toMediaSelectionPayload } from '@ottabase/medialibrary';

const payload = toMediaSelectionPayload(mediaItem);
window.dispatchEvent(
    new CustomEvent('media-library-selected-item', {
        detail: {
            media: payload,
            openedVia: 'programmatic',
        },
    }),
);
```

## Notes

- The `media` table is a core OttaORM table (defined in `@ottabase/ottaorm`), designed for RLS-aware apps.
- The package is storage-provider agnostic for callers; the app decides how uploads are persisted.
- The lightbox is intentionally opt-in. Wrap only the content areas where you want gallery behavior.

## ZoomableImage

Scroll-to-zoom image wrapper used inside both lightbox variants for image media.

```tsx
import { ZoomableImage } from '@ottabase/medialibrary/react';

<ZoomableImage src="/photo.jpg" alt="Description" mode="lightbox" />;
```

- **Scroll wheel** zooms in/out (1×–5×, 0.25× steps)
- **Click** toggles 2× zoom by default (`zoomStart="double"` opts into double-click)
- **Pinch-to-zoom** on touch devices
- **Double-tap** toggles 2× zoom on touch devices
- **Drag to pan** when zoomed in
- Zoom level indicator appears in the bottom-right corner when zoom > 1×
- Zoom and pan reset automatically when `src` changes

## Fullscreen

Both lightbox variants include a fullscreen toggle button. Clicking it calls the browser Fullscreen API
(`requestFullscreen` / `exitFullscreen`). The button icon updates to reflect the current state.

## Download

Both lightbox variants include a download button that links directly to the media URL with the original filename. The
download link uses `target="_blank"` and `rel="noopener noreferrer"` so browsers that ignore the `download` attribute
for some remote HTTPS URLs do not navigate away from the app tab. In the immersive lightbox, the download button sits in
the top-right control bar alongside the fullscreen toggle.

## Gallery Gestures

The immersive lightbox supports horizontal drag navigation with both mouse and touch. A left drag advances to the next
item and a right drag goes to the previous item. The active item follows the pointer, resists at the first/last item,
and springs back when released short of the swipe threshold. The neighboring item is visible while dragging, so the
navigation direction is always clear; a committed drag completes into that neighboring item instead of bouncing back
before it changes.

- **Commit:** a drag commits past 90px (or 20% of a narrow slide), or as a fling — at least 36px with a _release_ speed
  of 0.45px/ms, measured over the last ~80ms rather than averaged over the whole gesture.
- **Intent is decided once.** A press becomes a swipe after 8px of mostly-horizontal travel and then tracks the pointer
  however diagonal it gets; a gesture that starts vertical never becomes a swipe; a few pixels of wobble stay a click.
- **Gestures that win over swiping:** pan and pinch on a zoomed image; a pinch from 1× (a second finger abandons the
  swipe and springs it back); a press on a video's native control bar (the bottom 64px), so scrubbing and volume work.
  An embedded PDF captures its own pointer events, so swipe beside it or use the arrows.
- **Wrap-around** needs `loop` (the Provider passes it). Without it there is no neighbor past the first/last item, so a
  drag there only rubber-bands, even if `canGoPrevious` / `canGoNext` allow a button to wrap.

The three slides are DOM slots whose items are derived from the visual index on every render. Buttons, keys, thumbnails
and URL changes swap content in place without moving a slot; a committed drag rotates the slots so the node dragged into
view becomes the active one (its decoded image is kept), with transitions suppressed until the browser has applied the
rotation. During dragging, the offset is applied through a CSS custom property so pointer movement does not trigger a
React render for every event. Neighbors stay mounted and load eagerly, so they are ready before they are swiped in, but
they are `inert` (out of the tab order and the accessibility tree), their videos use `preload="none"`, and a neighboring
PDF shows its placeholder rather than an embedded document. Clicks on the full media surface toggle zoom and never close
the gallery; clicking the backdrop outside that surface closes the lightbox. A click that develops horizontal drag
intent remains navigation, so a drag does not accidentally toggle zoom.

## Reduced Motion

The viewer follows Ottabase's motion setting, so there is nothing to configure in this package. Motion is reduced when
the OS asks for it (`prefers-reduced-motion: reduce`) or when the active brand kit turns on **Disable animations**
(Admin → Brand kit → Motion), which emits `--motion-duration-*: 0s`. Either way, slide and spring-back transitions, the
zoom ease, the counter pulse and smooth thumbnail scrolling become instant. A drag still follows the pointer, because
that is direct manipulation rather than animation. Class-based transitions (`duration-normal` …) already follow the
motion tokens.

## MediaPreview Performance

For non-lightbox image rendering (`tile`, `thumb`, `detail`), `MediaPreview` now:

- uses `loading="lazy"`
- uses `decoding="async"`
- forwards intrinsic `width`/`height` when available to reserve layout space and reduce CLS

## PDF Preview Sandbox

PDF previews are rendered in an iframe with `sandbox="allow-same-origin"`. This keeps previews safer by disabling script
execution and top-level navigation while still allowing same-origin PDF rendering.

- **appId consistency:** The media RLS policy filters by `appId`. All upload paths must store the same `appId` that the
  listing/browser UI sends. Use the app's configured `api` client (which injects `X-App-Id` automatically) for uploads
  rather than raw `fetch`/XHR. The server-side `getResolvedMediaSecurityContext` also resolves `appId` from
  `ottabase.config.ts` when the header is absent, so vanilla upload tools (e.g. EditorJS) work without extra wiring.
