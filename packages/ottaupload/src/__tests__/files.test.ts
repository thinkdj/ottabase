// @vitest-environment node
import { fileIdFromKey } from '@ottabase/utils/media';
import { describe, expect, it, vi } from 'vitest';
import {
    canChangeFile,
    canModerateFile,
    canReadFile,
    createFiles,
    imageSize,
    servePublicFile,
    signFileToken,
    sniff,
    stripMetadata,
    verifyFileToken,
} from '../server';
import type { FilePurpose, FileRecord, FileStore, FileViewer, FilesBucket } from '../types';
import { FilesError } from '../types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const bytes = (...parts: Array<number[] | string | Uint8Array>): Uint8Array => {
    const arrays = parts.map((p) => (typeof p === 'string' ? new TextEncoder().encode(p) : Uint8Array.from(p)));
    const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
    let o = 0;
    for (const a of arrays) {
        out.set(a, o);
        o += a.length;
    }
    return out;
};
const u16be = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const u32le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
const segment = (marker: number, payload: Uint8Array) => bytes([0xff, marker, ...u16be(payload.length + 2)], payload);
const NUL = String.fromCharCode(0);

/** A big-endian EXIF APP1 with GPS-looking junk and the given Orientation. */
function exifApp1(orientation: number): Uint8Array {
    const ifd = bytes(
        u16be(2),
        [0x01, 0x12, 0x00, 0x03, ...u32be(1), ...u16be(orientation), 0, 0], // Orientation
        [0x88, 0x25, 0x00, 0x04, ...u32be(1), ...u32be(0)], // GPS IFD pointer
        u32be(0),
    );
    return segment(0xe1, bytes(`Exif${NUL}${NUL}`, 'MM', [0x00, 0x2a], u32be(8), ifd, 'GPS 51.5N 0.1W'));
}

function jpeg(orientation: number | null): Uint8Array {
    return bytes(
        [0xff, 0xd8],
        segment(0xe0, bytes(`JFIF${NUL}`, [1, 1, 0, 0, 1, 0, 1, 0, 0])),
        orientation === null ? new Uint8Array() : exifApp1(orientation),
        segment(0xe1, bytes(`http://ns.adobe.com/xap/1.0/${NUL}<x:xmpmeta>secret</x:xmpmeta>`)),
        segment(0xed, bytes(`Photoshop 3.0${NUL}IPTC caption`)),
        segment(0xc0, bytes([8], u16be(30), u16be(40), [1, 1, 0x11, 0])), // 40x30
        segment(0xda, bytes([1, 1, 0, 0, 0x3f, 0])),
        [0x12, 0x34, 0x56],
        [0xff, 0xd9],
    );
}

const pngChunk = (type: string, data: Uint8Array) => bytes(u32be(data.length), type, data, [0, 0, 0, 0]);
const png = (width = 64, height = 48) =>
    bytes(
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
        pngChunk('IHDR', bytes(u32be(width), u32be(height), [8, 6, 0, 0, 0])),
        pngChunk('tEXt', bytes(`Author${NUL}Jane`)),
        pngChunk('eXIf', bytes('MM', [0, 0x2a])),
        pngChunk('iTXt', bytes(`XML:com.adobe.xmp${NUL}`)),
        pngChunk('IDAT', bytes([1, 2, 3])),
        pngChunk('IEND', new Uint8Array()),
    );

const riffChunk = (type: string, data: Uint8Array) => bytes(type, u32le(data.length), data, data.length % 2 ? [0] : []);
function webp(): Uint8Array {
    const body = bytes(
        'WEBP',
        riffChunk('VP8X', bytes([0x0c, 0, 0, 0], [99, 0, 0], [49, 0, 0])), // 100x50, EXIF + XMP flags
        riffChunk('VP8 ', bytes([1, 2, 3, 4, 5])),
        riffChunk('EXIF', bytes('MM', [0, 0x2a], 'gps')),
        riffChunk('XMP ', bytes('<x:xmpmeta/>')),
    );
    return bytes('RIFF', u32le(body.length), body);
}

const latin1 = (data: Uint8Array) => new TextDecoder('latin1').decode(data);
const includes = (haystack: Uint8Array, needle: string) => latin1(haystack).includes(needle);

// ─── Sniffing ───────────────────────────────────────────────────────────────

describe('sniff', () => {
    it('reads the real type from magic bytes', () => {
        expect(sniff(jpeg(null))?.mime).toBe('image/jpeg');
        expect(sniff(png())).toEqual({ mime: 'image/png', ext: 'png' });
        expect(sniff(webp())?.mime).toBe('image/webp');
        expect(sniff(bytes('GIF89a', [1, 0, 1, 0]))?.mime).toBe('image/gif');
        expect(sniff(bytes('%PDF-1.7\n'))?.mime).toBe('application/pdf');
        expect(sniff(bytes([0, 0, 1, 0, 1, 0, 16, 16]))?.mime).toBe('image/x-icon');
        expect(sniff(bytes(u32be(24), 'ftypavif', u32be(0), 'mif1avif'))?.mime).toBe('image/avif');
        expect(sniff(bytes(u32be(20), 'ftypisom', u32be(0), 'mp41'))?.mime).toBe('video/mp4');
        expect(sniff(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84], 'webm'))?.mime).toBe('video/webm');
    });

    it('tells markup apart from plain text, and refuses binary junk', () => {
        expect(sniff(bytes('name,email\nA,a@b.c\n'))?.mime).toBe('text/plain');
        const svg = '<?xml version="1.0"?>\n<!-- logo -->\n<svg xmlns="http://www.w3.org/2000/svg"/>';
        expect(sniff(bytes(svg))?.mime).toBe('image/svg+xml');
        expect(sniff(bytes('<!doctype html><script>alert(1)</script>'))?.mime).toBe('text/html');
        expect(sniff(bytes([0x4d, 0x5a, 0x90, 0x00, 0x03]))).toBeNull(); // a Windows executable
        expect(sniff(bytes([0xc3, 0x28]))).toBeNull(); // invalid UTF-8
    });

    it('reads pixel sizes from the headers', () => {
        expect(imageSize(png(), 'image/png')).toEqual({ width: 64, height: 48 });
        expect(imageSize(jpeg(null), 'image/jpeg')).toEqual({ width: 40, height: 30 });
        expect(imageSize(webp(), 'image/webp')).toEqual({ width: 100, height: 50 });
    });
});

// ─── Metadata stripping ─────────────────────────────────────────────────────

describe('stripMetadata', () => {
    it('drops JPEG Exif, XMP and IPTC but keeps Orientation in a minimal EXIF', () => {
        const { bytes: out, orientation } = stripMetadata(jpeg(6), 'image/jpeg');
        expect(orientation).toBe(6);
        for (const secret of ['GPS', 'xmpmeta', 'IPTC', 'Photoshop']) expect(includes(out, secret)).toBe(false);
        expect(includes(out, 'JFIF')).toBe(true);
        // The minimal EXIF: one IFD entry, tag 0x0112, the value 6.
        const at = latin1(out).indexOf(`Exif${NUL}${NUL}`);
        expect(Array.from(out.subarray(at + 16, at + 28))).toEqual([0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0]);
        // The frame header and the scan data survive untouched.
        expect(Array.from(out.subarray(-5))).toEqual([0x12, 0x34, 0x56, 0xff, 0xd9]);
        expect(imageSize(out, 'image/jpeg')).toEqual({ width: 40, height: 30 });
    });

    it('writes no EXIF at all for the upright orientation or none', () => {
        expect(includes(stripMetadata(jpeg(1), 'image/jpeg').bytes, 'Exif')).toBe(false);
        const none = stripMetadata(jpeg(null), 'image/jpeg');
        expect(none.orientation).toBeNull();
        expect(includes(none.bytes, 'Exif')).toBe(false);
    });

    it('drops PNG eXIf and text chunks', () => {
        const out = stripMetadata(png(), 'image/png').bytes;
        for (const chunk of ['tEXt', 'eXIf', 'iTXt', 'Jane']) expect(includes(out, chunk)).toBe(false);
        for (const chunk of ['IHDR', 'IDAT', 'IEND']) expect(includes(out, chunk)).toBe(true);
    });

    it('drops WebP EXIF/XMP chunks, clears their VP8X flags and fixes the RIFF size', () => {
        const out = stripMetadata(webp(), 'image/webp').bytes;
        expect(includes(out, 'EXIF')).toBe(false);
        expect(includes(out, 'XMP ')).toBe(false);
        expect(out[20]! & 0x0c).toBe(0);
        expect(out[4]! | (out[5]! << 8) | (out[6]! << 16)).toBe(out.length - 8);
    });
});

// ─── Keys and tokens ────────────────────────────────────────────────────────

describe('keys', () => {
    it('finds the file id in an original or a variant key', () => {
        const id = 'a'.repeat(32);
        expect(fileIdFromKey(`app/media/${id}.jpg`)).toBe(id);
        expect(fileIdFromKey(`app/media/${id}/thumb.webp`)).toBe(id);
        expect(fileIdFromKey('vault/app/backup/users.ndjson')).toBeNull();
    });
});

describe('signed tokens', () => {
    const secret = 'test-secret-0123456789';
    const exp = Math.floor(Date.now() / 1000) + 60;

    it('opens only the file it was minted for, until it expires', async () => {
        const token = await signFileToken(secret, 'file-1', exp);
        expect(await verifyFileToken(secret, 'file-1', token)).toBe(true);
        expect(await verifyFileToken(secret, 'file-2', token)).toBe(false);
        expect(await verifyFileToken('another-secret-012345', 'file-1', token)).toBe(false);
        expect(await verifyFileToken(secret, 'file-1', token, (exp + 1) * 1000)).toBe(false);
        expect(await verifyFileToken(secret, 'file-1', `${exp + 999}.${token.split('.')[1]}`)).toBe(false);
        expect(await verifyFileToken(secret, 'file-1', 'garbage')).toBe(false);
    });
});

// ─── The service ────────────────────────────────────────────────────────────

interface Stored {
    body: Uint8Array;
    options: { httpMetadata?: Record<string, string> };
}

/** An R2 stand-in: `onlyIf`/`range` given as Headers, as the real binding accepts them. */
function memoryBucket() {
    const objects = new Map<string, Stored>();
    const bucket: FilesBucket & { objects: typeof objects } = {
        objects,
        async put(key, value, options) {
            objects.set(key, {
                body: new Uint8Array(value as Uint8Array),
                options: (options ?? {}) as Stored['options'],
            });
            return {};
        },
        async get(key, options) {
            const stored = objects.get(key);
            if (!stored) return null;
            const { onlyIf, range } = (options ?? {}) as { onlyIf?: Headers; range?: Headers };
            const etag = `"etag-${key.length}-${stored.body.length}"`;
            const base = {
                key,
                size: stored.body.length,
                httpEtag: etag,
                uploaded: new Date(0),
                httpMetadata: stored.options.httpMetadata,
                writeHttpMetadata(headers: Headers) {
                    const meta = stored.options.httpMetadata ?? {};
                    if (meta.contentType) headers.set('Content-Type', meta.contentType);
                    if (meta.cacheControl) headers.set('Cache-Control', meta.cacheControl);
                },
            };
            if (onlyIf?.get('if-none-match') === etag) return base as never;
            const match = /^bytes=(\d+)-(\d*)$/.exec(range?.get('range') ?? '');
            if (match) {
                const offset = Number(match[1]);
                const end = match[2] ? Number(match[2]) : stored.body.length - 1;
                if (offset >= stored.body.length) throw new Error('InvalidRange');
                const body = stored.body.slice(offset, end + 1);
                return { ...base, range: { offset, length: end - offset + 1 }, body } as never;
            }
            return { ...base, body: stored.body } as never;
        },
        async delete(keys) {
            for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
            return undefined;
        },
    };
    return bucket;
}

function memoryStore(): FileStore & { rows: Map<string, FileRecord> } {
    const rows = new Map<string, FileRecord>();
    return {
        rows,
        insert: async (record) => void rows.set(record.id, { ...record }),
        get: async (id) => rows.get(id) ?? null,
        update: async (id, fields) => {
            const row = rows.get(id);
            if (!row) return null;
            Object.assign(row, fields);
            return row;
        },
        delete: async (id) => void rows.delete(id),
        usedBytes: async (owner) =>
            [...rows.values()]
                .filter((r) =>
                    owner.organizationId ? r.organizationId === owner.organizationId : r.userId === owner.userId,
                )
                .reduce((sum, r) => sum + r.fileSize, 0),
        uploadedBy: async (appId, userId, limit) =>
            [...rows.values()].filter((r) => r.appId === appId && r.userId === userId).slice(0, limit),
    };
}

const PURPOSES: FilePurpose[] = [
    {
        purpose: 'media',
        label: 'Media',
        audience: 'public',
        types: ['image/*', 'application/pdf'],
        maxBytes: 4096,
        variants: ['thumb', 'card'],
    },
    {
        purpose: 'attachment',
        label: 'Attachments',
        audience: 'members',
        types: ['image/png', 'text/plain', 'text/csv'],
        maxBytes: 4096,
    },
    { purpose: 'secret', label: 'Private notes', audience: 'owner', types: ['text/plain'], maxBytes: 4096 },
    {
        purpose: 'logo',
        label: 'Logos',
        audience: 'public',
        types: ['image/png', 'image/svg+xml'],
        maxBytes: 4096,
        svg: true,
    },
];

function setup(
    overrides: {
        quota?: number | null;
        images?: boolean;
        secret?: string;
        purge?: (urls: string[]) => boolean;
        origin?: string;
        publicUrl?: string;
    } = {},
) {
    const store = memoryStore();
    const pub = memoryBucket();
    const priv = memoryBucket();
    const transform = vi.fn();
    const output = vi.fn();
    // The binding answers a real WebP (with metadata chunks, which the service strips again).
    const images = {
        input: () => {
            const transformer = {
                transform: (options: { width?: number }) => {
                    transform(options);
                    return transformer;
                },
                output: async (options: unknown) => {
                    output(options);
                    return { response: () => new Response(webp() as BodyInit) };
                },
            };
            return transformer;
        },
    };
    const files = createFiles<object>({
        appId: () => 'app',
        purposes: () => PURPOSES,
        store,
        buckets: () => ({ public: pub, private: priv }),
        images: () => (overrides.images ? (images as never) : null),
        signingSecret: () => overrides.secret,
        quota: () => (overrides.quota === undefined ? null : overrides.quota),
        purge: overrides.purge ? async (_env, urls) => overrides.purge!(urls) : undefined,
        origin: () => overrides.origin,
        publicUrl: () => overrides.publicUrl,
    });
    return { files, store, pub, priv, transform, output };
}

const alice = { appId: 'app', userId: 'alice', organizationId: 'org-1' };
const viewer = (userId: string, organizationId: string | null, roles: Partial<FileViewer> = {}): FileViewer => ({
    userId,
    organizationId,
    admin: false,
    platformAdmin: false,
    ...roles,
});
const get = (path: string, headers: Record<string, string> = {}) => new Request(`https://app.test${path}`, { headers });

describe('createFiles().put', () => {
    it('keys by app, purpose and a random id, sniffs the type, strips metadata, never trusts the name', async () => {
        const { files, pub } = setup();
        const file = new File([jpeg(6) as BlobPart], 'holiday.png', { type: 'image/png' });
        const view = await files.put({}, { purpose: 'media', owner: alice, file });

        expect(view.storageKey).toMatch(/^app\/media\/[0-9a-f]{32}\.jpg$/);
        expect(view.id).toBe(fileIdFromKey(view.storageKey));
        expect(view).toMatchObject({
            mimeType: 'image/jpeg',
            extension: 'jpg',
            originalName: 'holiday.png',
            audience: 'public',
        });
        // Orientation 6 turns the 40x30 frame into a 30x40 picture.
        expect([view.width, view.height]).toEqual([30, 40]);
        expect(view.url).toBe(`/api/files/public/${view.storageKey}`);
        const stored = pub.objects.get(view.storageKey)!;
        expect(includes(stored.body, 'GPS')).toBe(false);
        expect(stored.options.httpMetadata).toEqual({
            contentType: 'image/jpeg',
            contentDisposition: 'inline',
            cacheControl: 'public, max-age=31536000, immutable',
        });
    });

    it('routes private audiences to the private bucket with private caching and an attachment disposition', async () => {
        const { files, pub, priv } = setup();
        const view = await files.put(
            {},
            { purpose: 'attachment', owner: alice, file: bytes('a,b\n1,2\n'), name: 'data.csv' },
        );
        expect(pub.objects.size).toBe(0);
        expect(priv.objects.get(view.storageKey)!.options.httpMetadata).toEqual({
            contentType: 'text/csv',
            contentDisposition: 'attachment',
            cacheControl: 'private, no-store',
        });
        expect(view.url).toBe(`/api/files/${view.id}`);
        expect(view.thumbnailUrl).toBe(view.url);
    });

    it('refuses what the allow-list does not name, whatever the browser claims', async () => {
        const { files } = setup();
        const html = new File(['<!doctype html><script>x</script>'], 'cat.png', { type: 'image/png' });
        await expect(files.put({}, { purpose: 'attachment', owner: alice, file: html })).rejects.toMatchObject({
            status: 415,
            code: 'UNSUPPORTED_TYPE',
        });
        const svg = bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>');
        await expect(files.put({}, { purpose: 'media', owner: alice, file: svg })).rejects.toMatchObject({
            status: 415,
        });
        // SVG only where the purpose says svg: true.
        expect((await files.put({}, { purpose: 'logo', owner: alice, file: svg })).mimeType).toBe('image/svg+xml');
        await expect(files.put({}, { purpose: 'nope', owner: alice, file: svg })).rejects.toMatchObject({
            status: 400,
        });
    });

    it('caps bytes while reading a stream', async () => {
        const { files } = setup();
        const stream = new ReadableStream<Uint8Array>({
            pull(controller) {
                controller.enqueue(new Uint8Array(1024).fill(0x61));
            },
        });
        await expect(files.put({}, { purpose: 'attachment', owner: alice, file: stream })).rejects.toMatchObject({
            status: 413,
            code: 'PAYLOAD_TOO_LARGE',
        });
    });

    it('enforces the quota with one sum over the owner', async () => {
        const { files, store } = setup({ quota: 20 });
        await files.put({}, { purpose: 'attachment', owner: alice, file: bytes('0123456789') });
        await expect(
            files.put({}, { purpose: 'attachment', owner: alice, file: bytes('0123456789A') }),
        ).rejects.toMatchObject({ status: 413, code: 'QUOTA_EXCEEDED' });
        // Another organization has its own quota.
        const other = { ...alice, organizationId: 'org-2' };
        await files.put({}, { purpose: 'attachment', owner: other, file: bytes('0123456789') });
        expect(store.rows.size).toBe(2);
    });

    it('renders fixed-width WebP variants through the Images binding, and offers them in a srcset', async () => {
        const { files, pub, transform } = setup({ images: true });
        const view = await files.put({}, { purpose: 'media', owner: alice, file: png(2000, 1500) });
        expect(transform.mock.calls.map(([options]) => options)).toEqual([
            { width: 160, fit: 'scale-down' },
            { width: 640, fit: 'scale-down' },
        ]);
        expect(view.variants?.thumb).toMatchObject({
            key: view.storageKey.replace('.png', '/thumb.webp'),
            width: 160,
            height: 120,
        });
        const thumb = `/api/files/public/${view.variants!.thumb!.key}`;
        const card = `/api/files/public/${view.variants!.card!.key}`;
        expect(view.thumbnailUrl).toBe(thumb);
        expect(view.previewUrl).toBe(card);
        // No full variant was asked for, so the original tops the srcset.
        expect(view.srcSet).toBe(`${thumb} 160w, ${card} 640w, ${view.url} 2000w`);
        expect(pub.objects.get(view.variants!.thumb!.key)!.options.httpMetadata?.contentType).toBe('image/webp');
    });

    it('makes no variant as wide as the original or wider: that would be the original again', async () => {
        const { files, transform } = setup({ images: true });
        const mid = await files.put({}, { purpose: 'media', owner: alice, file: png(500, 300) });
        expect(transform.mock.calls.map(([options]) => options.width)).toEqual([160]);
        expect(Object.keys(mid.variants ?? {})).toEqual(['thumb']);
        expect(mid.previewUrl).toBe(mid.url);

        transform.mockClear();
        const small = await files.put({}, { purpose: 'media', owner: alice, file: png(160, 120) });
        expect(transform).not.toHaveBeenCalled();
        expect(small.variants).toBeNull();
        expect(small.thumbnailUrl).toBe(small.url);
        expect(small.srcSet).toBeNull();
    });

    it('re-encodes AVIF (whose metadata code cannot strip) to WebP through the binding, and stores only that', async () => {
        const { files, pub, output } = setup({ images: true });
        const avif = bytes(u32be(24), 'ftypavif', u32be(0), 'mif1avif', 'Exif GPS 51.5N');
        const view = await files.put({}, { purpose: 'media', owner: alice, file: avif, name: 'trip.avif' });
        expect(output).toHaveBeenCalledWith({ format: 'image/webp', quality: 90, anim: true });
        expect(view).toMatchObject({ mimeType: 'image/webp', extension: 'webp', originalName: 'trip.avif' });
        expect(view.storageKey).toMatch(/\.webp$/);
        const stored = pub.objects.get(view.storageKey)!.body;
        for (const secret of ['GPS', 'EXIF', 'XMP ', 'ftyp']) expect(includes(stored, secret)).toBe(false);
    });

    it('refuses AVIF without the binding rather than store it with its metadata', async () => {
        const { files, pub } = setup();
        const avif = bytes(u32be(24), 'ftypavif', u32be(0), 'mif1avif');
        await expect(files.put({}, { purpose: 'media', owner: alice, file: avif })).rejects.toMatchObject({
            status: 415,
            message: expect.stringContaining('AVIF'),
        });
        expect(pub.objects.size).toBe(0);
    });

    it('serves raster and video inline, PDFs and everything else as downloads', async () => {
        const { files, pub } = setup();
        const pdf = await files.put({}, { purpose: 'media', owner: alice, file: bytes('%PDF-1.7\n') });
        expect(pub.objects.get(pdf.storageKey)!.options.httpMetadata?.contentDisposition).toBe('attachment');
        const image = await files.put({}, { purpose: 'media', owner: alice, file: png() });
        expect(pub.objects.get(image.storageKey)!.options.httpMetadata?.contentDisposition).toBe('inline');
        const res = (await servePublicFile(pub, get('/x'), pdf.storageKey))!;
        expect(res.headers.get('Content-Disposition')).toMatch(/^attachment;/);
    });

    it('without the binding stores no variants and every URL is the original', async () => {
        const { files } = setup();
        const view = await files.put({}, { purpose: 'media', owner: alice, file: png() });
        expect(view.variants).toBeNull();
        expect(view.thumbnailUrl).toBe(view.url);
    });
});

describe('createFiles().read', () => {
    async function stored(purpose: string) {
        const context = setup({ secret: 'test-secret-0123456789', images: true });
        const file = purpose === 'media' ? png() : bytes('hello world');
        const view = await context.files.put({}, { purpose, owner: alice, file });
        return { ...context, view };
    }

    it('redirects public files (and their variants) to the public URL', async () => {
        const { files, view } = await stored('media');
        const res = await files.read({}, get(`/api/files/${view.id}`), { id: view.id, viewer: null });
        expect(res.status).toBe(302);
        expect(res.headers.get('Location')).toBe(view.url);
        const thumb = await files.read({}, get(''), { id: view.id, variant: 'thumb', viewer: null });
        expect(thumb.headers.get('Location')).toBe(view.thumbnailUrl);
    });

    it('serves members files to the same organization only', async () => {
        const { files, view } = await stored('attachment');
        const read = (who: FileViewer | null) => files.read({}, get(''), { id: view.id, viewer: who });
        expect((await read(viewer('bob', 'org-1'))).status).toBe(200);
        await expect(read(viewer('eve', 'org-2'))).rejects.toMatchObject({ status: 403 });
        await expect(read(null)).rejects.toMatchObject({ status: 401 });
        expect((await read(viewer('root', null, { platformAdmin: true }))).status).toBe(200);
    });

    it('serves owner files to the uploader and admins of the organization only', async () => {
        const { files, view } = await stored('secret');
        const read = (who: FileViewer) => files.read({}, get(''), { id: view.id, viewer: who });
        expect((await read(viewer('alice', 'org-1'))).status).toBe(200);
        await expect(read(viewer('bob', 'org-1'))).rejects.toBeInstanceOf(FilesError);
        expect((await read(viewer('carol', 'org-1', { admin: true }))).status).toBe(200);
        await expect(read(viewer('dave', 'org-2', { admin: true }))).rejects.toMatchObject({ status: 403 });
    });

    it('accepts a signed token instead of a session, and refuses tokens when no secret is set', async () => {
        const { files, view } = await stored('secret');
        const url = new URL(await files.signedUrl({}, view.id), 'https://app.test');
        const token = url.searchParams.get('t');
        const res = await files.read({}, get(url.pathname), { id: view.id, viewer: null, token });
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('hello world');

        const unsigned = setup();
        const other = await unsigned.files.put({}, { purpose: 'secret', owner: alice, file: bytes('x') });
        await expect(unsigned.files.signedUrl({}, other.id)).rejects.toMatchObject({ code: 'SIGNING_UNAVAILABLE' });
        await expect(unsigned.files.read({}, get(''), { id: other.id, viewer: null, token })).rejects.toMatchObject({
            status: 401,
        });
    });

    it('answers ranges, revalidates with ETag, and caches privately', async () => {
        const { files, view } = await stored('secret');
        const me = viewer('alice', 'org-1');
        const full = await files.read({}, get(''), { id: view.id, viewer: me });
        expect(full.headers.get('Cache-Control')).toBe('private, no-cache');
        expect(full.headers.get('Content-Disposition')).toBe('attachment; filename="file"');
        const partial = await files.read({}, get('', { range: 'bytes=0-4' }), { id: view.id, viewer: me });
        expect(partial.status).toBe(206);
        expect(partial.headers.get('Content-Range')).toBe('bytes 0-4/11');
        expect(await partial.text()).toBe('hello');
        const etag = full.headers.get('ETag')!;
        const cached = await files.read({}, get('', { 'if-none-match': etag }), { id: view.id, viewer: me });
        expect(cached.status).toBe(304);
    });

    it('refuses quarantined files and unknown variants', async () => {
        const { files, store, view } = await stored('media');
        await expect(files.read({}, get(''), { id: view.id, variant: 'huge', viewer: null })).rejects.toMatchObject({
            status: 404,
        });
        store.rows.get(view.id)!.status = 'quarantined';
        await expect(files.read({}, get(''), { id: view.id, viewer: null })).rejects.toMatchObject({ status: 404 });
    });
});

describe('servePublicFile', () => {
    it('serves immutable, unsniffed, sandboxed bytes with 304 and Range, and refuses odd keys', async () => {
        const bucket = memoryBucket();
        await bucket.put('app/media/a.svg', bytes('<svg/>'), { httpMetadata: { contentType: 'image/svg+xml' } });
        await bucket.put('app/media/b.png', png(), { httpMetadata: { contentType: 'image/png' } });
        const serve = (key: string, headers?: Record<string, string>) =>
            servePublicFile(bucket, get('/x', headers), key);

        const svg = (await serve('app/media/a.svg'))!;
        expect(svg.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(svg.headers.get('Content-Security-Policy')).toBe("sandbox; default-src 'none'");
        expect(svg.headers.get('Content-Disposition')).toBe('attachment; filename="a.svg"');
        expect(svg.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');

        const image = (await serve('app/media/b.png'))!;
        expect(image.headers.get('Content-Disposition')).toBe('inline; filename="b.png"');
        expect((await serve('app/media/b.png', { 'if-none-match': image.headers.get('ETag')! }))!.status).toBe(304);
        expect((await serve('app/media/b.png', { range: 'bytes=1-3' }))!.status).toBe(206);
        expect((await serve('app/media/b.png', { range: 'bytes=9999-' }))!.status).toBe(416);
        const head = (await servePublicFile(
            bucket,
            new Request('https://app.test/x', { method: 'HEAD' }),
            'app/media/b.png',
        ))!;
        expect(head.status).toBe(200);
        expect(head.body).toBeNull();

        expect(await serve('app/../vault/x')).toBeNull();
        expect(await serve('app/media/missing.png')).toBeNull();
    });
});

describe('createFiles() housekeeping', () => {
    it('updates text fields, removes a file with its variants, and removes everything a user uploaded', async () => {
        const { files, pub, store } = setup({ images: true });
        const a = await files.put({}, { purpose: 'media', owner: alice, file: png() });
        await files.put({}, { purpose: 'media', owner: alice, file: png() });
        await files.put({}, { purpose: 'media', owner: { ...alice, userId: 'bob' }, file: png() });

        expect(await files.update({}, a.id, { title: '  Hero  ', caption: '' })).toMatchObject({
            title: 'Hero',
            caption: null,
        });
        expect(await files.remove({}, a.id)).toBe(true);
        expect([...pub.objects.keys()].some((key) => key.includes(a.id))).toBe(false);
        expect(await files.removeOwned({}, { appId: 'app', userId: 'alice' })).toBe(1);
        expect([...store.rows.values()].map((r) => r.userId)).toEqual(['bob']);
        expect(files.keyOf({}, `/api/files/public/${a.storageKey}?v=1`)).toBe(a.storageKey);
        expect(files.keyOf({}, 'https://elsewhere.test/x.png')).toBeNull();
    });

    it('lets the uploader and admins change a file, nobody else', () => {
        const record = { audience: 'members', userId: 'alice', organizationId: 'org-1' } as FileRecord;
        expect(canChangeFile(record, viewer('alice', 'org-1'))).toBe(true);
        expect(canChangeFile(record, viewer('bob', 'org-1'))).toBe(false);
        expect(canChangeFile(record, viewer('carol', 'org-1', { admin: true }))).toBe(true);
        expect(canReadFile(record, viewer('bob', 'org-1'))).toBe(true);
        expect(canReadFile({ ...record, organizationId: null }, viewer('bob', null))).toBe(false);
    });
});

describe('createFiles().quarantine', () => {
    it('moves a public file and its variants to the private bucket under the same keys, and purges its URLs', async () => {
        const purge = vi.fn(() => true);
        const { files, pub, priv } = setup({ images: true, purge });
        const view = await files.put({}, { purpose: 'media', owner: alice, file: png(2000, 1500) });
        const keys = [view.storageKey, view.variants!.thumb!.key, view.variants!.card!.key];

        const result = (await files.quarantine({}, view.id, { origin: 'https://app.test' }))!;
        expect(result.file.status).toBe('quarantined');
        expect(result.purge).toBe('purged');
        expect(purge).toHaveBeenCalledWith(keys.map((key) => `https://app.test/api/files/public/${key}`));
        for (const key of keys) {
            expect(pub.objects.has(key)).toBe(false);
            expect(priv.objects.has(key)).toBe(true);
        }
        // Metadata travels with the bytes.
        expect(priv.objects.get(view.storageKey)!.options.httpMetadata?.contentType).toBe('image/png');
        // No read path serves it: not by key, not by id.
        await expect(files.servePublic({}, get('/x'), view.storageKey)).rejects.toMatchObject({ status: 404 });
        await expect(files.read({}, get('/x'), { id: view.id, viewer: null })).rejects.toMatchObject({ status: 404 });
        // A second quarantine changes nothing.
        expect((await files.quarantine({}, view.id))!.purge).toBe('none');

        const restored = (await files.restore({}, view.id))!;
        expect(restored.status).toBe('ready');
        for (const key of keys) expect(pub.objects.has(key)).toBe(true);
        expect(priv.objects.size).toBe(0);
        expect((await files.read({}, get('/x'), { id: view.id, viewer: null })).status).toBe(302);
    });

    it('says the URLs need purging by hand when no purge is configured (or the base is relative)', async () => {
        const { files } = setup();
        const view = await files.put({}, { purpose: 'media', owner: alice, file: png() });
        const result = (await files.quarantine({}, view.id))!;
        expect(result).toMatchObject({ purge: 'manual', urls: [`/api/files/public/${view.storageKey}`] });
    });

    it('quarantines a private file in place, and a delete then removes it from wherever it sits', async () => {
        const { files, pub, priv, store } = setup({ images: true });
        const secret = await files.put({}, { purpose: 'secret', owner: alice, file: bytes('hi') });
        expect((await files.quarantine({}, secret.id))!).toMatchObject({ purge: 'none', urls: [] });
        expect(priv.objects.has(secret.storageKey)).toBe(true);
        await expect(
            files.read({}, get('/x'), { id: secret.id, viewer: viewer('alice', 'org-1') }),
        ).rejects.toMatchObject({ status: 404 });

        const media = await files.put({}, { purpose: 'media', owner: alice, file: png() });
        await files.quarantine({}, media.id);
        expect(await files.remove({}, media.id)).toBe(true);
        expect([...pub.objects.keys(), ...priv.objects.keys()].some((key) => key.includes(media.id))).toBe(false);
        expect(store.rows.has(media.id)).toBe(false);
    });

    it('lets only admins of the file’s organization, and platform admins, moderate', () => {
        const record = { audience: 'public', userId: 'alice', organizationId: 'org-1' } as FileRecord;
        expect(canModerateFile(record, viewer('alice', 'org-1'))).toBe(false);
        expect(canModerateFile(record, viewer('carol', 'org-1', { admin: true }))).toBe(true);
        expect(canModerateFile(record, viewer('dave', 'org-2', { admin: true }))).toBe(false);
        expect(canModerateFile(record, viewer('root', null, { platformAdmin: true }))).toBe(true);
    });
});

describe('createFiles() absolute URLs', () => {
    it('resolves the default (relative) public base against the app origin, for views, url() and signed links', async () => {
        const { files } = setup({ origin: 'https://app.test/some/path', secret: 'test-secret-0123456789' });
        expect(files.publicBase({})).toBe('https://app.test/api/files/public');
        const view = await files.put({}, { purpose: 'media', owner: alice, file: png() });
        expect(view.url).toBe(`https://app.test/api/files/public/${view.storageKey}`);
        expect(files.url({}, 'app/brand-asset/x.svg')).toBe('https://app.test/api/files/public/app/brand-asset/x.svg');
        const secret = await files.put({}, { purpose: 'secret', owner: alice, file: bytes('x') });
        expect(await files.signedUrl({}, secret.id)).toMatch(
            new RegExp(`^https://app\\.test/api/files/${secret.id}\\?t=`),
        );
        // A quarantine's purge list is absolute without a request origin.
        expect((await files.quarantine({}, view.id))!.urls).toEqual([view.url]);
    });

    it('keeps an absolute R2_PUBLIC_URL (a custom domain) as it is, and stays relative with no origin known', async () => {
        expect(setup({ origin: 'https://app.test', publicUrl: 'https://files.cdn.test/' }).files.publicBase({})).toBe(
            'https://files.cdn.test',
        );
        expect(setup().files.publicBase({})).toBe('/api/files/public');
        expect(setup({ origin: 'not a url' }).files.publicBase({})).toBe('/api/files/public');
    });

    it('recognises its own keys in the relative and the absolute spelling, and nobody else’s', () => {
        const { files } = setup({ origin: 'https://app.test' });
        const key = 'app/share-image/' + 'a'.repeat(32) + '.png';
        expect(files.keyOf({}, `/api/files/public/${key}`)).toBe(key);
        expect(files.keyOf({}, `https://app.test/api/files/public/${key}?v=2`)).toBe(key);
        expect(files.keyOf({}, `https://evil.test/api/files/public/${key}`)).toBeNull();
        expect(files.keyOf({}, '/api/files/public/../vault/x')).toBeNull();
    });
});
