// Rows to NDJSON and back. JSON has no bytes, so a BLOB travels as `{ "$blob": "<base64>" }`.

const INTERNAL_TABLES = new Set(['_cf_KV', '__drizzle_migrations', 'd1_migrations', 'sqlite_sequence']);

export function isInternalTable(name: string): boolean {
    return INTERNAL_TABLES.has(name) || name.startsWith('sqlite_') || name.startsWith('_cf_');
}

/** Double-quote an identifier, refusing anything that is not a plain SQL name. */
export function quoteIdent(name: string): string {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`[vault] unsafe identifier "${name}"`);
    return `"${name}"`;
}

export function isValidBackupId(id: string): boolean {
    return /^[A-Za-z0-9._-]{1,128}$/.test(id);
}

function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export function encodeValue(value: unknown): unknown {
    if (value instanceof ArrayBuffer) return { $blob: toBase64(new Uint8Array(value)) };
    if (ArrayBuffer.isView(value)) {
        return { $blob: toBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) };
    }
    return value;
}

export function decodeValue(value: unknown): unknown {
    if (
        value &&
        typeof value === 'object' &&
        '$blob' in value &&
        typeof (value as { $blob: unknown }).$blob === 'string'
    ) {
        return fromBase64((value as { $blob: string }).$blob);
    }
    return value;
}

export function encodeRow(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) out[key] = encodeValue(value);
    return out;
}

export function decodeRow(line: string): Record<string, unknown> {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) out[key] = decodeValue(value);
    return out;
}

export function* ndjsonLines(text: string): Generator<string> {
    let start = 0;
    while (start < text.length) {
        let end = text.indexOf('\n', start);
        if (end < 0) end = text.length;
        const line = text.slice(start, end).trim();
        if (line) yield line;
        start = end + 1;
    }
}

export function byteLength(text: string): number {
    return new TextEncoder().encode(text).byteLength;
}
