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

import type { AiMessage, AiResponseFormat } from '../content';
import type { AiErrorCode } from '../errors';
import type { AiCapability, MergedTransportConfig, PlatformAiConfig } from '../types';

/** A normalised, non-streaming completion. */
export interface AiCallResult {
    /** The reply text. Under `responseFormat`, the JSON as the provider sent it. */
    text: string;
    /**
     * The parsed reply, present exactly when the call set `responseFormat`.
     *
     * The instrumented client guarantees it: a JSON call whose reply does not parse to an
     * object is returned as `INVALID_RESPONSE`, never as `ok` with this missing.
     */
    json?: Record<string, unknown>;
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
    /** Provider-specific code string, when the provider supplies one. Never interpreted by the core. */
    providerCode?: string;
    /**
     * The package's own classification, for a failure decided WITHOUT an upstream response —
     * a route refusing images, a quota refusal, a preflight refusal. Kept apart from
     * `providerCode` so a provider's string can never be mistaken for one of these.
     */
    code?: AiErrorCode;
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
 * THE SUPPORTED SURFACE IS CHAT COMPLETION WITH TEXT AND IMAGE INPUT, AND TEXT OR JSON
 * OUTPUT. Audio, tool calls and image OUTPUT have no representation here, so no adapter can
 * send them however capable the selected model is.
 *
 * Images and JSON are CAPABILITY-GATED. A call carrying an image part needs `vision`, a call
 * with `responseFormat` needs `json`, and the instrumented client refuses either one unless
 * the TASK declares it in `requiredCapabilities` — that declaration is what filtered the
 * credential and the platform model during resolution, so without it the call could be sent
 * to a model that cannot read the image.
 */
export interface AiCallOptions {
    messages: AiMessage[];
    /** Ask for a JSON object. See `AiResponseFormat` — validate the shape yourself. */
    responseFormat?: AiResponseFormat;
    temperature?: number;
    /** Output budget. Falls back to the task's `maxTokens`. A JSON reply cut off by it is `INVALID_RESPONSE`. */
    maxTokens?: number;
    /**
     * Per-call model override — beats every other rung of the model chain. The instrumented
     * client re-checks the task's `requiredCapabilities` against it, because resolution
     * filtered a DIFFERENT model.
     */
    model?: string;
    /**
     * Extra provider-specific body fields.
     *
     * Cannot set what the transport owns — model, messages, stream, and every output-format
     * field (`response_format`, Anthropic `tools`/`tool_choice`, Gemini `responseMimeType` /
     * `responseSchema`). Use `responseFormat` for JSON.
     */
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

    /**
     * Capabilities this merged config's ROUTE cannot serve, whatever the model can do.
     *
     * The registry says what a MODEL can do; this says what the WIRE carrying it can. They
     * differ: `openai/gpt-4o-mini` reads images, but Cloudflare's Unified Billing REST endpoint
     * documents no image input. Without this, status and the gate report a vision task as
     * available while every call is refused.
     *
     * The resolver checks a task's `requiredCapabilities` against it on every path (tenant,
     * platform fall-through, degraded retry), so an unservable route resolves
     * `CAPABILITY_UNMET` instead of producing a client that can never succeed. Optional: a
     * transport whose every route serves everything omits it.
     */
    unsupportedCapabilitiesFor?(config: MergedTransportConfig): readonly AiCapability[];

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
