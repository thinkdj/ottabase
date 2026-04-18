export { mediaLibraryItemsTable, mediaTable } from './schema';
export type { MediaLibraryItemRecord, MediaType, NewMediaLibraryItemRecord, NewMediaType } from './schema';

export type {
    CreateMediaLibraryRecordInput,
    MediaKind,
    MediaLibraryItemLike,
    MediaLibraryProvider,
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

export { clampMediaIndex, createMediaLightboxState, getAdjacentMediaIndex } from './viewer/lightbox-state';
export { MediaImmersiveLightbox } from './viewer/MediaImmersiveLightbox';
export { MediaLightbox } from './viewer/MediaLightbox';
export {
    MediaLightboxProvider,
    useMediaLightboxRegistration,
    useOptionalMediaLightbox,
} from './viewer/MediaLightboxProvider';
export { MediaPreview } from './viewer/MediaPreview';
export { ZoomableImage } from './viewer/ZoomableImage';
