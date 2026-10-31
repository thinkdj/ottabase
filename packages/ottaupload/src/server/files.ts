// ============================================================
// @ottabase/ottaupload: the files service
// ============================================================
// Every user file an app stores goes through one object: avatars, the media library, brand
// assets, landing share images, any package's own purpose. It owns the whole path:
//
//   put:  purpose → quota → byte cap while reading → sniff the real type → allow-list →
//         strip metadata (raster) → write to the audience's bucket → variants → row
//   read: row → audience check (or a signed token) → stream with Range/ETag, or a 302 for
//         public files, which live on the public bucket's own URL
//
// Audiences decide the bucket. `public` files sit in the public bucket, where every object is
// public by definition and is served by key (`/api/files/public/<key>` or the bucket's custom
// domain). `members` and `owner` files sit in the private bucket, which is never served by key:
// only `/api/files/:id` reads it, after checking who is asking.
//
// Keys are `<appId>/<purpose>/<id>.<ext>`, the id 32 hex chars of a random UUID (the media row
// has the same id), the extension the sniffed type's. Variants are `<appId>/<purpose>/<id>/<variant>.webp`.
// A key is never written twice: replacing a file is a new key and a delete of the old one.
// ============================================================

import { RASTER_IMAGE_TYPES, imageSize, sniff } from './sniff';
import { stripMetadata } from './strip';
import {
    FilesError,
    type FileEdit,
    type FileOwner,
    type FilePurpose,
    type FileRecord,
    type FileStore,
    type FileVariant,
    type FileVariantInfo,
    type FileView,
    type FileViewer,
    type FilesBucket,
    type FilesObject,
    type ImagesBindingLike,
} from '../types';

/** Where public files are served when `R2_PUBLIC_URL` is unset: the Worker's own fallback route. */
export const DEFAULT_PUBLIC_FILES_URL = '/api/files/public';
/** The route that serves files by id (private ones, and redirects for public ones). */
export const FILES_ROUTE = '/api/files';
export const FILE_VARIANT_WIDTHS: Record<FileVariant, number> = { thumb: 160, card: 640, full: 1600 };
export const PUBLIC_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const PRIVATE_CACHE_CONTROL = 'private, no-store';
const DEFAULT_QUOTA_MB = 1024;
const SIGNED_URL_TTL_SECONDS = 3600;
const VARIANT_QUALITY = 82;

/**
 * Types a browser may render in place: raster images and video. Everything else downloads, PDF
 * included: browsers' PDF viewers do not run under `Content-Security-Policy: sandbox`, and a
 * document rendered inline with the sandbox relaxed is exactly the combination to avoid.
 */
const INLINE_TYPES = new Set([...RASTER_IMAGE_TYPES, 'video/mp4', 'video/webm']);

/**
 * Raster formats whose metadata the code cannot strip (AVIF keeps Exif/XMP in ISO-BMFF item
 * boxes). With the Images binding they are re-encoded to WebP, which never carries metadata,
 * and that WebP is the stored original; without it they are refused. An unstripped original is
 * never stored.
 */
const REENCODED_TYPES = new Set(['image/avif']);
const REENCODE_QUALITY = 90;

// ─── Keys ───────────────────────────────────────────────────────────────────

/** A new file id: 32 hex chars from `crypto.randomUUID()`. */
export const newFileId = (): string => crypto.randomUUID().replace(/-/g, '');

export const fileKey = (appId: string, purpose: string, id: string, ext: string): string =>
    `${appId}/${purpose}/${id}.${ext}`;

export const variantKey = (appId: string, purpose: string, id: string, variant: FileVariant): string =>
    `${appId}/${purpose}/${id}/${variant}.webp`;

const KEY_ID_RE = /\/([0-9a-f]{32})(?:\.[a-z0-9]+|\/(?:thumb|card|full)\.webp)$/;

/** The file id inside a storage key (an original's or a variant's), or null. */
export function fileIdFromKey(key: string): string | null {
    return KEY_ID_RE.exec(key)?.[1] ?? null;
}

/** A key that is safe to look up: plain segments, no traversal, no empty parts. */
const SAFE_KEY_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;

// ─── Signed tokens ──────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
    try {
        const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
        return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    } catch {
        return null;
    }
}

const hmacKey = (secret: string) =>
    crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
        'verify',
    ]);

// Purpose-bound: the signed message names what the token is for, so a signature minted for
// anything else under the same secret can never open a file.
const tokenMessage = (id: string, exp: number) => encoder.encode(JSON.stringify(['files.read', id, exp]));

/** `<exp>.<signature>` granting a read of file `id` until `exp` (epoch seconds). */
export async function signFileToken(secret: string, id: string, exp: number): Promise<string> {
    const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), tokenMessage(id, exp));
    return `${exp}.${base64Url(new Uint8Array(signature))}`;
}

/** True when `token` was minted for file `id` with `secret` and has not expired. Constant-time. */
export async function verifyFileToken(secret: string, id: string, token: string, now = Date.now()): Promise<boolean> {
    const dot = token.indexOf('.');
    const exp = Number(token.slice(0, dot));
    if (dot <= 0 || !Number.isSafeInteger(exp) || exp * 1000 <= now) return false;
    const signature = fromBase64Url(token.slice(dot + 1));
    if (!signature) return false;
    return crypto.subtle.verify('HMAC', await hmacKey(secret), signature, tokenMessage(id, exp));
}

// ─── Serving ────────────────────────────────────────────────────────────────

function safeDownloadName(name: string): string {
    return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180) || 'download';
}

/** `inline` for what a browser renders safely in place, `attachment` for everything else. */
export function dispositionFor(mime: string): 'inline' | 'attachment' {
    return INLINE_TYPES.has(mime.split(';', 1)[0]!.trim().toLowerCase()) ? 'inline' : 'attachment';
}

/**
 * Headers that make serving user files safe: no MIME sniffing, a sandboxing CSP (an uploaded
 * SVG or HTML file cannot run script on this origin), and only known-safe types shown inline.
 * A custom domain on the public bucket needs the same two headers from a zone Transform Rule.
 */
export function applySafeObjectHeaders(headers: Headers, filename: string): void {
    const contentType = headers.get('Content-Type') || 'application/octet-stream';
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Security-Policy', "sandbox; default-src 'none'");
    headers.set('Content-Disposition', `${dispositionFor(contentType)}; filename="${safeDownloadName(filename)}"`);
}

/**
 * Stream one object with conditional and range support: `onlyIf` answers If-None-Match and
 * If-Modified-Since (304 without a body), `range` answers Range (206 with Content-Range).
 */
async function streamObject(
    bucket: FilesBucket,
    request: Request,
    key: string,
    options: { cacheControl: string; filename: string },
): Promise<Response | null> {
    let object: FilesObject | null;
    try {
        object = await bucket.get(key, { onlyIf: request.headers, range: request.headers });
    } catch {
        // R2 rejects a range past the end of the object.
        if (request.headers.has('range')) return new Response(null, { status: 416 });
        throw new Error(`R2 read failed for ${key}`);
    }
    if (!object) return null;

    const headers = new Headers();
    object.writeHttpMetadata(headers as never);
    headers.set('ETag', object.httpEtag);
    headers.set('Last-Modified', new Date(object.uploaded).toUTCString());
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', options.cacheControl);
    applySafeObjectHeaders(headers, options.filename);

    // A failed precondition comes back without a body.
    if (!('body' in object) || !object.body) {
        const conditional = request.headers.has('if-none-match') || request.headers.has('if-modified-since');
        return new Response(null, { status: conditional ? 304 : 412, headers });
    }

    let status = 200;
    const range = object.range as { offset?: number; length?: number; suffix?: number } | undefined;
    if (range && request.headers.has('range')) {
        const length =
            range.suffix !== undefined
                ? Math.min(range.suffix, object.size)
                : (range.length ?? object.size - (range.offset ?? 0));
        const offset = range.suffix !== undefined ? object.size - length : (range.offset ?? 0);
        headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
        headers.set('Content-Length', String(length));
        status = 206;
    } else {
        headers.set('Content-Length', String(object.size));
    }
    if (request.method === 'HEAD') {
        await (object.body as ReadableStream).cancel?.().catch(() => undefined);
        return new Response(null, { status, headers });
    }
    return new Response(object.body as BodyInit, { status, headers });
}

/**
 * Serve one key of the PUBLIC bucket: what `GET|HEAD /api/files/public/*` and a landing site
 * answer. Everything in that bucket is public, so nothing is checked but the key's shape.
 * Null when the key is malformed or absent.
 */
export async function servePublicFile(bucket: FilesBucket, request: Request, key: string): Promise<Response | null> {
    if (!SAFE_KEY_RE.test(key) || key.includes('..')) return null;
    return streamObject(bucket, request, key, {
        cacheControl: PUBLIC_CACHE_CONTROL,
        filename: key.split('/').pop() || 'download',
    });
}

// ─── Authorization ──────────────────────────────────────────────────────────

/** Administers the file's organization, or the whole platform. */
function administers(record: FileRecord, viewer: FileViewer): boolean {
    return viewer.platformAdmin || (viewer.admin && viewer.organizationId === record.organizationId);
}

/** May `viewer` read `record` (without a token)? */
export function canReadFile(record: FileRecord, viewer: FileViewer | null): boolean {
    if (record.audience === 'public') return true;
    if (!viewer) return false;
    if (viewer.userId === record.userId || administers(record, viewer)) return true;
    // Members: the file's organization is the viewer's. A file uploaded outside any organization
    // has no members but its uploader.
    return (
        record.audience === 'members' &&
        record.organizationId !== null &&
        viewer.organizationId === record.organizationId
    );
}

/** May `viewer` edit or delete `record`? The uploader and admins. */
export function canChangeFile(record: FileRecord, viewer: FileViewer | null): boolean {
    return Boolean(viewer && (viewer.userId === record.userId || administers(record, viewer)));
}

/** May `viewer` quarantine or restore `record`? Admins of its organization and platform admins only. */
export function canModerateFile(record: FileRecord, viewer: FileViewer | null): boolean {
    return Boolean(viewer && administers(record, viewer));
}

// ─── The service ────────────────────────────────────────────────────────────

/** `FILES_QUOTA_MB` (or any MB value) in bytes; an unset or invalid value is the 1024 MB default. */
export function quotaBytes(mb: unknown, fallbackMb = DEFAULT_QUOTA_MB): number {
    const parsed = Number(mb);
    return (Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMb) * 1024 * 1024;
}

type Awaitable<T> = T | Promise<T>;

export interface FilesOptions<Env> {
    /** The app id rows and keys belong to (server configuration, never the request). */
    appId: (env: Env) => string;
    /** Every declared purpose: the kernel registry's `files()`. */
    purposes: (env: Env) => FilePurpose[];
    store: FileStore;
    /** `public`: the bucket served by key. `private`: members/owner files, never served by key. */
    buckets: (env: Env) => { public?: FilesBucket | null; private?: FilesBucket | null };
    /** The Images binding. Without it no variants are made and every URL is the original's. */
    images?: (env: Env) => ImagesBindingLike | null | undefined;
    /** Base URL of the public bucket (`R2_PUBLIC_URL`). Default `/api/files/public`. */
    publicUrl?: (env: Env) => string | null | undefined;
    /**
     * The app's public origin (otta-web: `AUTH_URL`). A relative `publicUrl` and signed URLs are
     * resolved against it, so every URL the service hands out works where the page is not: in
     * mail, social cards, exports. Unset: those URLs stay relative to whatever origin serves them.
     */
    origin?: (env: Env) => string | null | undefined;
    /** Signs `?t=` read tokens (`FILES_SIGNING_SECRET`). Unset: tokens are neither minted nor accepted. */
    signingSecret?: (env: Env) => string | null | undefined;
    /** Bytes the owner may store in total; null for no limit. Default 1024 MB (see `quotaBytes`). */
    quota?: (env: Env, owner: FileOwner) => Awaitable<number | null>;
    /**
     * Purge absolute public URLs from the CDN cache (a quarantined file's). Resolves false when
     * purging is not configured or failed: the caller must then purge them by hand, because
     * public files are cached as immutable for a year.
     */
    purge?: (env: Env, urls: string[]) => Promise<boolean>;
}

/** What quarantining did: the file, and whether its public URLs left the CDN cache. */
export interface QuarantineResult {
    file: FileView;
    /** `purged`: gone from the cache. `manual`: purge `urls` by hand. `none`: nothing was public. */
    purge: 'purged' | 'manual' | 'none';
    /** The absolute public URLs the file was served at (original and variants). */
    urls: string[];
}

export interface PutFileInput {
    purpose: string;
    owner: FileOwner;
    /** The bytes: a File from `request.formData()`, a Blob, a buffer or a stream. */
    file: Blob | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>;
    /** The original filename, kept only in the row. Default: the File's own name. */
    name?: string;
    title?: string | null;
    altText?: string | null;
    caption?: string | null;
    metadata?: Record<string, unknown> | null;
}

export interface ReadFileInput {
    id: string;
    variant?: string | null;
    viewer: FileViewer | null;
    /** The `?t=` query value, when present. */
    token?: string | null;
}

export interface Files<Env> {
    /** Every declared purpose. */
    purposes(env: Env): FilePurpose[];
    /** The declared purpose, or null. */
    purpose(env: Env, name: string): FilePurpose | null;
    /** Store a file. Throws `FilesError` (400/413/415/503) when it is refused. */
    put(env: Env, input: PutFileInput): Promise<FileView>;
    get(env: Env, id: string): Promise<FileRecord | null>;
    /** A record with its URLs. */
    view(env: Env, record: FileRecord): FileView;
    /** The base every public URL starts with: absolute when `origin` is configured. */
    publicBase(env: Env): string;
    /** The public URL of a public bucket key (an avatar, a brand logo). */
    url(env: Env, key: string): string;
    /** The public bucket key behind one of this app's public URLs, or null for anything else. */
    keyOf(env: Env, url: string): string | null;
    /** `/api/files/<id>[/<variant>]?t=…`, readable without a session until it expires. Throws without a secret. */
    signedUrl(env: Env, id: string, options?: { variant?: FileVariant; ttlSeconds?: number }): Promise<string>;
    /** Serve a file by id to `viewer`: a 302 for public files, the bytes for allowed private ones. */
    read(env: Env, request: Request, input: ReadFileInput): Promise<Response>;
    /** Serve a key of the public bucket (the `/api/files/public/*` route). */
    servePublic(env: Env, request: Request, key: string): Promise<Response>;
    /** Change the title, alt text or caption. */
    update(env: Env, id: string, fields: FileEdit): Promise<FileView | null>;
    /** Delete the file, its variants and its row. False when there was no such file. */
    remove(env: Env, id: string): Promise<boolean>;
    /** Delete every file `userId` uploaded in the app (an account erase). Returns how many. */
    removeOwned(env: Env, owner: { appId: string; userId: string }): Promise<number>;
    /**
     * Stop serving a file. A public one's objects (original and variants) move to the private
     * bucket under the same keys, so neither the Worker route nor a custom domain has them, and
     * its URLs are purged from the cache when `purge` is configured. Every read path refuses it.
     * `origin` resolves a relative public URL base into the absolute URLs a purge needs.
     */
    quarantine(env: Env, id: string, options?: { origin?: string }): Promise<QuarantineResult | null>;
    /** Serve a quarantined file again: its objects move back, its status is `ready`. */
    restore(env: Env, id: string): Promise<FileView | null>;
}

const notFound = () => new FilesError(404, 'NOT_FOUND', 'File not found');

function mediaKindOf(mime: string): string {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime === 'application/pdf' || mime.startsWith('text/')) return 'document';
    return 'other';
}

function concat(parts: Uint8Array[], total: number): Uint8Array {
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.byteLength;
    }
    return out;
}

/** Read the whole input, refusing it the moment it passes `max` bytes. */
async function readCapped(file: PutFileInput['file'], max: number): Promise<Uint8Array> {
    const tooLarge = () =>
        new FilesError(413, 'PAYLOAD_TOO_LARGE', `The file is larger than ${Math.floor(max / 1048576) || 1} MB`);
    if (file instanceof Uint8Array || file instanceof ArrayBuffer) {
        const bytes = file instanceof Uint8Array ? file : new Uint8Array(file);
        if (bytes.byteLength > max) throw tooLarge();
        return bytes;
    }
    if ('size' in file && file.size > max) throw tooLarge();
    const reader = ('getReader' in file ? file : file.stream()).getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > max) {
            await reader.cancel().catch(() => undefined);
            throw tooLarge();
        }
        parts.push(value);
    }
    return concat(parts, total);
}

/** A sniffed type is allowed when the purpose lists it, or its family (`image/*`). */
function allows(purpose: FilePurpose, mime: string): boolean {
    if (mime === 'image/svg+xml' && !purpose.svg) return false;
    return purpose.types.some((type) => type === mime || (type.endsWith('/*') && mime.startsWith(type.slice(0, -1))));
}

const editText = (value: unknown, max: number): string | null =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

export function createFiles<Env>(options: FilesOptions<Env>): Files<Env> {
    /** The app's origin, when configured and parseable: `https://app.example.com`. */
    const originOf = (env: Env): string | null => {
        const value = options.origin?.(env);
        if (!value) return null;
        try {
            return new URL(value).origin;
        } catch {
            return null;
        }
    };
    /** Absolute against the app origin when the value is relative and an origin is known. */
    const absolute = (env: Env, url: string): string => {
        const origin = originOf(env);
        return origin && url.startsWith('/') && !url.startsWith('//') ? `${origin}${url}` : url;
    };
    const publicBase = (env: Env) =>
        absolute(env, (options.publicUrl?.(env) || DEFAULT_PUBLIC_FILES_URL).replace(/\/+$/, ''));

    const purposeOf = (env: Env, name: string) => options.purposes(env).find((p) => p.purpose === name) ?? null;

    function bucketFor(env: Env, audience: FileRecord['audience']): FilesBucket {
        const buckets = options.buckets(env);
        const bucket = audience === 'public' ? buckets.public : buckets.private;
        if (!bucket) throw new FilesError(503, 'STORAGE_UNAVAILABLE', 'File storage is not configured');
        return bucket;
    }

    function view(env: Env, record: FileRecord): FileView {
        let url: string;
        let variantUrl: (variant: FileVariant) => string;
        if (record.audience === 'public') {
            const base = publicBase(env);
            url = `${base}/${record.storageKey}`;
            variantUrl = (variant) => {
                const info = record.variants?.[variant];
                return info ? `${base}/${info.key}` : url;
            };
        } else {
            url = `${FILES_ROUTE}/${record.id}`;
            variantUrl = (variant) => (record.variants?.[variant] ? `${url}/${variant}` : url);
        }
        return { ...record, url, thumbnailUrl: variantUrl('thumb'), previewUrl: variantUrl('card') };
    }

    /** Re-encode an image the code cannot strip (see REENCODED_TYPES) to WebP through the binding. */
    async function reencode(env: Env, bytes: Uint8Array, purpose: FilePurpose): Promise<Uint8Array> {
        const images = options.images?.(env);
        if (!images) {
            throw new FilesError(
                415,
                'UNSUPPORTED_TYPE',
                'AVIF images cannot be stored here: their location and camera data cannot be removed. Upload a JPEG, PNG or WebP instead.',
            );
        }
        let out: Uint8Array;
        try {
            const stream = new Response(bytes as BodyInit).body as ReadableStream<Uint8Array>;
            const result = await images
                .input(stream)
                .output({ format: 'image/webp', quality: REENCODE_QUALITY, anim: true });
            out = new Uint8Array(await result.response().arrayBuffer());
        } catch {
            throw new FilesError(422, 'IMAGE_UNPROCESSABLE', 'The image could not be processed');
        }
        // Only a real WebP comes out of here; anything else is not stored.
        if (sniff(out)?.mime !== 'image/webp') {
            throw new FilesError(422, 'IMAGE_UNPROCESSABLE', 'The image could not be processed');
        }
        if (out.byteLength > purpose.maxBytes) {
            throw new FilesError(
                413,
                'PAYLOAD_TOO_LARGE',
                `The file is larger than ${Math.floor(purpose.maxBytes / 1048576) || 1} MB`,
            );
        }
        return out;
    }

    async function renderVariants(
        env: Env,
        bucket: FilesBucket,
        input: {
            appId: string;
            purpose: FilePurpose;
            id: string;
            bytes: Uint8Array;
            width: number | null;
            height: number | null;
        },
        written: string[],
    ): Promise<FileRecord['variants']> {
        const images = options.images?.(env);
        if (!images || !input.purpose.variants?.length) return null;
        const out: Partial<Record<FileVariant, FileVariantInfo>> = {};
        for (const variant of input.purpose.variants) {
            const target = FILE_VARIANT_WIDTHS[variant];
            try {
                const stream = new Response(input.bytes as BodyInit).body as ReadableStream<Uint8Array>;
                // scale-down: never upscaled. The Images binding applies the EXIF orientation.
                const result = await images
                    .input(stream)
                    .transform({ width: target, fit: 'scale-down' })
                    .output({ format: 'image/webp', quality: VARIANT_QUALITY });
                const bytes = new Uint8Array(await result.response().arrayBuffer());
                const key = variantKey(input.appId, input.purpose.purpose, input.id, variant);
                await bucket.put(key, bytes, {
                    httpMetadata: {
                        contentType: 'image/webp',
                        contentDisposition: 'inline',
                        cacheControl:
                            input.purpose.audience === 'public' ? PUBLIC_CACHE_CONTROL : PRIVATE_CACHE_CONTROL,
                    },
                });
                written.push(key);
                const width = input.width ? Math.min(target, input.width) : target;
                const height = input.width && input.height ? Math.round((input.height * width) / input.width) : 0;
                out[variant] = { key, width, height, size: bytes.byteLength };
            } catch (error) {
                // A variant is an optimisation: without it the URL falls back to the original.
                console.warn(
                    JSON.stringify({
                        event: 'files_variant_failed',
                        variant,
                        purpose: input.purpose.purpose,
                        message: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
                    }),
                );
            }
        }
        return Object.keys(out).length ? out : null;
    }

    const keysOf = (record: FileRecord) => [
        record.storageKey,
        ...Object.values(record.variants ?? {}).map((info) => info!.key),
    ];

    /** Where a file's objects are: a quarantined public file's sit in the private bucket. */
    const storedIn = (env: Env, record: FileRecord) =>
        bucketFor(env, record.status === 'quarantined' ? 'members' : record.audience);

    /** Copy every key with its HTTP metadata, then delete the originals: nothing is lost midway. */
    async function move(from: FilesBucket, to: FilesBucket, keys: string[]): Promise<void> {
        for (const key of keys) {
            const object = await from.get(key);
            // Already moved (a retried request): nothing to copy.
            if (!object?.body) continue;
            // R2 needs a known length for a put, so the bytes are read (files are capped in MB).
            const bytes = new Uint8Array(await new Response(object.body as BodyInit).arrayBuffer());
            await to.put(key, bytes, object.httpMetadata ? { httpMetadata: object.httpMetadata } : undefined);
        }
        await from.delete(keys);
    }

    async function remove(env: Env, id: string): Promise<boolean> {
        const record = await options.store.get(id);
        if (!record || record.appId !== options.appId(env)) return false;
        await storedIn(env, record).delete(keysOf(record));
        await options.store.delete(id);
        return true;
    }

    return {
        purposes: (env) => options.purposes(env),
        purpose: purposeOf,

        async put(env, input) {
            const purpose = purposeOf(env, input.purpose);
            if (!purpose) throw new FilesError(400, 'UNKNOWN_PURPOSE', `Unknown file purpose "${input.purpose}"`);
            const owner = input.owner;
            const bucket = bucketFor(env, purpose.audience);

            // Quota first, so an owner already over it is refused before a byte is read.
            const limit = options.quota ? await options.quota(env, owner) : quotaBytes(undefined);
            const used = limit === null ? 0 : await options.store.usedBytes(owner);
            const overQuota = () => new FilesError(413, 'QUOTA_EXCEEDED', 'Storage quota exceeded');
            if (limit !== null && used >= limit) throw overQuota();

            let bytes = await readCapped(input.file, purpose.maxBytes);
            if (limit !== null && used + bytes.byteLength > limit) throw overQuota();

            const sniffed = sniff(bytes);
            const name =
                (input.name ?? ('name' in input.file ? String(input.file.name) : '') ?? '').slice(0, 255) || 'file';
            // CSV is plain text the bytes cannot tell apart: the name may pick the label once the
            // bytes proved it is text. Both are served the same way (as a download).
            let mime = sniffed?.mime === 'text/plain' && /\.csv$/i.test(name) ? 'text/csv' : sniffed?.mime;
            if (!sniffed || !mime || !allows(purpose, mime)) {
                throw new FilesError(415, 'UNSUPPORTED_TYPE', `${purpose.label} does not accept this kind of file`);
            }
            let ext = mime === 'text/csv' ? 'csv' : sniffed.ext;

            if (REENCODED_TYPES.has(mime)) {
                bytes = await reencode(env, bytes, purpose);
                mime = 'image/webp';
                ext = 'webp';
            }

            let width: number | null = null;
            let height: number | null = null;
            if (RASTER_IMAGE_TYPES.has(mime)) {
                const stripped = stripMetadata(bytes, mime);
                bytes = stripped.bytes;
                const size = imageSize(bytes, mime);
                // Orientations 5-8 turn the picture a quarter: what a viewer shows is the other way round.
                const turned = stripped.orientation !== null && stripped.orientation >= 5;
                width = size ? (turned ? size.height : size.width) : null;
                height = size ? (turned ? size.width : size.height) : null;
            }

            const id = newFileId();
            const key = fileKey(owner.appId, purpose.purpose, id, ext);
            const written: string[] = [];
            try {
                await bucket.put(key, bytes, {
                    httpMetadata: {
                        contentType: mime,
                        contentDisposition: dispositionFor(mime),
                        cacheControl: purpose.audience === 'public' ? PUBLIC_CACHE_CONTROL : PRIVATE_CACHE_CONTROL,
                    },
                });
                written.push(key);
                const variants = RASTER_IMAGE_TYPES.has(mime)
                    ? await renderVariants(
                          env,
                          bucket,
                          { appId: owner.appId, purpose, id, bytes, width, height },
                          written,
                      )
                    : null;
                const now = Date.now();
                const record: FileRecord = {
                    id,
                    appId: owner.appId,
                    organizationId: owner.organizationId,
                    userId: owner.userId,
                    purpose: purpose.purpose,
                    audience: purpose.audience,
                    storageKey: key,
                    mimeType: mime,
                    mediaKind: mediaKindOf(mime),
                    status: 'ready',
                    originalName: name,
                    title: editText(input.title, 200) ?? name,
                    altText: editText(input.altText, 1000),
                    caption: editText(input.caption, 2000),
                    extension: ext,
                    fileSize: bytes.byteLength,
                    width,
                    height,
                    variants,
                    metadata: input.metadata ?? null,
                    createdAt: now,
                    updatedAt: now,
                };
                await options.store.insert(record);
                return view(env, record);
            } catch (error) {
                // No row, no objects: a failed put leaves nothing behind to count against the quota.
                if (written.length) await bucket.delete(written).catch(() => undefined);
                throw error;
            }
        },

        async get(env, id) {
            const record = await options.store.get(id);
            return record && record.appId === options.appId(env) ? record : null;
        },

        view,

        publicBase,

        url: (env, key) => `${publicBase(env)}/${key}`,

        keyOf(env, url) {
            // Relative and absolute spellings of the same URL both match (`/api/files/public/k`
            // and `https://app/api/files/public/k`); anything on another host does not.
            const placeholder = 'http://files.invalid';
            try {
                const base = new URL(`${publicBase(env)}/`, placeholder);
                const target = new URL(url, base);
                if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) return null;
                const key = target.pathname.slice(base.pathname.length);
                return SAFE_KEY_RE.test(key) ? key : null;
            } catch {
                return null;
            }
        },

        async signedUrl(env, id, { variant, ttlSeconds = SIGNED_URL_TTL_SECONDS } = {}) {
            const secret = options.signingSecret?.(env);
            if (!secret) throw new FilesError(503, 'SIGNING_UNAVAILABLE', 'FILES_SIGNING_SECRET is not set');
            const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
            const token = await signFileToken(secret, id, exp);
            return absolute(env, `${FILES_ROUTE}/${id}${variant ? `/${variant}` : ''}?t=${encodeURIComponent(token)}`);
        },

        async read(env, request, { id, variant, viewer, token }) {
            if (variant && !(variant in FILE_VARIANT_WIDTHS)) throw notFound();
            const record = await options.store.get(id);
            if (!record || record.appId !== options.appId(env) || record.status !== 'ready') throw notFound();

            if (record.audience === 'public') {
                const urls = view(env, record);
                const target = variant
                    ? record.variants?.[variant as FileVariant]
                        ? `${publicBase(env)}/${record.variants[variant as FileVariant]!.key}`
                        : urls.url
                    : urls.url;
                return new Response(null, {
                    status: 302,
                    headers: { Location: target, 'Cache-Control': 'private, max-age=300' },
                });
            }

            const secret = options.signingSecret?.(env);
            const signed = Boolean(token && secret && (await verifyFileToken(secret, id, token)));
            if (!signed && !canReadFile(record, viewer)) {
                throw viewer
                    ? new FilesError(403, 'FORBIDDEN', 'Forbidden')
                    : new FilesError(401, 'UNAUTHORIZED', 'Unauthorized');
            }
            const key = (variant && record.variants?.[variant as FileVariant]?.key) || record.storageKey;
            const response = await streamObject(storedIn(env, record), request, key, {
                // Cached by the browser alone, and revalidated (ETag → 304) on every use.
                cacheControl: 'private, no-cache',
                filename: record.originalName,
            });
            if (!response) throw notFound();
            return response;
        },

        async servePublic(env, request, key) {
            const response = await servePublicFile(bucketFor(env, 'public'), request, key);
            if (!response) throw notFound();
            return response;
        },

        async update(env, id, fields) {
            const record = await options.store.get(id);
            if (!record || record.appId !== options.appId(env)) return null;
            const edit: FileEdit = {};
            if (fields.title !== undefined) edit.title = editText(fields.title, 200);
            if (fields.altText !== undefined) edit.altText = editText(fields.altText, 1000);
            if (fields.caption !== undefined) edit.caption = editText(fields.caption, 2000);
            const updated = await options.store.update(id, edit);
            return updated ? view(env, updated) : null;
        },

        remove,

        async removeOwned(env, owner) {
            let removed = 0;
            for (;;) {
                const page = await options.store.uploadedBy(owner.appId, owner.userId, 100);
                if (!page.length) return removed;
                for (const record of page) if (await remove(env, record.id)) removed += 1;
            }
        },

        async quarantine(env, id, { origin } = {}) {
            const record = await options.store.get(id);
            if (!record || record.appId !== options.appId(env)) return null;
            if (record.status === 'quarantined') return { file: view(env, record), purge: 'none', urls: [] };

            let urls: string[] = [];
            if (record.audience === 'public') {
                // The public URLs, before the move: the original's and every variant's.
                const base = publicBase(env);
                urls = keysOf(record).map((key) => {
                    const url = `${base}/${key}`;
                    return origin ? new URL(url, origin).toString() : url;
                });
                await move(bucketFor(env, 'public'), bucketFor(env, 'members'), keysOf(record));
            }
            const updated = (await options.store.update(id, { status: 'quarantined' })) ?? {
                ...record,
                status: 'quarantined' as const,
            };
            if (!urls.length) return { file: view(env, updated), purge: 'none', urls };
            const absolute = urls.filter((url) => /^https?:\/\//.test(url));
            const purged = absolute.length === urls.length && options.purge ? await options.purge(env, urls) : false;
            return { file: view(env, updated), purge: purged ? 'purged' : 'manual', urls };
        },

        async restore(env, id) {
            const record = await options.store.get(id);
            if (!record || record.appId !== options.appId(env)) return null;
            if (record.status !== 'quarantined') return view(env, record);
            if (record.audience === 'public') {
                await move(bucketFor(env, 'members'), bucketFor(env, 'public'), keysOf(record));
            }
            const updated = (await options.store.update(id, { status: 'ready' })) ?? {
                ...record,
                status: 'ready' as const,
            };
            return view(env, updated);
        },
    };
}
