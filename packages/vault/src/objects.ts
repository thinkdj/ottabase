// ============================================================
// @ottabase/vault — snapshots of the bucket's own objects
// ============================================================
// The uploads, media and files an app keeps in R2 are part of its state as much as its
// rows. A snapshot lists every object of one source bucket under the chosen prefixes (key,
// etag, size, when it was uploaded, its content type) into `objects.<source>.ndjson` beside
// the tables, and copies each object's bytes into the vault bucket's content store keyed by
// etag, once: a second snapshot of an unchanged bucket copies nothing. Restore puts every listed object back under its key, skipping the
// ones whose live etag already matches. Pruning deletes content no remaining snapshot names.
// ============================================================

import type { BackupObjects, BucketLike, RestoredObjects } from './types';

export interface ObjectEntry {
    key: string;
    etag: string;
    size: number;
    uploaded: string | null;
    contentType: string | null;
}

/** Where an etag's bytes live: `<prefix>/<appId>/_objects/<etag>`. */
export const contentKey = (store: string, etag: string): string => `${store}${etag.replace(/[^A-Za-z0-9_.-]/g, '_')}`;

export async function* listAll(bucket: BucketLike, prefix: string) {
    let cursor: string | undefined;
    do {
        const page = await bucket.list({ prefix, cursor, include: ['httpMetadata'] });
        for (const object of page.objects) yield object;
        cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
}

/** Copy one object's bytes and metadata to another key, as R2 copies: a get streamed into a put. */
async function copy(from: BucketLike, key: string, to: BucketLike, target: string): Promise<boolean> {
    const object = await from.get(key);
    if (!object || !object.body) return false;
    await to.put(target, object.body, {
        ...(object.httpMetadata ? { httpMetadata: object.httpMetadata } : {}),
        ...(object.customMetadata ? { customMetadata: object.customMetadata } : {}),
    });
    return true;
}

export interface SnapshotInput {
    /** The bucket whose objects are listed and read. */
    source: BucketLike;
    /** The bucket the snapshot and the content store are written to. */
    vault: BucketLike;
    /** The content store prefix, ending in `/`. */
    store: string;
    /** Prefixes to snapshot; `''` for the whole bucket. */
    prefixes: string[];
    /** Prefixes left out, the vault's own among them. */
    exclude: string[];
    /** Where the listing goes: the backup's directory. */
    dir: string;
    /** The source's name: the listing is `objects.<name>.ndjson`. */
    name: string;
}

export async function snapshotObjects(input: SnapshotInput): Promise<BackupObjects> {
    const stored = new Set<string>();
    for await (const object of listAll(input.vault, input.store)) stored.add(object.key);
    const lines: string[] = [];
    const seen = new Set<string>();
    let bytes = 0;
    let copied = 0;
    // ponytail: every object is listed and new ones copied in one pass; a bucket whose first
    // snapshot outgrows a cron tick wants this split across runs (a Workflow, or a cursor in
    // the manifest). Steady state copies only what changed.
    for (const prefix of input.prefixes) {
        for await (const object of listAll(input.source, prefix)) {
            if (seen.has(object.key) || input.exclude.some((excluded) => object.key.startsWith(excluded))) continue;
            seen.add(object.key);
            const etag = object.etag ?? '';
            if (!etag) continue;
            const target = contentKey(input.store, etag);
            if (!stored.has(target)) {
                if (!(await copy(input.source, object.key, input.vault, target))) continue;
                stored.add(target);
                copied += 1;
            }
            const entry: ObjectEntry = {
                key: object.key,
                etag,
                size: object.size,
                uploaded: object.uploaded ? new Date(object.uploaded).toISOString() : null,
                contentType: object.httpMetadata?.contentType ?? null,
            };
            lines.push(JSON.stringify(entry));
            bytes += object.size;
        }
    }
    const key = `${input.dir}objects.${input.name}.ndjson`;
    await input.vault.put(key, lines.length ? `${lines.join('\n')}\n` : '', {
        httpMetadata: { contentType: 'application/x-ndjson' },
    });
    return { key, count: lines.length, bytes, copied };
}

export function parseEntries(text: string): ObjectEntry[] {
    return text
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as ObjectEntry);
}

export interface RestoreInput {
    source: BucketLike;
    vault: BucketLike;
    store: string;
    entries: ObjectEntry[];
}

/** Put every listed object back; one whose live etag already matches is left alone. */
export async function restoreObjects(input: RestoreInput): Promise<RestoredObjects> {
    const result: RestoredObjects = { restored: 0, skipped: 0, missing: [] };
    for (const entry of input.entries) {
        const live = await input.source.get(entry.key);
        if (live?.etag === entry.etag) {
            result.skipped += 1;
            continue;
        }
        if (await copy(input.vault, contentKey(input.store, entry.etag), input.source, entry.key)) result.restored += 1;
        else result.missing.push(entry.key);
    }
    return result;
}

/** Delete content no listed snapshot names. Returns how many objects went. */
export async function collectGarbage(vault: BucketLike, store: string, referenced: Set<string>): Promise<number> {
    const victims: string[] = [];
    for await (const object of listAll(vault, store)) {
        if (!referenced.has(object.key)) victims.push(object.key);
    }
    for (let i = 0; i < victims.length; i += 1000) await vault.delete(victims.slice(i, i + 1000));
    return victims.length;
}
