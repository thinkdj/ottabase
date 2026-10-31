/**
 * Images in block data are a `FileSource` (`@ottabase/utils/media`): a stored file, whose URLs are
 * built here at render time, or an outside address kept as typed, which still goes through
 * `safeUrl`. Anything else (an object that is not a well-formed `StoredFile`, an unsafe string)
 * renders nothing.
 */
import {
    fileIdFromKey,
    fileUrl,
    imageSources,
    isStoredFile,
    type FileSource,
    type FileVariant,
} from '@ottabase/utils/media';
import { safeUrl } from './inline';

/** `sizes` for each layout, read off styles.css (the host's reading column is at most 48rem). */
export const IMAGE_SIZES = {
    /** A plain image: the figure caps at 34rem */
    image: '(min-width: 34rem) 34rem, 100vw',
    /** The full reading column: featured image, before/after, hotspots, review header */
    column: '(min-width: 48rem) 48rem, 100vw',
    /** A stretched image breaks out of the column */
    bleed: '100vw',
    /** A gallery tile: one column on phones, at most two across the reading column */
    galleryTile: '(min-width: 48rem) 24rem, 100vw',
} as const;

/** The source when it is safe to show: a valid stored file, or a sanitized outside address. */
export function safeSource(value: unknown): FileSource | null {
    if (typeof value === 'string') return safeUrl(value);
    return isStoredFile(value) ? value : null;
}

/** One URL for a source: a rendition for a small slot, the original by default. Empty when unsafe. */
export function imageUrl(value: unknown, variant?: FileVariant): string {
    return fileUrl(safeSource(value), variant);
}

/** A stable identity: the file id for a stored file, the address for an outside one. */
export function sourceId(source: FileSource): string {
    return typeof source === 'string' ? source : (fileIdFromKey(source.key) ?? source.key);
}

/** The URLs a lightbox item needs: the original to zoom, renditions for the strip and the stage. */
export function viewerUrls(source: FileSource) {
    return {
        url: fileUrl(source),
        thumbnailUrl: fileUrl(source, 'thumb'),
        previewUrl: fileUrl(source, 'card'),
        srcSet: imageSources(source).srcSet ?? null,
        width: typeof source === 'string' ? null : (source.width ?? null),
        height: typeof source === 'string' ? null : (source.height ?? null),
    };
}
