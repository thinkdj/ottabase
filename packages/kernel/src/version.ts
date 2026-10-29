// ============================================================
// @ottabase/kernel - the deployed Worker version
// ============================================================
// Cloudflare's version metadata binding (`"version_metadata": { "binding": "OBCF_VERSION" }` in
// wrangler.jsonc) tells a Worker which version of itself is running: the version id, the tag
// it was deployed with (`wrangler deploy --tag <short sha>`), and when that version was made.
// Readiness and the Fleet report show it, so an operator can tell which build answers.
// ============================================================

/** Which build is running. `tag` is the deploy tag (the commit, when CI tags it); null if untagged. */
export interface DeploymentVersion {
    id: string;
    tag: string | null;
    /** ISO time the version was created; null when the runtime does not say. */
    createdAt: string | null;
}

/**
 * Read the version metadata binding. Null when it is unbound or empty, which is the case in
 * tests and can be in local dev, so callers simply show nothing.
 */
export function readDeploymentVersion(binding: unknown): DeploymentVersion | null {
    if (!binding || typeof binding !== 'object') return null;
    const meta = binding as { id?: unknown; tag?: unknown; timestamp?: unknown };
    if (typeof meta.id !== 'string' || !meta.id) return null;
    const tag = typeof meta.tag === 'string' && meta.tag ? meta.tag : null;
    const createdAt = typeof meta.timestamp === 'string' && meta.timestamp ? meta.timestamp : null;
    return { id: meta.id, tag, createdAt };
}
