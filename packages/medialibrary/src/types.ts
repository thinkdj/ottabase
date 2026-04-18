export type MediaLibraryProvider = 'r2' | 'cloudflare-images';

export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

export type MediaStatus = 'active' | 'archived';

export interface MediaVariant {
    label?: string;
    url: string;
    width?: number | null;
    height?: number | null;
}

export interface MediaMetadataJson {
    durationSeconds?: number | null;
    pageCount?: number | null;
    [key: string]: unknown;
}

export interface MediaLibraryItemLike {
    id: string;
    provider: MediaLibraryProvider;
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
    isPublic?: boolean;
    variants?: MediaVariant[] | null;
    metadata?: MediaMetadataJson | null;
    appId?: string | null;
    organizationId?: string | null;
    userId?: string | null;
    createdAt?: number | string | Date | null;
    updatedAt?: number | string | Date | null;
    deletedAt?: number | string | Date | null;
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

export interface MediaLightboxOptions {
    loop?: boolean;
    showMetadata?: boolean;
    variant?: MediaLightboxVariant;
}

export interface CreateMediaLibraryRecordInput {
    provider: MediaLibraryProvider;
    storageKey: string;
    url: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    thumbnailUrl?: string | null;
    previewUrl?: string | null;
    width?: number | null;
    height?: number | null;
    isPublic?: boolean;
    variants?: MediaVariant[] | null;
    metadata?: MediaMetadataJson | null;
    appId?: string | null;
    organizationId?: string | null;
    userId?: string | null;
    title?: string | null;
    altText?: string | null;
    caption?: string | null;
    status?: MediaStatus;
}
