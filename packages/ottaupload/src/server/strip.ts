// ============================================================
// @ottabase/ottaupload: metadata stripping
// ============================================================
// A phone photo carries where it was taken (EXIF GPS), the camera's serial, editing history
// (XMP) and press captions (IPTC). None of it belongs on a public URL, so raster images lose
// it before they are stored, in code, without re-encoding a single pixel:
//
//   - JPEG: APP1 (Exif, XMP) and APP13 (Photoshop/IPTC) segments are dropped. The one EXIF tag
//     a viewer needs, Orientation, survives as a minimal EXIF segment holding only that tag, so
//     a portrait shot does not turn sideways.
//   - PNG: the `eXIf`, `tEXt`, `zTXt` and `iTXt` chunks are dropped.
//   - WebP: the `EXIF` and `XMP ` chunks are dropped and the VP8X flags cleared to match.
//
// Everything else (pixels, ICC colour profiles, animation frames) is copied byte for byte.
// GIF is stored as uploaded: it has no EXIF. AVIF never reaches this file: its metadata sits in
// ISO-BMFF item boxes, so the files service re-encodes it to WebP through the Images binding
// (and refuses it without one).
// ============================================================

function concat(parts: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.byteLength;
    }
    return out;
}

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
    String.fromCharCode(...bytes.subarray(start, start + length));

/** The Orientation tag (0x0112) of an APP1 Exif segment, or null. `segment` starts at the FFE1 marker. */
function exifOrientation(segment: Uint8Array): number | null {
    if (segment.length < 18 || ascii(segment, 4, 6) !== 'Exif\0\0') return null;
    const tiff = segment.subarray(10);
    const little = ascii(tiff, 0, 2) === 'II';
    if (!little && ascii(tiff, 0, 2) !== 'MM') return null;
    const u16 = (i: number) => (little ? tiff[i]! | (tiff[i + 1]! << 8) : (tiff[i]! << 8) | tiff[i + 1]!);
    const u32 = (i: number) => (little ? u16(i) + u16(i + 2) * 65536 : u16(i) * 65536 + u16(i + 2));
    if (tiff.length < 8 || u16(2) !== 42) return null;
    const ifd = u32(4);
    if (ifd + 2 > tiff.length) return null;
    const count = u16(ifd);
    for (let n = 0; n < count; n += 1) {
        const entry = ifd + 2 + n * 12;
        if (entry + 12 > tiff.length) return null;
        // Orientation is a SHORT (type 3) holding 1-8.
        if (u16(entry) === 0x0112 && u16(entry + 2) === 3) {
            const value = u16(entry + 8);
            return value >= 1 && value <= 8 ? value : null;
        }
    }
    return null;
}

/** An APP1 segment whose EXIF holds one tag: Orientation. Big-endian TIFF, one IFD, no next IFD. */
export function minimalExifSegment(orientation: number): Uint8Array {
    const rows = [
        [0xff, 0xe1, 0x00, 0x22], // APP1, length 34 (itself included, the marker not)
        [0x45, 0x78, 0x69, 0x66, 0x00, 0x00], // "Exif" and two NULs
        [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08], // "MM", 42, IFD0 at offset 8
        [0x00, 0x01], // one entry: tag 0x0112, SHORT, count 1, the value
        [0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00],
        [0x00, 0x00, 0x00, 0x00], // no next IFD
    ];
    return new Uint8Array(rows.flat());
}

function stripJpeg(bytes: Uint8Array): { bytes: Uint8Array; orientation: number | null } {
    const parts: Uint8Array[] = [bytes.subarray(0, 2)];
    let orientation: number | null = null;
    let i = 2;
    while (i + 4 <= bytes.length && bytes[i] === 0xff) {
        const marker = bytes[i + 1]!;
        if (marker === 0xff) {
            i += 1; // fill byte
            continue;
        }
        // Start of scan or end of image: the rest is entropy-coded data, copied as is.
        if (marker === 0xda || marker === 0xd9) break;
        const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
        const end = i + 2 + length;
        if (length < 2 || end > bytes.length) break;
        const segment = bytes.subarray(i, end);
        if (marker === 0xe1) {
            // Exif or XMP: dropped; the first Exif's Orientation is carried over.
            const found = exifOrientation(segment);
            if (found !== null && orientation === null) {
                orientation = found;
                if (found !== 1) parts.push(minimalExifSegment(found));
            }
        } else if (marker !== 0xed) {
            parts.push(segment);
        }
        i = end;
    }
    parts.push(bytes.subarray(i));
    return { bytes: concat(parts), orientation };
}

const PNG_DROPPED = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt']);

function stripPng(bytes: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [bytes.subarray(0, 8)];
    let i = 8;
    while (i + 12 <= bytes.length) {
        const length = ((bytes[i]! << 24) >>> 0) + ((bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!);
        const type = ascii(bytes, i + 4, 4);
        const end = i + 12 + length;
        if (end > bytes.length) break;
        if (!PNG_DROPPED.has(type)) parts.push(bytes.subarray(i, end));
        i = end;
        if (type === 'IEND') return concat(parts);
    }
    parts.push(bytes.subarray(i));
    return concat(parts);
}

function stripWebp(bytes: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [];
    let vp8x: Uint8Array | null = null;
    let i = 12;
    while (i + 8 <= bytes.length) {
        const type = ascii(bytes, i, 4);
        const length = bytes[i + 4]! | (bytes[i + 5]! << 8) | (bytes[i + 6]! << 16) | ((bytes[i + 7]! << 24) >>> 0);
        const end = Math.min(bytes.length, i + 8 + length + (length % 2));
        if (type !== 'EXIF' && type !== 'XMP ') {
            const chunk = bytes.slice(i, end);
            if (type === 'VP8X') vp8x = chunk;
            parts.push(chunk);
        }
        i = end;
    }
    // The VP8X header advertises which optional chunks follow: clear the EXIF (0x08) and XMP (0x04) bits.
    if (vp8x && vp8x.length > 8) vp8x[8] = vp8x[8]! & ~0x0c;
    const body = concat(parts);
    const out = new Uint8Array(12 + body.byteLength);
    out.set(bytes.subarray(0, 12));
    out.set(body, 12);
    const riffSize = out.byteLength - 8;
    out[4] = riffSize & 0xff;
    out[5] = (riffSize >> 8) & 0xff;
    out[6] = (riffSize >> 16) & 0xff;
    out[7] = (riffSize >>> 24) & 0xff;
    return out;
}

/**
 * Drop location, camera and editing metadata from a raster image (see the file header).
 * `orientation` is the JPEG's EXIF Orientation (1-8), null when it had none or for other formats.
 */
export function stripMetadata(bytes: Uint8Array, mime: string): { bytes: Uint8Array; orientation: number | null } {
    switch (mime) {
        case 'image/jpeg':
            return stripJpeg(bytes);
        case 'image/png':
            return { bytes: stripPng(bytes), orientation: null };
        case 'image/webp':
            return { bytes: stripWebp(bytes), orientation: null };
        default:
            return { bytes, orientation: null };
    }
}
