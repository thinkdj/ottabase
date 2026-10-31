export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

/** Who may read a file (see the files service in `@ottabase/ottaupload`). */
export type MediaAudience = 'public' | 'members' | 'owner';

/** `ready` is served; `quarantined` is refused by every read path. */
export type MediaStatus = 'ready' | 'quarantined';

export type MediaVariantName = 'thumb' | 'card' | 'full';

/** One WebP rendition made at upload. Its URL is a view field (`thumbnailUrl` is thumb, `previewUrl` card). */
export interface MediaVariant {
    key: string;
    width: number;
    height: number;
    size: number;
}

export interface MediaMetadataJson {
    durationSeconds?: number | null;
    pageCount?: number | null;
    [key: string]: unknown;
}

/**
 * A media row as the API returns it: the stored columns plus the URLs the server computed
 * (`url`, `thumbnailUrl`, `previewUrl`). URLs are never stored, so read them from here.
 */
export interface MediaLibraryItemLike {
    id: string;
    purpose: string;
    audience: MediaAudience;
    storageKey: string;
    url: string;
    thumbnailUrl?: string | null;
    previewUrl?: string | null;
    mimeType: string;
    mediaKind: MediaKind;
    status: MediaStatus;
    originalName: string;
    title?: string | null;
    altText?: string | null;
    caption?: string | null;
    extension?: string | null;
    fileSize: number;
    width?: number | null;
    height?: number | null;
    variants?: Partial<Record<MediaVariantName, MediaVariant>> | null;
    metadata?: MediaMetadataJson | null;
    appId?: string | null;
    organizationId?: string | null;
    userId?: string | null;
    createdAt?: number | string | Date | null;
    updatedAt?: number | string | Date | null;
}

export interface MediaViewerItem {
    id: string;
    url: string;
    thumbnailUrl?: string | null;
    previewUrl?: string | null;
    title?: string | null;
    originalName?: string | null;
    altText?: string | null;
    caption?: string | null;
    mimeType?: string | null;
    mediaKind?: MediaKind;
    fileSize?: number | null;
    width?: number | null;
    height?: number | null;
    createdAt?: number | string | Date | null;
}

export interface MediaSelectionPayload {
    mediaId?: string;
    url: string;
    name: string;
    title?: string | null;
    alt?: string | null;
    caption?: string | null;
    width?: number | null;
    height?: number | null;
    mimeType?: string | null;
    mediaKind?: MediaKind;
    thumbnailUrl?: string | null;
    previewUrl?: string | null;
}

export type MediaLightboxVariant = 'default' | 'immersive';

export type MediaLightboxNavigationDirection = 'previous' | 'next' | 'jump';

export interface MediaLightboxOptions {
    loop?: boolean;
    showMetadata?: boolean;
    variant?: MediaLightboxVariant;
    /** Override the z-index of the lightbox overlay (default: 100). */
    zIndex?: number;
}
