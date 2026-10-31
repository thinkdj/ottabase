export type {
    MediaAudience,
    MediaKind,
    MediaLibraryItemLike,
    MediaLightboxNavigationDirection,
    MediaLightboxOptions,
    MediaLightboxVariant,
    MediaMetadataJson,
    MediaSelectionPayload,
    MediaStatus,
    MediaVariant,
    MediaVariantName,
    MediaViewerItem,
} from './types';

export {
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

// Everything browser-bound — the rendered viewer AND the URL-sync hook, which reads `window` —
// lives at `@ottabase/medialibrary/react`. This root imports neither React nor DOM globals, so
// Workers and other non-browser callers can use it.
