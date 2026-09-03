// Keep in sync with wrangler.jsonc (bindings, vars) — Always-On rule in AGENTS.MD.
export interface Env {
    /** R2 bucket holding artifacts under `{team}/{hash}`. */
    CACHE_R2: R2Bucket;
    /**
     * Worker secret. JSON keyed by token id:
     * `{ "<id>": { "sha256": "<hex of token>", "teams": ["ottabase" | "*"], "write": boolean } }`.
     * Malformed or absent → every authenticated route returns 401.
     */
    TURBO_CACHE_TOKENS?: string;
    /** "1" → PUT without `x-artifact-tag` is rejected (production). */
    REQUIRE_SIGNED_UPLOADS?: string;
    /** Upload cap in MiB (default 100). */
    MAX_ARTIFACT_MB?: string;
}
