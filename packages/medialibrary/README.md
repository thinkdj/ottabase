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

The immersive lightbox exposes CSS custom properties for border-radius customization:

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
- **Double-click** toggles 2× zoom
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

## Touch Gestures

The immersive lightbox supports horizontal swipe gestures for navigation on touch devices. A left swipe advances to the
next item and a right swipe goes to the previous item. Vertical swipes are ignored to avoid conflicts with scrolling.

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
