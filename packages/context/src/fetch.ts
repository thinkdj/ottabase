// ============================================================
// Reading a context file over the network, and knowing when it changed
// ============================================================
// `ottaJsonUrl` turns whatever a founder pastes into the address of a context file: a product's
// site becomes its `/.well-known/otta.json`, an Ottabuzz log address becomes its `context.json`,
// a `.json` address is taken as is. `fetchOtta` reads it with a size cap, sends the ETag a
// reader kept so an unchanged file costs a 304 and no bytes, and compares the hash it kept so
// "changed" is one boolean. `inherit` is the merge rule every consumer uses: a local field that
// is empty follows upstream, a local field that is set is pinned and left alone.
// ============================================================

import { parseFounderJson } from './founder';
import { parseOttaJson } from './json';
import { OTTA_JSON_PATH, type OttaContext, type OttaFounder } from './types';

/** The address of a context file from anything a founder might paste. Null for pasted JSON and anything that is
 *  not an address. */
export function ottaJsonUrl(input: string): string | null {
    const s = input.trim();
    if (!s || s.startsWith('{') || s.startsWith('[')) return null;
    let u: URL;
    try {
        u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    } catch {
        return null;
    }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$|^localhost$|^\d{1,3}(\.\d{1,3}){3}$/i.test(u.hostname)) return null;
    // The owner key rides along; nothing else in the query does.
    const key = u.searchParams.get('key');
    u.search = key ? `?key=${encodeURIComponent(key)}` : '';
    u.hash = '';
    if (u.pathname.endsWith('.json')) return u.href;
    // An Ottabuzz address: the log, a post, the press kit, the card, or the owner's project page.
    const m = /^\/(b\/[a-z0-9-]+|p\/\d+)(?:\/|$)/i.exec(u.pathname);
    if (m) {
        u.pathname = `/${m[1]}/context.json`;
        return u.href;
    }
    u.pathname = OTTA_JSON_PATH;
    return u.href;
}

export interface FetchOptions {
    /** The ETag kept from the last read: an unchanged file answers 304 and `changed` is false. */
    etag?: string | null;
    /** The hash kept from the last read: `changed` is whether the file's differs. */
    hash?: string | null;
    /** A fetch to use instead of the global one (a Worker's service binding, a test's stub). */
    fetch?: typeof fetch;
    /** The most bytes a file may be; a bigger one is not a context file. */
    maxBytes?: number;
    signal?: AbortSignal;
}

export interface Fetched {
    /** The HTTP status, or 0 when the request itself failed. */
    status: number;
    etag: string | null;
    /** A context file, when the body was one. */
    context: OttaContext | null;
    /** A founder manifest, when the body was one. */
    founder: OttaFounder | null;
    /** Whether what came back differs from the hash given; true when none was. False on a 304. */
    changed: boolean;
}

/** The body as text, or null once it passes `max`. Read as a stream and cancelled at the cap, so a response with no
 *  or a false content-length is never held whole in memory. */
async function readCapped(res: Response, max: number): Promise<string | null> {
    if (Number(res.headers.get('content-length') ?? 0) > max) return null;
    if (!res.body) {
        const text = await res.text();
        return text.length > max ? null : text;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) return text + decoder.decode();
        bytes += value.byteLength;
        if (bytes > max) {
            await reader.cancel().catch(() => {});
            return null;
        }
        text += decoder.decode(value, { stream: true });
    }
}

/** Read a context file or a founder manifest at `url`. Never throws: a network failure is status 0. */
export async function fetchOtta(url: string, opts: FetchOptions = {}): Promise<Fetched> {
    const f = opts.fetch ?? globalThis.fetch;
    const none: Fetched = { status: 0, etag: null, context: null, founder: null, changed: false };
    let res: Response;
    try {
        res = await f(url, {
            headers: { accept: 'application/json', ...(opts.etag ? { 'if-none-match': opts.etag } : {}) },
            redirect: 'follow',
            signal: opts.signal,
        });
    } catch {
        return none;
    }
    const etag = res.headers.get('etag');
    if (res.status === 304) return { ...none, status: 304, etag };
    if (!res.ok) return { ...none, status: res.status, etag };
    const text = await readCapped(res, opts.maxBytes ?? 1 << 20).catch(() => null);
    let raw: unknown = null;
    try {
        raw = text === null ? null : JSON.parse(text);
    } catch {
        raw = null;
    }
    const context = parseOttaJson(raw);
    const founder = context ? null : parseFounderJson(raw);
    const hash = context?.hash ?? founder?.hash ?? null;
    return { status: res.status, etag, context, founder, changed: !!hash && hash !== (opts.hash ?? null) };
}

const empty = (v: unknown) =>
    v === '' ||
    v === null ||
    v === undefined ||
    (Array.isArray(v) && v.length === 0) ||
    (!!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

/** The inherit-or-pin rule, one level deep: every field of `local` that is empty takes upstream's value; a field the
 *  founder set is pinned and kept. Keys upstream does not have are kept as they are. */
export function inherit<T extends object>(local: T, upstream: Partial<T>): T {
    const out = { ...local };
    for (const k of Object.keys(upstream) as (keyof T)[]) {
        const up = upstream[k];
        if (!empty(up) && empty(out[k])) out[k] = up as T[keyof T];
    }
    return out;
}
