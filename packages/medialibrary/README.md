# @ottabase/medialibrary

Shared media-library primitives for Ottabase apps.

This package provides:

- Media classification and upload-to-record normalization helpers.
- Reusable preview components for images, video, audio, and documents.
- A production-ready lightbox provider with fullscreen viewing, keyboard navigation, and thumbnail strip support.
- Two viewer styles: the default admin/editor viewer and an immersive public-gallery viewer.

> **Note:** The `media` table schema and `Media` model now live in `@ottabase/ottaorm` as a core table. This package
> re-exports them for backward compatibility.

## What Lives Here

- Schema (re-exported from `@ottabase/ottaorm`): `mediaTable`
- Helpers: `createMediaLibraryRecordInput()`, `getMediaKindFromMimeType()`, `toMediaSelectionPayload()`
- Viewer UI: `MediaPreview`, `MediaLightboxProvider`

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
import { MediaLightboxProvider } from '@ottabase/medialibrary';
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
import { ZoomableImage } from '@ottabase/medialibrary';

<ZoomableImage src="/photo.jpg" alt="Description" mode="lightbox" />;
```

- **Scroll wheel** zooms in/out (1×–5×, 0.25× steps)
- **Double-click** toggles 2× zoom
- **Drag to pan** when zoomed in
- Zoom level indicator appears in the bottom-right corner when zoom > 1×
- Zoom and pan reset automatically when `src` changes

## Fullscreen

Both lightbox variants include a fullscreen toggle button. Clicking it calls the browser Fullscreen API
(`requestFullscreen` / `exitFullscreen`). The button icon updates to reflect the current state.

## Download

Both lightbox variants include a download button that links directly to the media URL with the original filename. In the
immersive lightbox, the download button sits in the top-right control bar alongside the fullscreen toggle.

## Touch Gestures

The immersive lightbox supports horizontal swipe gestures for navigation on touch devices. A left swipe advances to the
next item and a right swipe goes to the previous item. Vertical swipes are ignored to avoid conflicts with scrolling.

- **appId consistency:** The media RLS policy filters by `appId`. All upload paths must store the same `appId` that the
  listing/browser UI sends. Use the app's configured `api` client (which injects `X-App-Id` automatically) for uploads
  rather than raw `fetch`/XHR. The server-side `getResolvedMediaSecurityContext` also resolves `appId` from
  `ottabase.config.ts` when the header is absent, so vanilla upload tools (e.g. EditorJS) work without extra wiring.
