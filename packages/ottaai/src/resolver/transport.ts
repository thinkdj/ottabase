// ============================================================
// @ottabase/ottaai — TransportAdapter seam
// ============================================================
// Resolution ends at a DECISION, not a vendor client. A pluggable adapter turns
// (merged config, task options) into a caller. That keeps the CREDENTIAL PLANE
// vendor-neutral and dictates the schema.
//
// The adapter interface is NARROW AND NORMALISING, not thin. Stream and error
// shapes are vendor concerns, so normalising them is the adapter's job — which is
// exactly where the vendor-neutrality claim gets qualified.
// ============================================================

import type { AiCapability, MergedTransportConfig, PlatformAiConfig } from '../types';

/** A normalised, non-streaming completion. */
export interface AiCallResult {
    text: string;
    /** Token accounting. `null` when the provider genuinely did not report it. */
    tokens: { input: number; output: number; cached?: number } | null;
    model: string;
    provider: string;
    /** Raw provider payload, for callers that need more than `text`. */
    raw: unknown;
}

/** A normalised embedding response. One vector is returned for each input, in order. */
export interface AiEmbeddingResult {
    vectors: number[][];
    /** Input-token accounting. `null` when the provider genuinely did not report it. */
    tokens: { input: number } | null;
    model: string;
    provider: string;
    /** Raw provider payload, for callers that need provider-specific metadata. */
    raw: unknown;
}

/** A normalised transport failure. Adapters must not leak SDK error objects across this line. */
export interface AiCallError {
    /** Upstream HTTP status, when there was one. */
    statusCode?: number;
    /** Provider-specific code string, when the provider supplies one. */
    providerCode?: string;
    /** Whether the adapter believes a retry could succeed. Advisory only. */
    retryable: boolean;
    /** Already redacted by the adapter. */
    message: string;
}

/** Typed signals a stream surfaces, so the core never parses raw SSE bytes. */
export type AiStreamEvent =
    | { type: 'delta'; text: string }
    | { type: 'usage'; tokens: { input: number; output: number; cached?: number } }
    | { type: 'error'; error: AiCallError }
    | { type: 'done'; model?: string };

/**
 * A single call.
 *
 * THE SUPPORTED SURFACE IS TEXT CHAT COMPLETION, and `content: string` is where that is
 * decided. Images, audio, tool calls, embeddings and structured provider outputs have no
 * representation here, so no adapter can send them however capable the selected model is.
 *
 * That is NOT the same axis as the registry's `AiCapability` list. Capabilities are
 * MODEL-SELECTION METADATA — they decide which credential is eligible for a task. They do
 * not widen this type, and declaring `requiredCapabilities: ['vision']` on a task buys a
 * stricter eligibility filter, not the ability to attach an image.
 *
 * Widening this is a real project: every wire dialect in `transports/wire.ts` needs a
 * multimodal branch, `AiCallResult` needs non-text parts, and the stream events need
 * non-text deltas. Do all of it in one change, or the capability claim outruns the contract
 * again.
 */
export interface AiCallOptions {
    messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; name?: string }>;
    temperature?: number;
    maxTokens?: number;
    /** Per-call model override — beats every other rung of the model chain. */
    model?: string;
    /** Extra provider-specific body fields. */
    extra?: Record<string, unknown>;
    /** Milliseconds. */
    timeout?: number;
    signal?: AbortSignal;
    /**
     * Bypass any response cache. Set by the instrumented client for validation calls —
     * a cached success will happily "validate" a key that was revoked five minutes ago.
     */
    skipCache?: boolean;
    /** Response cache TTL in seconds. Ignored for BYOK-sourced calls. */
    cacheTtlSeconds?: number;
    /** Non-secret tags forwarded to the transport's own logging. */
    metadata?: Record<string, string>;
}

/**
 * A single embedding request.
 *
 * This is intentionally a separate operation from chat completion. Embeddings have no
 * roles, no streamed text deltas and no output-token count, so putting them in
 * `AiCallOptions` would make both contracts less truthful.
 */
export interface AiEmbedOptions {
    /** One text value, or a batch whose result vectors preserve this order. */
    input: string | string[];
    /** Per-call model override. It may narrow the resolved model, never switch providers. */
    model?: string;
    /** Optional vector dimensionality for providers that support it (OpenAI text-embedding-3). */
    dimensions?: number;
    /** Milliseconds. */
    timeout?: number;
    signal?: AbortSignal;
    /** Bypass any response cache. */
    skipCache?: boolean;
    /** Response cache TTL in seconds. Ignored for BYOK-sourced calls. */
    cacheTtlSeconds?: number;
    /** Non-secret tags forwarded to the transport's own logging. */
    metadata?: Record<string, string>;
}

/** The raw client an adapter produces. The core wraps this in its instrumented decorator. */
export interface RawAiClient {
    complete(options: AiCallOptions): Promise<{ ok: true; result: AiCallResult } | { ok: false; error: AiCallError }>;
    /**
     * Optional because a transport may deliberately support chat before it has a verified
     * embedding wire contract. The instrumented client turns absence into a typed refusal;
     * it never guesses at a provider endpoint.
     */
    embed?(
        options: AiEmbedOptions,
    ): Promise<{ ok: true; result: AiEmbeddingResult } | { ok: false; error: AiCallError }>;
    /**
     * Stream a completion.
     *
     * TRAP AN ADAPTER MUST CLOSE: OpenAI-shaped providers report NO token usage on
     * streamed responses by default. It must be opted into and arrives in a final chunk.
     * An adapter therefore sets the usage-inclusion option UNCONDITIONALLY whenever
     * streaming — a caller-opt-in version reproduces "zero tokens metered for most
     * traffic" in every consuming app.
     *
     * Likewise, an auth failure occurring AFTER streaming headers are sent arrives INSIDE
     * a 200 response, so it must surface as an `error` event rather than a status code.
     */
    stream(options: AiCallOptions): AsyncIterable<AiStreamEvent>;
}

export interface TransportAdapter {
    /** Stable name, surfaced in the redacted config summary and in events. */
    readonly name: string;

    /**
     * Whether the merged config can actually issue a request.
     *
     * ADAPTER-DECLARED, NOT CORE-DECLARED. "Account and gateway must be present" is one
     * vendor's shape; hard-coding it into the core makes the transport seam fiction and
     * guarantees the first direct-to-provider adapter cannot satisfy the check.
     *
     * DELIBERATELY UNDER-STRICT: it must NOT require a provider key (gateway-billed
     * inference has none) or a model (it can arrive per request).
     */
    isComplete(config: MergedTransportConfig): boolean;

    /** Build the raw client. Called once per resolution, never cached across requests. */
    createClient(config: MergedTransportConfig): RawAiClient;

    /** Capabilities the adapter itself cannot serve, regardless of provider. Optional. */
    readonly unsupportedCapabilities?: readonly AiCapability[];

    /**
     * Provider ids this transport cannot serve UNDER THIS OPERATOR'S CONFIGURATION.
     *
     * Distinct from a provider the transport does not support at all (that is a static fact,
     * expressed as `tenantSelectable: false` in the registry). This is the DEPLOYMENT-DEPENDENT
     * case: Azure OpenAI is fully supported, but its URL is built from operator-only
     * `resourceName` / `deploymentName` / `apiVersion`, so on a deployment that never set them
     * every Azure call is `MERGE_INCOMPLETE` — while the settings form cheerfully offers Azure
     * and accepts the tenant's key. The tenant sees a saved, listed, tested-looking credential
     * that silently never runs.
     *
     * `createAiProvisioning` calls this ONCE at composition and removes what it returns from
     * TENANT SELECTION (form, `/providers`, every write path, the verify endpoint). It does not
     * unregister the provider, so a platform-path deployment and the keyless-mismatch guard are
     * unaffected.
     *
     * Optional: a transport with no deployment-dependent providers simply omits it.
     */
    unservableProviders?(platform: PlatformAiConfig): string[];
}
