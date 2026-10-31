// ============================================================
// @ottabase/utils/media: addressing stored files
// ============================================================
// Content never keeps a stored file's URL. It keeps a `StoredFile`: the original's key in the
// public files bucket, its size and the renditions the files service made of it. URLs are built
// here, at render time, from the public files base, so moving the bucket to a custom domain
// is one setting and every page follows.
//
// Keys are `<appId>/<purpose>/<id>.<ext>`; a rendition sits beside it as
// `<appId>/<purpose>/<id>/<variant>.webp`. `@ottabase/ottaupload` writes both.
// ============================================================

export type FileVariant = 'thumb' | 'card' | 'full';

/** Rendition widths. A rendition is made only when it is narrower than the original. */
export const FILE_VARIANT_WIDTHS: Readonly<Record<FileVariant, number>> = { thumb: 160, card: 640, full: 1600 };

const VARIANTS_BY_WIDTH: readonly FileVariant[] = ['thumb', 'card', 'full'];

// indexOf, not includes: packages compile this source against the root tsconfig's ES6 lib.
const has = (list: readonly unknown[] | undefined, item: unknown): boolean => !!list && list.indexOf(item) !== -1;

/** Where public files are served when no base is configured: the Worker's own fallback route. */
export const DEFAULT_PUBLIC_FILES_URL = '/api/files/public';

/** A public stored file as content keeps it. Never a URL. */
export interface StoredFile {
    /** The original's key in the public files bucket. */
    key: string;
    width?: number;
    height?: number;
    /** The renditions that exist. Absent or empty: only the original. */
    variants?: FileVariant[];
}

/** An image or file in content: a stored file, or an outside address kept as typed. */
export type FileSource = StoredFile | string;

/** `<appId>/<purpose>/<32 hex id>.<ext>`: what the files service writes for an original. */
const STORED_KEY_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]*\/[A-Za-z0-9_-][A-Za-z0-9._-]*\/[0-9a-f]{32}\.[a-z0-9]+$/;

let publicBase = DEFAULT_PUBLIC_FILES_URL;

/**
 * Set the public files base (`R2_PUBLIC_URL`, or the app's absolute fallback) once per runtime:
 * the Worker per request, the browser at boot before the first render, an SSR host on both
 * sides with the same value so hydration agrees.
 */
export function configureMedia(options: { publicUrl?: string | null }): void {
    publicBase = (options.publicUrl || DEFAULT_PUBLIC_FILES_URL).replace(/\/+$/, '');
}

/** The configured public files base, without a trailing slash. */
export function mediaBase(): string {
    return publicBase;
}

/** The key of one rendition of an original: `<stem>/<variant>.webp`. */
export function variantKey(key: string, variant: FileVariant): string {
    return `${key.replace(/\.[a-z0-9]+$/, '')}/${variant}.webp`;
}

/** The file id inside an original's or a rendition's key, or null. */
export function fileIdFromKey(key: string): string | null {
    return /\/([0-9a-f]{32})(?:\.[a-z0-9]+|\/(?:thumb|card|full)\.webp)$/.exec(key)?.[1] ?? null;
}

/** A well-formed `StoredFile`: a stored original's key, numeric sizes, known variants. */
export function isStoredFile(value: unknown): value is StoredFile {
    if (!value || typeof value !== 'object') return false;
    const file = value as Record<string, unknown>;
    if (typeof file.key !== 'string' || !STORED_KEY_RE.test(file.key)) return false;
    for (const size of [file.width, file.height]) {
        if (size !== undefined && !(typeof size === 'number' && Number.isInteger(size) && size > 0)) return false;
    }
    if (file.variants === undefined) return true;
    return Array.isArray(file.variants) && file.variants.every((variant) => has(VARIANTS_BY_WIDTH, variant));
}

/**
 * The `StoredFile` for a files-service record (an upload response, a media library item), or
 * null for a private file, which content cannot embed: it is served by id, after a check.
 */
export function storedFileOf(record: {
    storageKey: string;
    audience?: string;
    width?: number | null;
    height?: number | null;
    variants?: Partial<Record<FileVariant, unknown>> | null;
}): StoredFile | null {
    if (record.audience && record.audience !== 'public') return null;
    const variants = VARIANTS_BY_WIDTH.filter((variant) => record.variants?.[variant]);
    return {
        key: record.storageKey,
        ...(record.width ? { width: record.width } : {}),
        ...(record.height ? { height: record.height } : {}),
        ...(variants.length ? { variants } : {}),
    };
}

/** A key's public URL. `base` overrides the configured one (a server holding its own). */
export function publicFileUrl(key: string, base: string = publicBase): string {
    return `${base}/${key}`;
}

/**
 * The URL of a source: an outside address as it is, a stored file's original, or one of its
 * renditions (the original when that rendition was not made). Empty for nothing.
 */
export function fileUrl(source: FileSource | null | undefined, variant?: FileVariant, base?: string): string {
    if (!source) return '';
    if (typeof source === 'string') return source;
    if (variant && has(source.variants, variant)) return publicFileUrl(variantKey(source.key, variant), base);
    return publicFileUrl(source.key, base);
}

export interface ImageSources {
    src: string;
    /** Width descriptors for the browser to choose from; absent when there is only one file. */
    srcSet?: string;
    width?: number;
    height?: number;
}

/**
 * What an `<img>` needs for a source. A stored file offers its renditions up to `full` and its
 * original only when no `full` was made (the original is then at most 1600px; above that it is
 * the unoptimised upload, kept for downloads and zoom, not for pages). `src` is the largest
 * offered. An outside address is a lone `src`. Pair `srcSet` with a `sizes` that fits the layout.
 */
export function imageSources(source: FileSource | null | undefined, base?: string): ImageSources {
    if (!source) return { src: '' };
    if (typeof source === 'string') return { src: source };
    const made = VARIANTS_BY_WIDTH.filter((variant) => has(source.variants, variant));
    const candidates = made.map((variant) => ({
        url: publicFileUrl(variantKey(source.key, variant), base),
        width: FILE_VARIANT_WIDTHS[variant],
    }));
    const original = publicFileUrl(source.key, base);
    if (!has(made, 'full') && source.width) candidates.push({ url: original, width: source.width });
    const src = candidates.length ? candidates[candidates.length - 1].url : original;
    const size = { width: source.width, height: source.height };
    if (candidates.length < 2) return { src, ...size };
    return { src, srcSet: candidates.map((c) => `${c.url} ${c.width}w`).join(', '), ...size };
}
