# @ottabase/medialibrary — agent notes

Media classification helpers + React lightbox/preview viewer components (schema lives in @ottabase/ottaorm). Full docs: ./README.md

## Use when

- Rendering media previews/lightboxes in React, or classifying media by MIME type/extension.
- Normalizing an upload into a media insert row (`createMediaLibraryRecordInput`).
- NOT for defining/migrating the media table — that is `mediaTable` in @ottabase/ottaorm; this package only re-exports it.

## Imports

```ts
// Helpers: createMediaLibraryRecordInput, getMediaKindFromMimeType, formatMediaFileSize,
// isImageMedia/isVideoMedia/isAudioMedia/isDocumentMedia/isPreviewableMedia,
// toMediaViewerItem, toMediaSelectionPayload
// Viewer: MediaLightboxProvider, MediaLightbox, MediaImmersiveLightbox, MediaPreview,
// ZoomableImage, useMediaLightboxRegistration, useOptionalMediaLightbox, useMediaLightboxUrlSync
// Schema re-exports: mediaTable, type MediaType (canonical home: @ottabase/ottaorm)
import { createMediaLibraryRecordInput, MediaLightboxProvider, MediaPreview, toMediaViewerItem } from '@ottabase/medialibrary';
```

## Canonical usage

```tsx
// Gallery: wrap only the content area that needs lightbox behavior (opt-in).
<MediaLightboxProvider variant="immersive" syncWithUrl>
    <MediaPreview item={toMediaViewerItem(media)} mode="tile" fit="cover" />
</MediaLightboxProvider>
```

```ts
// Upload handler: normalize file info into an insert row for mediaTable.
const row = createMediaLibraryRecordInput({ provider, storageKey, url, fileName, mimeType, fileSize, appId, organizationId, userId });
```

## Gotchas

- `mediaLibraryItemsTable` / `MediaLibraryItemRecord` (also via `@ottabase/medialibrary/schema`) are deprecated aliases of `mediaTable` / `MediaType`.
- Media RLS filters by appId — uploads must set the same `appId` the listing UI queries with (RLS context mandatory).
- `react`, `react-dom`, `drizzle-orm`, `@ottabase/ottaorm` are peerDependencies (`workspace:*` / `catalog:`); consumers must provide them.
- `MediaLightboxProvider` items register via `useMediaLightboxRegistration(key, item)`; `useOptionalMediaLightbox()` returns null outside a provider.
