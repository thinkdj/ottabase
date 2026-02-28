// ============================================================
// Recraft Handler Types
// ============================================================

/**
 * Route context passed to all Recraft handlers.
 * Mirrors the framework's ApiRouteContext with env typed for our needs.
 */
export interface RecraftRouteContext {
    request: Request;
    env: RecraftEnv;
    url: URL;
    route: string;
    method: string;
    corsHeaders: Record<string, string>;
}

/**
 * Environment bindings required by Recraft.
 * The app's CloudflareEnv extends this via the actual wrangler bindings.
 */
export interface RecraftEnv {
    /** D1 database binding */
    OBCF_D1: unknown;
    /** R2 bucket for storing generated images */
    OBCF_R2: {
        put(key: string, value: ArrayBuffer | ReadableStream, options?: Record<string, unknown>): Promise<unknown>;
        get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; body: ReadableStream } | null>;
        delete(key: string): Promise<void>;
    };
    /** Cloudflare Workers AI binding */
    AI?: {
        run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
    };
    /** R2 public URL prefix */
    R2_PUBLIC_URL?: string;
    /** Optional: Cloudflare AI Gateway config (set as env vars) */
    RECRAFT_AI_GATEWAY_ACCOUNT_ID?: string;
    RECRAFT_AI_GATEWAY_ID?: string;
    RECRAFT_AI_GATEWAY_PROVIDER?: string;
    RECRAFT_AI_GATEWAY_API_KEY?: string;
}

/** Utility: read JSON from a request, defaulting to empty object */
export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
    try {
        return (await request.json()) as T;
    } catch {
        return {} as T;
    }
}
