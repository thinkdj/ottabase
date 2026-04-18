import type {
    CreateMediaLibraryRecordInput,
    MediaKind,
    MediaLibraryItemLike,
    MediaSelectionPayload,
    MediaViewerItem,
} from './types';

const IMAGE_PREFIX = 'image/';
const VIDEO_PREFIX = 'video/';
const AUDIO_PREFIX = 'audio/';

const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'rtf']);
const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz']);

export function getFileExtension(fileName?: string | null): string | null {
    if (!fileName) {
        return null;
    }

    const parts = fileName.split('.');
    if (parts.length < 2) {
        return null;
    }

    return parts.at(-1)?.toLowerCase() ?? null;
}

export function getMediaKindFromMimeType(mimeType?: string | null, fileName?: string | null): MediaKind {
    const normalizedMimeType = (mimeType || '').toLowerCase();
    const extension = getFileExtension(fileName);

    if (normalizedMimeType.startsWith(IMAGE_PREFIX)) {
        return 'image';
    }

    if (normalizedMimeType.startsWith(VIDEO_PREFIX)) {
        return 'video';
    }

    if (normalizedMimeType.startsWith(AUDIO_PREFIX)) {
        return 'audio';
    }

    if (normalizedMimeType === 'application/pdf' || normalizedMimeType.startsWith('text/')) {
        return 'document';
    }

    if (extension && DOCUMENT_EXTENSIONS.has(extension)) {
        return 'document';
    }

    if (
        normalizedMimeType.includes('zip') ||
        normalizedMimeType.includes('archive') ||
        normalizedMimeType.includes('compressed')
    ) {
        return 'archive';
    }

    if (extension && ARCHIVE_EXTENSIONS.has(extension)) {
        return 'archive';
    }

    return 'other';
}

export function isImageMedia(media: Pick<MediaLibraryItemLike, 'mediaKind' | 'mimeType' | 'originalName'>): boolean {
    return getMediaKindFromMimeType(media.mimeType, media.originalName) === 'image' || media.mediaKind === 'image';
}

export function isVideoMedia(media: Pick<MediaLibraryItemLike, 'mediaKind' | 'mimeType' | 'originalName'>): boolean {
    return getMediaKindFromMimeType(media.mimeType, media.originalName) === 'video' || media.mediaKind === 'video';
}

export function isAudioMedia(media: Pick<MediaLibraryItemLike, 'mediaKind' | 'mimeType' | 'originalName'>): boolean {
    return getMediaKindFromMimeType(media.mimeType, media.originalName) === 'audio' || media.mediaKind === 'audio';
}

export function isDocumentMedia(media: Pick<MediaLibraryItemLike, 'mediaKind' | 'mimeType' | 'originalName'>): boolean {
    return (
        getMediaKindFromMimeType(media.mimeType, media.originalName) === 'document' || media.mediaKind === 'document'
    );
}

export function isPreviewableMedia(
    media: Pick<MediaLibraryItemLike, 'mediaKind' | 'mimeType' | 'originalName'>,
): boolean {
    const mediaKind = getMediaKindFromMimeType(media.mimeType, media.originalName);
    return mediaKind === 'image' || mediaKind === 'video' || mediaKind === 'audio' || mediaKind === 'document';
}

export function getMediaDisplayTitle(
    media: Pick<MediaLibraryItemLike, 'title' | 'originalName' | 'storageKey'>,
): string {
    return media.title?.trim() || media.originalName || media.storageKey;
}

export function formatMediaFileSize(bytes?: number | null): string {
    if (!bytes || bytes <= 0) {
        return '0 B';
    }

    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let index = 0;

    while (size >= 1024 && index < sizes.length - 1) {
        size /= 1024;
        index += 1;
    }

    return `${size >= 10 || index === 0 ? Math.round(size) : size.toFixed(1)} ${sizes[index]}`;
}

export function createMediaLibraryRecordInput(input: CreateMediaLibraryRecordInput) {
    const extension = getFileExtension(input.fileName);
    const mediaKind = getMediaKindFromMimeType(input.mimeType, input.fileName);
    const title = input.title?.trim() || input.fileName;

    return {
        provider: input.provider,
        storageKey: input.storageKey,
        url: input.url,
        thumbnailUrl: input.thumbnailUrl ?? input.url,
        previewUrl: input.previewUrl ?? input.url,
        mimeType: input.mimeType || 'application/octet-stream',
        mediaKind,
        status: input.status ?? 'active',
        originalName: input.fileName,
        title,
        altText: input.altText ?? null,
        caption: input.caption ?? null,
        extension,
        fileSize: input.fileSize,
        width: input.width ?? null,
        height: input.height ?? null,
        isPublic: input.isPublic ?? false,
        variants: input.variants ?? null,
        metadata: input.metadata ?? null,
        appId: input.appId ?? null,
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
    };
}

export function toMediaViewerItem(media: Partial<MediaLibraryItemLike>): MediaViewerItem {
    return {
        id: media.id || media.storageKey || media.url || crypto.randomUUID(),
        url: media.url || '',
        thumbnailUrl: media.thumbnailUrl ?? media.url ?? null,
        previewUrl: media.previewUrl ?? media.url ?? null,
        title: media.title ?? null,
        originalName: media.originalName ?? null,
        altText: media.altText ?? null,
        caption: media.caption ?? null,
        mimeType: media.mimeType ?? null,
        mediaKind: media.mediaKind ?? getMediaKindFromMimeType(media.mimeType, media.originalName),
        fileSize: media.fileSize ?? null,
        width: media.width ?? null,
        height: media.height ?? null,
        createdAt: media.createdAt ?? null,
    };
}

export function toMediaSelectionPayload(media: Partial<MediaLibraryItemLike>): MediaSelectionPayload {
    const title = getMediaDisplayTitle({
        title: media.title ?? null,
        originalName: media.originalName ?? media.url ?? '',
        storageKey: media.storageKey ?? media.url ?? '',
    });

    return {
        mediaId: media.id,
        url: media.url || '',
        name: media.originalName || title,
        title: media.title ?? title,
        alt: media.altText ?? null,
        caption: media.caption ?? null,
        width: media.width ?? null,
        height: media.height ?? null,
        mimeType: media.mimeType ?? null,
        mediaKind: media.mediaKind ?? getMediaKindFromMimeType(media.mimeType, media.originalName),
        thumbnailUrl: media.thumbnailUrl ?? media.url ?? null,
        previewUrl: media.previewUrl ?? media.url ?? null,
    };
}
