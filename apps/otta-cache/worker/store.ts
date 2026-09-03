/**
 * R2 artifact store. The only file that touches the bucket. Takes no Request, returns no Response,
 * so a non-turbo consumer later is a file move.
 */

export interface ArtifactMeta {
    /** Task duration in ms (x-artifact-duration). */
    duration?: number;
    /** Client-side HMAC tag (x-artifact-tag), stored and returned byte-for-byte. */
    tag?: string;
    /** Git HEAD sha at build time (x-artifact-sha). */
    sha?: string;
    /** Hash of uncommitted changes (x-artifact-dirty-hash). */
    dirtyHash?: string;
}

export interface ArtifactHead {
    size: number;
    meta: ArtifactMeta;
}

export interface ArtifactBody extends ArtifactHead {
    body: ReadableStream;
}

export const objectKey = (team: string, hash: string): string => `${team}/${hash}`;

/** Only whitelisted fields are ever written, all as strings (R2 customMetadata is string-only). */
export function toCustomMetadata(meta: ArtifactMeta): Record<string, string> {
    const out: Record<string, string> = {};
    if (meta.duration !== undefined) out.duration = String(meta.duration);
    if (meta.tag !== undefined) out.tag = meta.tag;
    if (meta.sha !== undefined) out.sha = meta.sha;
    if (meta.dirtyHash !== undefined) out.dirtyHash = meta.dirtyHash;
    return out;
}

function fromObject(obj: R2Object): ArtifactHead {
    const m = obj.customMetadata ?? {};
    const duration = m.duration === undefined ? undefined : Number(m.duration);
    return {
        size: obj.size,
        meta: {
            duration: Number.isFinite(duration) ? duration : undefined,
            tag: m.tag,
            sha: m.sha,
            dirtyHash: m.dirtyHash,
        },
    };
}

export async function head(bucket: R2Bucket, team: string, hash: string): Promise<ArtifactHead | null> {
    const obj = await bucket.head(objectKey(team, hash));
    return obj ? fromObject(obj) : null;
}

export async function get(bucket: R2Bucket, team: string, hash: string): Promise<ArtifactBody | null> {
    const obj = await bucket.get(objectKey(team, hash));
    return obj ? { ...fromObject(obj), body: obj.body } : null;
}

/**
 * Create-only write. `If-None-Match: *` makes R2 refuse (return null) when the key exists, so a
 * second writer can never overwrite the first, without a racy pre-HEAD.
 */
export async function put(
    bucket: R2Bucket,
    team: string,
    hash: string,
    body: ReadableStream,
    meta: ArtifactMeta,
): Promise<'created' | 'exists'> {
    const result = await bucket.put(objectKey(team, hash), body, {
        onlyIf: new Headers({ 'If-None-Match': '*' }),
        httpMetadata: { contentType: 'application/octet-stream' },
        customMetadata: toCustomMetadata(meta),
    });
    return result ? 'created' : 'exists';
}
