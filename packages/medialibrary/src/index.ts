export { mediaTable } from './schema';
export type { MediaType, NewMediaType } from './schema';

export type {
    CreateMediaLibraryRecordInput,
    MediaKind,
    MediaLibraryItemLike,
    MediaLibraryProvider,
    MediaLightboxNavigationDirection,
    MediaLightboxOptions,
    MediaLightboxVariant,
    MediaMetadataJson,
    MediaSelectionPayload,
    MediaStatus,
    MediaVariant,
    MediaViewerItem,
} from './types';

export {
    createMediaLibraryRecordInput,
    formatMediaFileSize,
    getFileExtension,
    getMediaDisplayTitle,
    getMediaKindFromMimeType,
    isAudioMedia,
    isDocumentMedia,
    isImageMedia,
    isPreviewableMedia,
    isVideoMedia,
    toMediaSelectionPayload,
    toMediaViewerItem,
} from './utils';

// Pure lightbox state machine (no React, no JSX, no icons).
export { clampMediaIndex, createMediaLightboxState, getAdjacentMediaIndex } from './viewer/lightbox-state';

// Headless URL-sync hook — react-only, no rendered UI. Stays on the pure root.
// The rendered viewer surface (MediaLightbox, MediaPreview, ZoomableImage, the
// provider, and its registration hooks) lives at `@ottabase/medialibrary/react`.
export { useMediaLightboxUrlSync } from './viewer/useMediaLightboxUrlSync';
export type { MediaLightboxUrlSyncOptions } from './viewer/useMediaLightboxUrlSync';
