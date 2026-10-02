// ============================================================
// @ottabase/ottaai — The instrumented client
// ============================================================
// THE LARGEST STRUCTURAL DECISION IN THE DESIGN, and the one most likely to be
// got wrong by omission. Seven behaviours must intercept every call AFTER the
// resolver returns:
//
//   1. degradation retry            5. runtime error classification
//   2. attribution records          6. the validation cache-skip
//   3. health writes                7. the pre-call quota check
//   4. failing-key detection w/ dedupe
//
// A CORE DECORATOR, NOT SEVEN COPIES IN EVERY ADAPTER. Putting these in the
// adapter would make every adapter reimplement degradation, metering, health and
// dedupe — and the second adapter becomes the bulk of the work.
// ============================================================

import { capabilitiesForCall, parseJsonObject, validateCallContent } from '../content';
import { AI_ERROR_CODES, classifyUpstreamStatus, isAbortError, type AiErrorCode } from '../errors';
import type { AiCapability } from '../registry';
import { redactSecrets } from '../secret';
import type { DegradationPolicy, MergedTransportConfig, ResolutionSource } from '../types';
import type { EventSink } from './events';
import type {
    AiCallError,
    AiCallOptions,
    AiCallResult,
    AiEmbedOptions,
    AiEmbeddingResult,
    AiStreamEvent,
    RawAiClient,
} from './transport';

export interface QuotaCheck {
    /**
     * Called AFTER resolution, BEFORE the outbound call — `source` is what scopes the
     * quota and `source` is only known after resolution.
     *
     * Return `false` to refuse the call. Actuals are recorded post-call by the host from
     * the `call.completed` event; the package deliberately does NOT build two-phase
     * reservation (that costs a durable per-tenant counter with contention on the
     * inference path, and the stated tolerance — "a free tier may overrun by roughly the
     * in-flight concurrency count" — is what makes it unnecessary).
     */
    (input: {
        source: ResolutionSource;
        taskKey: string;
        organizationId: string | null;
        userId: string | null;
    }): boolean | Promise<boolean>;
}

export interface InstrumentedClientDeps {
    raw: RawAiClient;
    /** The platform-only client, held for the ONE degradation retry. Null when unavailable. */
    platformFallback: RawAiClient | null;
    /**
     * The merged config the platform fallback was built from.
     *
     * Carried separately so a degraded call is ATTRIBUTED to the provider and model that
     * actually served it, rather than to the tenant's.
     */
    platformConfig?: Pick<MergedTransportConfig, 'provider' | 'model'> | null;
    config: MergedTransportConfig;
    source: Exclude<ResolutionSource, null>;
    taskKey: string;
    /**
     * The task's `requiredCapabilities`. A call needing a capability the task did not declare
     * (an image without `vision`, `responseFormat` without `json`) is refused — the
     * declaration is what filtered the credential and the platform model during resolution.
     */
    taskCapabilities: readonly AiCapability[];
    /** The task's default output budget, applied when a call sets none. */
    taskMaxTokens?: number;
    /**
     * Capabilities of a per-call model ref under this config's provider, or null when the
     * registry does not know it. Used to re-check a per-call `model` against the task.
     */
    capabilitiesForModel?: (modelRef: string) => readonly AiCapability[] | null;
    /** The task's `unknownModelPolicy`, applied to a per-call model the registry does not know. */
    unknownModelPolicy?: 'deny' | 'allow';
    degradation: DegradationPolicy;
    emit: EventSink;
    defer: (promise: Promise<unknown>) => void;
    quota?: QuotaCheck;
    /** Health writer. Best-effort; routed through `defer`. */
    recordOutcome?: (input: { ok: boolean; at: number; errorCode?: string | null }) => Promise<void>;
    /** Response cache TTL for this task. Forced off for BYOK-sourced calls. */
    responseCacheTtlSeconds?: number;
    /** Every secret live for this call, used to redact upstream messages. */
    redactionSentinels: Array<string | null | undefined>;
    /** Injectable clock, so tests are deterministic. */
    now?: () => number;
    /** Injectable correlation-id source; the default uses Web Crypto. */
    correlationId?: () => string;
}

export interface AiClient {
    complete(
        options: AiCallOptions,
    ): Promise<{ ok: true; result: AiCallResult } | { ok: false; code: AiErrorCode; message: string; status?: number }>;
    embed(
        options: AiEmbedOptions,
    ): Promise<
        { ok: true; result: AiEmbeddingResult } | { ok: false; code: AiErrorCode; message: string; status?: number }
    >;
    stream(options: AiCallOptions): AsyncIterable<AiStreamEvent>;
    /** Redacted provenance, safe to log. */
    readonly source: Exclude<ResolutionSource, null>;
}

function defaultCorrelationId(): string {
    const uuid = globalThis.crypto?.randomUUID;
    return typeof uuid === 'function' ? uuid.call(globalThis.crypto) : `cid-${Date.now()}`;
}

/** Coarse error class used to dedupe failing-key notifications. */
function errorClassOf(code: AiErrorCode): string {
    return code === AI_ERROR_CODES.INVALID_KEY ? 'auth' : code === AI_ERROR_CODES.RATE_LIMITED ? 'throttle' : 'other';
}

export function createInstrumentedClient(deps: InstrumentedClientDeps): AiClient {
    const now = deps.now ?? (() => Date.now());
    const newCorrelationId = deps.correlationId ?? defaultCorrelationId;
    const provenance = deps.config.provenance;

    /**
     * Response caching is opt-in per task, and a BYOK-sourced call is NEVER cached.
     *
     * Nothing forces a completion cache key to include a tenant dimension, so a cache keyed
     * on prompt+model across a multi-tenant deployment serves tenant A's completion to
     * tenant B — worse under BYOK, because the cached response was generated and PAID FOR
     * under A's provider contract. The caller cannot opt back in: a per-call
     * `cacheTtlSeconds` is IGNORED on the byok path, not merely defaulted away.
     */
    const byokSourced = deps.source === 'byok';
    const cacheTtl = byokSourced ? undefined : deps.responseCacheTtlSeconds;

    function resolveCacheTtl(options: Pick<AiCallOptions, 'skipCache' | 'cacheTtlSeconds'>): number | undefined {
        if (options.skipCache) return undefined;
        if (byokSourced) return undefined;
        return options.cacheTtlSeconds ?? cacheTtl;
    }

    function classify(error: AiCallError): { code: AiErrorCode; message: string } {
        // A failure the adapter classified itself, with no upstream response (a route refusing
        // images it cannot carry). Read from `code`, never from the provider's `providerCode`.
        if (error.code) {
            return { code: error.code, message: redactSecrets(error.message, deps.redactionSentinels) };
        }
        if (error.statusCode === undefined && /abort|timeout/i.test(error.message)) {
            return { code: AI_ERROR_CODES.TIMEOUT, message: 'The request to the provider timed out.' };
        }
        const code = classifyUpstreamStatus(error.statusCode);
        // The `ERROR` arm must not re-open the leak the return shape closes: provider 4xx
        // bodies and SDK error objects routinely echo the Authorization header.
        const message = redactSecrets(error.message, deps.redactionSentinels);
        return { code, message };
    }

    function emitCompleted(input: {
        correlationId: string;
        startedAt: number;
        result?: AiCallResult | AiEmbeddingResult;
        code?: AiErrorCode;
        source: Exclude<ResolutionSource, null>;
        operation?: 'chat' | 'embedding';
    }): void {
        // A DEGRADED call went out on the PLATFORM client, against the platform provider and
        // platform model — reporting the tenant's provider/model with `source: 'platform'`
        // would bill the operator's spend to a provider and a model that were never called,
        // and any cost report grouped by provider would be silently wrong.
        const degraded = input.source === 'platform' && deps.source === 'byok';
        const provider = degraded ? (deps.platformConfig?.provider ?? deps.config.provider) : deps.config.provider;
        const model = degraded ? (deps.platformConfig?.model ?? null) : deps.config.model;
        const tokens = input.result?.tokens;

        deps.emit('call.completed', {
            correlationId: input.correlationId,
            // On the degraded path the tenant's credential did not serve the call.
            credentialId: degraded ? null : provenance.credentialId,
            source: input.source,
            provider,
            model,
            taskKey: deps.taskKey,
            operation: input.operation ?? 'chat',
            appId: provenance.appId,
            organizationId: provenance.organizationId,
            userId: provenance.userId,
            inputTokens: tokens?.input ?? null,
            outputTokens: tokens && 'output' in tokens ? (tokens.output ?? null) : null,
            cachedTokens: tokens && 'cached' in tokens ? (tokens.cached ?? null) : null,
            latencyMs: now() - input.startedAt,
            // Keyed on the CODE, not on the result: an `INVALID_RESPONSE` call carries both — the
            // provider was paid for the tokens, and the caller still got an error.
            outcome: input.code ? 'error' : 'success',
            ...(input.code ? { errorCode: input.code } : {}),
        });
    }

    function writeHealth(ok: boolean, code?: AiErrorCode): void {
        if (!deps.recordOutcome || !provenance.credentialId) return;
        // A request the route refused before sending says nothing about the KEY. Counting it
        // would mark a healthy credential as failing because a caller attached an image.
        if (code === AI_ERROR_CODES.UNSUPPORTED_OPERATION) return;
        // Best-effort NEEDS A MECHANISM, not an adjective: on a Workers-style runtime a
        // fire-and-forget promise is either cancelled at response or it delays the call.
        deps.defer(deps.recordOutcome({ ok, at: now(), errorCode: code ?? null }).catch(() => {}));
        if (!ok && code) {
            deps.emit('credential.health_changed', {
                credentialId: provenance.credentialId,
                errorClass: errorClassOf(code),
                // The store owns the counter; the event carries the class so the host can
                // notify. Detection + dedupe are package-side (see createDedupedHealthSink).
                consecutiveFailures: 1,
                provider: deps.config.provider,
                keyHint: '',
                appId: provenance.appId,
                organizationId: provenance.organizationId,
                userId: provenance.userId,
            });
        }
    }

    /**
     * Refuse a call that can never be served correctly, BEFORE quota and before any request.
     *
     * Validation is the package's, not each adapter's, so a malformed image is the same
     * `VALIDATION` error on every transport. The capability checks are developer errors, hence
     * `CONFIGURATION`: the fix is one line in the task declaration or the call, not a
     * different input.
     */
    function preflight(options: AiCallOptions): { code: AiErrorCode; message: string } | null {
        const valid = validateCallContent(options);
        if (!valid.ok) return { code: AI_ERROR_CODES.VALIDATION, message: valid.message };
        const undeclared = capabilitiesForCall(options).filter((c) => !deps.taskCapabilities.includes(c));
        if (undeclared.length > 0) {
            return {
                code: AI_ERROR_CODES.CONFIGURATION,
                message:
                    `Task "${deps.taskKey}" must declare requiredCapabilities: [${undeclared.map((c) => `'${c}'`).join(', ')}] ` +
                    'to send this call — the declaration is what makes resolution pick a model that can serve it.',
            };
        }
        // A per-call model bypasses the eligibility filter resolution ran on ANOTHER model, so
        // the task's capabilities are re-checked against it here.
        if (options.model?.trim() && deps.taskCapabilities.length > 0 && deps.capabilitiesForModel) {
            const capabilities = deps.capabilitiesForModel(options.model);
            const missing =
                capabilities === null
                    ? deps.unknownModelPolicy === 'allow'
                        ? []
                        : [...deps.taskCapabilities]
                    : deps.taskCapabilities.filter((c) => !capabilities.includes(c));
            if (missing.length > 0) {
                return {
                    code: AI_ERROR_CODES.CONFIGURATION,
                    message:
                        capabilities === null
                            ? `Model "${options.model}" is not in the provider registry, so it cannot be shown to ` +
                              `serve task "${deps.taskKey}" (needs ${deps.taskCapabilities.join(', ')}).`
                            : `Model "${options.model}" lacks ${missing.join(', ')}, which task "${deps.taskKey}" requires.`,
                };
            }
        }
        return null;
    }

    /** The call as sent: the task's output budget unless the call set its own, and the cache TTL. */
    function prepare(options: AiCallOptions): AiCallOptions {
        return {
            ...options,
            maxTokens: options.maxTokens ?? deps.taskMaxTokens,
            cacheTtlSeconds: resolveCacheTtl(options),
        };
    }

    /**
     * The JSON guarantee: a `responseFormat` call returns a parsed object or an error, never
     * `ok` with nothing to read. Parsed HERE rather than in each adapter, so every transport
     * gives the same answer for the same reply.
     */
    function withJson(
        options: AiCallOptions,
        result: AiCallResult,
    ): { ok: true; result: AiCallResult } | { ok: false; code: AiErrorCode; message: string } {
        if (!options.responseFormat) return { ok: true, result };
        const json = result.json ?? parseJsonObject(result.text);
        if (json) return { ok: true, result: { ...result, json } };
        return {
            ok: false,
            code: AI_ERROR_CODES.INVALID_RESPONSE,
            message:
                'The provider reply was not a JSON object. It may have been cut off — consider a larger maxTokens.',
        };
    }

    /** Settle a successful upstream response: health, JSON guarantee, metering. */
    function settleSuccess(
        options: AiCallOptions,
        result: AiCallResult,
        correlationId: string,
        startedAt: number,
        source: Exclude<ResolutionSource, null>,
    ): { ok: true; result: AiCallResult } | { ok: false; code: AiErrorCode; message: string } {
        const settled = withJson(options, result);
        // Metered either way — the provider billed for the tokens even when the reply is unusable.
        emitCompleted({ correlationId, startedAt, result, source, ...(settled.ok ? {} : { code: settled.code }) });
        return settled;
    }

    /**
     * DEGRADATION — exactly one retry, to the PLATFORM client the decorator already holds.
     * It does NOT re-enter the state machine and does NOT re-select a tenant credential.
     *
     * | constraint  | rule                                                                    |
     * | ----------- | ----------------------------------------------------------------------- |
     * | trigger     | 401/403 ONLY                                                            |
     * | never on    | 429 (converts a tenant's rate limit into your bill), 5xx, timeout/abort |
     * | mode        | impossible under `byok` — rejected at composition, not checked here     |
     * | attempts    | exactly one                                                             |
     * | streaming   | reachable only before the first byte                                    |
     */
    function shouldDegrade(status: number | undefined): boolean {
        if (deps.degradation !== 'platform-on-auth-error') return false;
        if (deps.source !== 'byok') return false;
        if (!deps.platformFallback) return false;
        return status === 401 || status === 403;
    }

    return {
        source: deps.source,

        async complete(options) {
            const correlationId = newCorrelationId();
            const startedAt = now();

            const refused = preflight(options);
            if (refused) {
                emitCompleted({ correlationId, startedAt, code: refused.code, source: deps.source });
                return { ok: false, ...refused };
            }

            if (deps.quota) {
                const allowed = await deps.quota({
                    source: deps.source,
                    taskKey: deps.taskKey,
                    organizationId: provenance.organizationId,
                    userId: provenance.userId,
                });
                if (!allowed) {
                    deps.emit('quota.exceeded', {
                        taskKey: deps.taskKey,
                        source: deps.source,
                        appId: provenance.appId,
                        organizationId: provenance.organizationId,
                        userId: provenance.userId,
                    });
                    return {
                        ok: false,
                        code: AI_ERROR_CODES.RATE_LIMITED,
                        message: 'Your AI usage quota for this period has been reached.',
                    };
                }
            }

            const call = prepare(options);

            let response;
            try {
                response = await deps.raw.complete(call);
            } catch (thrown) {
                // An adapter that throws instead of returning is still handled — the
                // conformance suite asserts adapters return, but a bug here must not 500.
                const code = isAbortError(thrown) ? AI_ERROR_CODES.TIMEOUT : AI_ERROR_CODES.ERROR;
                const message = redactSecrets(
                    thrown instanceof Error ? thrown.message : String(thrown),
                    deps.redactionSentinels,
                );
                writeHealth(false, code);
                emitCompleted({ correlationId, startedAt, code, source: deps.source });
                return { ok: false, code, message };
            }

            if (response.ok) {
                // The KEY worked even when the reply is unusable JSON — health is about the key.
                writeHealth(true);
                return settleSuccess(options, response.result, correlationId, startedAt, deps.source);
            }

            const { code, message } = classify(response.error);

            if (shouldDegrade(response.error.statusCode)) {
                deps.emit('call.degraded', {
                    correlationId,
                    credentialId: provenance.credentialId,
                    taskKey: deps.taskKey,
                    fromSource: 'byok',
                    toSource: 'platform',
                    triggerStatus: response.error.statusCode!,
                    appId: provenance.appId,
                    organizationId: provenance.organizationId,
                    userId: provenance.userId,
                });
                writeHealth(false, code);
                const retry = await deps.platformFallback!.complete(call);
                if (retry.ok) {
                    // Usage is attributed to the PLATFORM, not the tenant.
                    return settleSuccess(options, retry.result, correlationId, startedAt, 'platform');
                }
                const retryClassified = classify(retry.error);
                emitCompleted({ correlationId, startedAt, code: retryClassified.code, source: 'platform' });
                return { ok: false, ...retryClassified, status: retry.error.statusCode };
            }

            writeHealth(false, code);
            emitCompleted({ correlationId, startedAt, code, source: deps.source });
            return { ok: false, code, message, status: response.error.statusCode };
        },

        async embed(options) {
            const correlationId = newCorrelationId();
            const startedAt = now();

            if (deps.quota) {
                const allowed = await deps.quota({
                    source: deps.source,
                    taskKey: deps.taskKey,
                    organizationId: provenance.organizationId,
                    userId: provenance.userId,
                });
                if (!allowed) {
                    deps.emit('quota.exceeded', {
                        taskKey: deps.taskKey,
                        source: deps.source,
                        appId: provenance.appId,
                        organizationId: provenance.organizationId,
                        userId: provenance.userId,
                    });
                    return {
                        ok: false,
                        code: AI_ERROR_CODES.RATE_LIMITED,
                        message: 'Your AI usage quota for this period has been reached.',
                    };
                }
            }

            // A chat-only adapter must refuse explicitly. Guessing at a provider endpoint is
            // how a provider-specific mismatch becomes a billed, opaque 200 response.
            if (!deps.raw.embed) {
                emitCompleted({
                    correlationId,
                    startedAt,
                    code: AI_ERROR_CODES.UNSUPPORTED_OPERATION,
                    source: deps.source,
                    operation: 'embedding',
                });
                return {
                    ok: false,
                    code: AI_ERROR_CODES.UNSUPPORTED_OPERATION,
                    message: 'The resolved AI transport does not support embeddings.',
                };
            }

            const call: AiEmbedOptions = {
                ...options,
                cacheTtlSeconds: resolveCacheTtl(options),
            };

            let response;
            try {
                response = await deps.raw.embed(call);
            } catch (thrown) {
                const code = isAbortError(thrown) ? AI_ERROR_CODES.TIMEOUT : AI_ERROR_CODES.ERROR;
                const message = redactSecrets(
                    thrown instanceof Error ? thrown.message : String(thrown),
                    deps.redactionSentinels,
                );
                writeHealth(false, code);
                emitCompleted({ correlationId, startedAt, code, source: deps.source, operation: 'embedding' });
                return { ok: false, code, message };
            }

            if (response.ok) {
                writeHealth(true);
                emitCompleted({
                    correlationId,
                    startedAt,
                    result: response.result,
                    source: deps.source,
                    operation: 'embedding',
                });
                return response;
            }

            const { code, message } = classify(response.error);
            const fallbackEmbed = deps.platformFallback?.embed;
            if (shouldDegrade(response.error.statusCode) && fallbackEmbed) {
                deps.emit('call.degraded', {
                    correlationId,
                    credentialId: provenance.credentialId,
                    taskKey: deps.taskKey,
                    fromSource: 'byok',
                    toSource: 'platform',
                    triggerStatus: response.error.statusCode!,
                    appId: provenance.appId,
                    organizationId: provenance.organizationId,
                    userId: provenance.userId,
                });
                writeHealth(false, code);
                const retry = await fallbackEmbed(call);
                if (retry.ok) {
                    emitCompleted({
                        correlationId,
                        startedAt,
                        result: retry.result,
                        source: 'platform',
                        operation: 'embedding',
                    });
                    return retry;
                }
                const retryClassified = classify(retry.error);
                emitCompleted({
                    correlationId,
                    startedAt,
                    code: retryClassified.code,
                    source: 'platform',
                    operation: 'embedding',
                });
                return { ok: false, ...retryClassified, status: retry.error.statusCode };
            }

            writeHealth(false, code);
            emitCompleted({ correlationId, startedAt, code, source: deps.source, operation: 'embedding' });
            return { ok: false, code, message, status: response.error.statusCode };
        },

        async *stream(options) {
            const correlationId = newCorrelationId();
            const startedAt = now();

            // A stream does NOT get the JSON guarantee — it ends in deltas, not a reply. Collect
            // the text and run `parseJsonObject` on it.
            const refused = preflight(options);
            if (refused) {
                emitCompleted({ correlationId, startedAt, code: refused.code, source: deps.source });
                yield {
                    type: 'error',
                    error: { retryable: false, message: refused.message, code: refused.code },
                };
                return;
            }

            if (deps.quota) {
                const allowed = await deps.quota({
                    source: deps.source,
                    taskKey: deps.taskKey,
                    organizationId: provenance.organizationId,
                    userId: provenance.userId,
                });
                if (!allowed) {
                    deps.emit('quota.exceeded', {
                        taskKey: deps.taskKey,
                        source: deps.source,
                        appId: provenance.appId,
                        organizationId: provenance.organizationId,
                        userId: provenance.userId,
                    });
                    yield {
                        type: 'error',
                        error: {
                            retryable: false,
                            message: 'Your AI usage quota for this period has been reached.',
                            code: AI_ERROR_CODES.RATE_LIMITED,
                        },
                    };
                    return;
                }
            }

            const call = prepare(options);

            let tokens: AiCallResult['tokens'] = null;
            let failed: AiErrorCode | undefined;

            // TRY/FINALLY, not a bare loop. An async generator that the consumer stops
            // iterating — a user pressing Stop, a client disconnect, any `break` — is
            // finalized WITHOUT running code that merely follows the loop. Without this
            // block a cancelled stream emits no `call.completed` at all: zero tokens metered
            // for a call the tenant was genuinely billed for, no health write, and any quota
            // accounting built on that event silently under-counts. The `catch` mirrors
            // `complete()`: an adapter that throws mid-stream must still be classified and
            // redacted rather than escaping raw.
            try {
                for await (const event of deps.raw.stream(call)) {
                    if (event.type === 'usage') {
                        tokens = event.tokens;
                    } else if (event.type === 'error') {
                        // An auth failure INSIDE a 200 stream surfaces as a stream error and
                        // NEVER cascades — degradation is reachable only before the first byte.
                        const classified = classify(event.error);
                        failed = classified.code;
                        yield { type: 'error', error: { ...event.error, message: classified.message } };
                        continue;
                    }
                    yield event;
                }
            } catch (thrown) {
                failed = isAbortError(thrown) ? AI_ERROR_CODES.TIMEOUT : AI_ERROR_CODES.ERROR;
                yield {
                    type: 'error',
                    error: {
                        retryable: false,
                        message: redactSecrets(
                            thrown instanceof Error ? thrown.message : String(thrown),
                            deps.redactionSentinels,
                        ),
                    },
                };
            } finally {
                writeHealth(!failed, failed);
                emitCompleted({
                    correlationId,
                    startedAt,
                    code: failed,
                    source: deps.source,
                    result: failed
                        ? undefined
                        : {
                              text: '',
                              tokens,
                              model: deps.config.model ?? '',
                              provider: deps.config.provider,
                              raw: null,
                          },
                });
            }
        },
    };
}
