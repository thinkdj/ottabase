// ============================================================
// @ottabase/ottaupload: what a file really is
// ============================================================
// The browser's `file.type` and the file name are whatever the uploader says they are. The
// files system decides from the bytes: a magic-number check for the binary formats it stores,
// and a strict UTF-8 decode for text (which is then told apart from SVG, HTML and XML, so a
// `.txt` holding markup never passes as plain text). Anything unrecognised is null, and an
// allow-list built from MIME types refuses it.
// ============================================================

export interface SniffedType {
    mime: string;
    /** The extension the key gets. Derived from the type, never from the uploaded name. */
    ext: string;
}

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
    String.fromCharCode(...bytes.subarray(start, start + length));

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'M4V ', 'mp4v']);

/** The ISO-BMFF brands (major plus compatible) of an `ftyp` box at offset 0. */
function ftypBrands(bytes: Uint8Array): string[] {
    const size = (bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!;
    const end = Math.min(size > 16 ? size : 16, bytes.length, 256);
    const brands = [ascii(bytes, 8, 4)];
    for (let i = 16; i + 4 <= end; i += 4) brands.push(ascii(bytes, i, 4));
    return brands;
}

const SVG_RE = /^(?:\s|<\?xml[^>]*>|<!--[\s\S]*?-->|<!DOCTYPE[^>[]*>)*<svg[\s>/]/i;
const HTML_RE = /^(?:\s|<!--[\s\S]*?-->)*<(?:!DOCTYPE\s+html|html|head|body|script|iframe|meta|link|style|div|a\s)/i;

/** The real type of `bytes`, or null when it is nothing the files system knows how to store. */
export function sniff(bytes: Uint8Array): SniffedType | null {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return { mime: 'image/jpeg', ext: 'jpg' };
    }
    if (bytes.length >= 8 && PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) {
        return { mime: 'image/png', ext: 'png' };
    }
    if (bytes.length >= 6 && (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')) {
        return { mime: 'image/gif', ext: 'gif' };
    }
    if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
        return { mime: 'image/webp', ext: 'webp' };
    }
    if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
        const brands = ftypBrands(bytes);
        if (brands.includes('avif') || brands.includes('avis')) return { mime: 'image/avif', ext: 'avif' };
        if (brands[0] === 'qt  ') return { mime: 'video/quicktime', ext: 'mov' };
        if (brands.some((brand) => MP4_BRANDS.has(brand))) return { mime: 'video/mp4', ext: 'mp4' };
        return null;
    }
    if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
        // EBML: the DocType element near the start says WebM or Matroska.
        const head = ascii(bytes, 0, Math.min(bytes.length, 64));
        if (head.includes('webm')) return { mime: 'video/webm', ext: 'webm' };
        if (head.includes('matroska')) return { mime: 'video/x-matroska', ext: 'mkv' };
        return null;
    }
    if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
    // ICO: reserved 0, type 1 (icon), then at least one image.
    if (bytes.length >= 6 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0 && bytes[4]! > 0) {
        return { mime: 'image/x-icon', ext: 'ico' };
    }

    return sniffText(bytes);
}

/** Text is valid UTF-8 without NUL bytes; markup inside it is SVG, HTML or XML, never plain text. */
function sniffText(bytes: Uint8Array): SniffedType | null {
    if (bytes.length === 0 || bytes.includes(0)) return null;
    let text: string;
    try {
        text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
    } catch {
        return null;
    }
    if (SVG_RE.test(text)) return { mime: 'image/svg+xml', ext: 'svg' };
    if (HTML_RE.test(text)) return { mime: 'text/html', ext: 'html' };
    if (/^\s*<\?xml/i.test(text)) return { mime: 'application/xml', ext: 'xml' };
    return { mime: 'text/plain', ext: 'txt' };
}

/** Raster formats: metadata is stripped and variants can be rendered. */
export const RASTER_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);

/** Pixel size from the format's own header, or null when it cannot be read cheaply. */
export function imageSize(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
    const u16be = (i: number) => (bytes[i]! << 8) | bytes[i + 1]!;
    const u16le = (i: number) => bytes[i]! | (bytes[i + 1]! << 8);
    const u24le = (i: number) => bytes[i]! | (bytes[i + 1]! << 8) | (bytes[i + 2]! << 16);
    const u32be = (i: number) =>
        ((bytes[i]! << 24) >>> 0) + ((bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!);
    const size = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : null);

    switch (mime) {
        case 'image/png':
            return bytes.length >= 24 ? size(u32be(16), u32be(20)) : null;
        case 'image/gif':
            return bytes.length >= 10 ? size(u16le(6), u16le(8)) : null;
        case 'image/webp': {
            if (bytes.length < 30) return null;
            const chunk = ascii(bytes, 12, 4);
            if (chunk === 'VP8X') return size(u24le(24) + 1, u24le(27) + 1);
            if (chunk === 'VP8 ') return size(u16le(26) & 0x3fff, u16le(28) & 0x3fff);
            if (chunk === 'VP8L') {
                const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
                return size((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
            }
            return null;
        }
        case 'image/jpeg': {
            // Walk the segments to the first start-of-frame (C0-CF, except DHT C4, JPG C8 and DAC CC).
            let i = 2;
            while (i + 9 < bytes.length && bytes[i] === 0xff) {
                const marker = bytes[i + 1]!;
                if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
                    return size(u16be(i + 7), u16be(i + 5));
                }
                if (marker === 0xda || marker === 0xd9) return null;
                i += 2 + u16be(i + 2);
            }
            return null;
        }
        case 'image/avif': {
            // The `ispe` property: 4 bytes of version/flags, then width and height.
            const end = Math.min(bytes.length - 16, 65536);
            for (let i = 4; i < end; i += 1) {
                if (bytes[i] === 0x69 && ascii(bytes, i, 4) === 'ispe') return size(u32be(i + 8), u32be(i + 12));
            }
            return null;
        }
        default:
            return null;
    }
}
