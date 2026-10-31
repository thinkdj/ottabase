import type { FileVariant, StoredFile } from '@ottabase/utils/media';

export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

/** Who may read a file (see the files service in `@ottabase/ottaupload`). */
export type MediaAudience = 'public' | 'members' | 'owner';

/** `ready` is served; `quarantined` is refused by every read path. */
export type MediaStatus = 'ready' | 'quarantined';

export type MediaVariantName = FileVariant;

/**
 * One WebP rendition made at upload. Its URL is a view field (`thumbnailUrl` is thumb, `previewUrl`
 * card, all of them in `srcSet`).
 */
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
 * (`url`, `thumbnailUrl`, `previewUrl`, `srcSet`). URLs are never stored: content keeps the
 * `StoredFile` (`file` on a selection) and builds its own with `@ottabase/utils/media`.
 */
export interface MediaLibraryItemLike {
    id: string;
    purpose: string;
    audience: MediaAudience;
    storageKey: string;
    url: string;
    thumbnailUrl?: string | null;
    previewUrl?: string | null;
    srcSet?: string | null;
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
    /** The original: what the lightbox shows when there is no `srcSet` to choose from. */
    url: string;
    thumbnailUrl?: string | null;
    previewUrl?: string | null;
    /** Width descriptors over the renditions (see `imageSources` in `@ottabase/utils/media`). */
    srcSet?: string | null;
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
    /** What content stores for a picked public file. Null for a private one, which content cannot embed. */
    file: StoredFile | null;
    /** For showing the pick in the picker or editor, never for storing. */
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
