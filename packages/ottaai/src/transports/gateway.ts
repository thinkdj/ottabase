// ============================================================
// @ottabase/ottaai/transports/gateway — Cloudflare AI Gateway adapter
// ============================================================
// Ottabase is Cloudflare-first, so this is the shipped adapter. It is still ONE
// implementation of a seam: `TransportAdapter`. Direct-to-provider and mock
// adapters implement the same interface, and the credential plane never learns a
// gateway concept.
//
// A gateway buys unified logging, caching, retries, fallback routing and cost
// analytics across providers — which is exactly why the TENANT KEY IS FORWARDED
// PER CALL AS A HEADER rather than stored gateway-side, and why the custody
// disclosure (see `buildCustodyDisclosure`) names the gateway as a sub-processor.
//
// ROUTING FACTS LIVE IN `./providers`, WIRE DIALECTS IN `./wire`. Both are
// transcribed from Cloudflare's provider docs and asserted literally by
// `__tests__/gateway-wire.test.ts`. A provider with no verified entry is REFUSED
// here rather than served by an OpenAI-shaped guess — the guess returns HTTP 200
// with an empty completion on at least one shipped provider, which is the worst
// available failure mode.
// ============================================================

import { DYNAMIC_MODEL_PREFIX, parseModelRef } from '../model-ref';
import { createProviderRegistry, type AiProviderRegistry } from '../registry';
import { redactSecrets } from '../secret';
import type { MergedTransportConfig } from '../types';
import type { AiCallError, AiCallOptions, AiStreamEvent, RawAiClient, TransportAdapter } from '../resolver/transport';
import { GATEWAY_PROVIDERS, gatewayAdapterFor, type GatewayProviderAdapter, type GatewayWire } from './providers';
import { buildBody, createStreamReader, normalizeResult } from './wire';

const GATEWAY_BASE = 'https://gateway.ai.cloudflare.com/v1';

export interface GatewayAdapterOptions {
    /**
     * The registry used to parse qualified model refs. Pass the SAME instance the
     * resolver uses, or a qualified ref can parse differently in two places.
     */
    registry?: AiProviderRegistry;
    /**
     * Header carrying a gateway-held provider key NAME (the `alias` secret kind).
     *
     * Configurable because whether your gateway exposes stored provider keys — and under
     * what header — is a deployment fact, not a package fact. The default is Cloudflare's
     * documented BYOK alias header; leave it unless your gateway documents otherwise.
     *
     * @see https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/
     */
    aliasHeader?: string;
    /**
     * Path used for a `dynamic/<route>` model ref, relative to the gateway base.
     *
     * Cloudflare invokes a dynamic route through the OPENAI-COMPATIBLE endpoint with the
     * route name in the `model` field — NOT as a URL path segment. Overriding this is an
     * escape hatch for a gateway that documents otherwise.
     *
     * @see https://developers.cloudflare.com/ai-gateway/features/dynamic-routing/
     */
    dynamicPath?: string;
    /** Default request timeout in ms when a call does not specify one. */
    defaultTimeoutMs?: number;
}

/**
 * Cloudflare's OpenAI-compatible unified endpoint, which is how a dynamic route is called.
 *
 * NOTE: Cloudflare now documents this endpoint as deprecated in favour of the AI Gateway
 * REST API. It is still the documented invocation path for dynamic routes, so it stays —
 * but a platform-billed transport built on the REST API is the successor, and this is the
 * line that will move when that lands.
 */
const DEFAULT_DYNAMIC_PATH = 'compat/chat/completions';

export function createGatewayTransport(options: GatewayAdapterOptions = {}): TransportAdapter {
    const registry = options.registry ?? createProviderRegistry();
    const aliasHeader = options.aliasHeader ?? 'cf-aig-byok-alias';
    const dynamicPath = options.dynamicPath ?? DEFAULT_DYNAMIC_PATH;
    const defaultTimeout = options.defaultTimeoutMs ?? 60_000;

    return {
        // Surfaced in `configSummary.transport` and in every emitted event. Named for the
        // Cloudflare product, NOT for the former `@ottabase/cf-ai` package — which this
        // transport replaced and which no longer exists.
        name: 'cloudflare-ai-gateway',

        /**
         * DELIBERATELY UNDER-STRICT ABOUT CONFIGURATION, STRICT ABOUT CAPABILITY.
         *
         * It requires the adapter's own destination fields and does NOT require a provider
         * key (gateway-billed inference has none) or a model (it can arrive per request). A
         * misconfigured deployment therefore yields a client that fails at call time rather
         * than a clean null — which is why platform config is validated AT BOOT.
         *
         * It DOES reject a provider this transport has no verified wire contract for. That
         * is not configuration, it is capability: such a credential can never produce a
         * correct call, so reporting `MERGE_INCOMPLETE` at resolve time (with a candidate
         * verdict an operator can read) beats a 200-with-empty-text at call time.
         */
        isComplete(config) {
            if (!config.accountId || !config.gateway || !config.provider) return false;
            // A dynamic route owns provider selection inside the gateway, so the credential's
            // own provider is irrelevant to whether the call can be made.
            if (isDynamicRef(config.model)) return true;
            return Boolean(gatewayAdapterFor(config.provider));
        },

        /**
         * Providers whose URL cannot be built from THIS operator's transport bag.
         *
         * Azure OpenAI is the whole reason this exists: it is fully supported, but its path
         * carries operator-only `resourceName` / `deploymentName` / `apiVersion`. On a
         * deployment that never set them, the form offers Azure, the tenant pastes a real key,
         * the row saves — and every call is `MERGE_INCOMPLETE`. Reporting it here removes
         * Azure from tenant selection at composition, so the offer is never made.
         *
         * Probed by ASKING THE ADAPTER, not by a hard-coded list: a provider that later grows
         * an operator-config requirement is covered without touching this function.
         */
        unservableProviders(platform) {
            const transportConfig = platform.transportConfig ?? {};
            const unservable: string[] = [];
            for (const adapter of Object.values(GATEWAY_PROVIDERS)) {
                // `model`/`stream` are irrelevant to whether OPERATOR config is present —
                // a probe model keeps model-dependent adapters (Google) from false-positiving.
                const probe = adapter.path({ model: '__probe__', stream: false, transportConfig });
                if (!probe.ok) unservable.push(adapter.id);
            }
            return unservable;
        },

        createClient(config) {
            return createGatewayClient(config, { registry, aliasHeader, dynamicPath, defaultTimeout });
        },
    };
}

function isDynamicRef(model: string | null | undefined): boolean {
    return typeof model === 'string' && model.startsWith(DYNAMIC_MODEL_PREFIX);
}

interface ClientDeps {
    registry: AiProviderRegistry;
    aliasHeader: string;
    dynamicPath: string;
    defaultTimeout: number;
}

/** Everything the request builder needs, or the reason it cannot be built. */
type Target =
    | {
          ok: true;
          url: string;
          /** Bare model id for the body, or null when the provider carries it in the path. */
          modelId: string | null;
          provider: string;
          wire: GatewayWire;
          adapter: GatewayProviderAdapter | null;
      }
    | { ok: false; message: string };

function createGatewayClient(config: MergedTransportConfig, deps: ClientDeps): RawAiClient {
    const doFetch = config.fetch ?? fetch;
    const sentinels = [config.secret?.expose(), config.alias, config.gatewayToken];

    /** Resolve the target URL, the wire dialect, and where the model id belongs. */
    function target(perCallModel: string | undefined, stream: boolean): Target {
        const ref = perCallModel ?? config.model ?? null;

        if (ref && ref.startsWith(DYNAMIC_MODEL_PREFIX)) {
            // A DYNAMIC ROUTE IS A MODEL VALUE, NOT A PATH.
            //
            // Cloudflare routes `dynamic/<route>` through the OpenAI-compatible endpoint with
            // the route name in the `model` field. Building `.../dynamic/<route>` as a URL
            // instead 404s at the gateway — and because the route name is operator config,
            // that failure looks like a gateway outage rather than a client bug.
            const route = ref
                .slice(DYNAMIC_MODEL_PREFIX.length)
                .split('/')
                .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
                .join('/');
            if (!route) return { ok: false, message: 'A dynamic route name is required after "dynamic/".' };
            return {
                ok: true,
                url: `${GATEWAY_BASE}/${config.accountId}/${config.gateway}/${deps.dynamicPath}`,
                modelId: `${DYNAMIC_MODEL_PREFIX}${route}`,
                provider: config.provider,
                wire: 'openai',
                adapter: null,
            };
        }

        const parsed = ref ? parseModelRef(ref, deps.registry) : null;

        // A QUALIFIED REF MAY NOT CROSS PROVIDERS.
        //
        // It used to win verbatim as an "escape hatch", which meant the request was ROUTED to
        // provider B while AUTHENTICATED with provider A's key and scheme. There is no
        // deployment in which that is the intended outcome: it is either an incoherent
        // credential (caught at write time now) or a per-call override naming the wrong
        // provider. Refusing it here keeps the failure legible instead of turning it into an
        // upstream 401 that reads as "your key is invalid".
        if (parsed?.form === 'qualified' && parsed.provider !== config.provider) {
            return {
                ok: false,
                message:
                    `Model "${parsed.raw}" targets provider "${parsed.provider}" but this credential is for ` +
                    `"${config.provider}". A model reference may not change the provider — save a credential for ` +
                    `"${parsed.provider}" instead.`,
            };
        }

        const provider = config.provider;
        const adapter = gatewayAdapterFor(provider);
        if (!adapter) {
            return {
                ok: false,
                message:
                    `This deployment's AI Gateway transport has no verified wire contract for provider ` +
                    `"${provider}", so it will not guess at one.`,
            };
        }

        const modelId = parsed ? parsed.model : null;
        const built = adapter.path({ model: modelId, stream, transportConfig: config.transportConfig });
        if (!built.ok) return { ok: false, message: built.message };

        return {
            ok: true,
            url: `${GATEWAY_BASE}/${config.accountId}/${config.gateway}/${adapter.slug}${built.path}`,
            // When the provider names the model in the URL, sending it in the body too is at
            // best ignored and at worst a 400.
            modelId: adapter.modelPlacement === 'path' ? null : modelId,
            provider,
            wire: adapter.wire,
            adapter,
        };
    }

    function buildHeaders(adapter: GatewayProviderAdapter | null, options: AiCallOptions): Headers {
        const headers = new Headers({ 'Content-Type': 'application/json' });

        // Provider-mandated headers (Anthropic's API version, for example) go on FIRST so an
        // operator header bag can still override them if a provider ever moves.
        for (const [key, value] of Object.entries(adapter?.staticHeaders ?? {})) headers.set(key, value);

        // Provider auth — EXACTLY ONE of key / alias is ever present (the merge is
        // subtractive on secrets; a credential supplies the complete provider
        // authentication or none of it).
        //
        // A KEY IN A URL IS A KEY IN A LOG. Query-string credentials land in access logs,
        // proxy logs, browser referrers and error reports; a header does not. Every provider
        // in the table authenticates by header, Google AI Studio included.
        if (config.secret) {
            if (adapter) {
                headers.set(adapter.auth.header, `${adapter.auth.prefix}${config.secret.expose()}`);
            } else {
                // The dynamic-route path: the gateway picks the provider, so the only
                // defensible scheme is the overwhelmingly common one.
                headers.set('Authorization', `Bearer ${config.secret.expose()}`);
            }
        } else if (config.alias) {
            headers.set(deps.aliasHeader, config.alias);
        }

        // Gateway auth is the OPERATOR'S credential and is orthogonal to the tenant's.
        if (config.gatewayToken) headers.set('cf-aig-authorization', `Bearer ${config.gatewayToken}`);

        if (options.skipCache) headers.set('cf-aig-skip-cache', 'true');
        else if (options.cacheTtlSeconds !== undefined)
            headers.set('cf-aig-cache-ttl', String(options.cacheTtlSeconds));

        // Provenance travels as request metadata so a gateway route can branch on it —
        // e.g. give BYOK tenants a better model with no code change in any consumer.
        //
        // TRUSTED VALUES ARE WRITTEN LAST. Spreading the caller's bag last let it overwrite
        // `source`, `task` and `app` — and because AI Gateway's dynamic routing can BRANCH ON
        // METADATA, a call site that forwarded a request body could relabel a platform call
        // as `source: 'byok'` and take a route (and a budget) it was never entitled to. It
        // also poisons cost analytics, which is the quieter half of the same bug.
        //
        // Caller tags are still forwarded — they just cannot impersonate provenance.
        const metadata: Record<string, string> = {
            ...(options.metadata ?? {}),
            source: config.provenance.source,
            task: config.provenance.taskKey,
            ...(config.provenance.appId ? { app: config.provenance.appId } : {}),
        };
        headers.set('cf-aig-metadata', JSON.stringify(metadata));

        // Operator-only transport bag. Tenant-writable keys are already filtered out by
        // the merge; this loop only ever sees operator values.
        const extraHeaders = config.transportConfig?.headers;
        if (extraHeaders && typeof extraHeaders === 'object') {
            for (const [k, v] of Object.entries(extraHeaders as Record<string, string>)) headers.set(k, v);
        }

        return headers;
    }

    async function issue(
        options: AiCallOptions,
        stream: boolean,
    ): Promise<
        | {
              ok: true;
              response: Response;
              provider: string;
              wire: GatewayWire;
              modelId: string | null;
              done: () => void;
          }
        | { ok: false; error: AiCallError }
    > {
        const resolved = target(options.model, stream);
        if (!resolved.ok) {
            // A CONFIGURATION FAULT IS NOT RETRYABLE. Marking it retryable would have the
            // instrumented client burn the degradation budget on a request that can never be
            // built.
            return { ok: false, error: { retryable: false, message: resolved.message } };
        }

        // AN ALREADY-ABORTED SIGNAL MUST NOT REACH THE NETWORK. `addEventListener('abort')`
        // never fires on a signal that is already aborted, so without this check a caller who
        // cancelled before the call still issues a full upstream request — billed, logged,
        // and holding the tenant's key open until the timeout.
        if (options.signal?.aborted) {
            return { ok: false, error: { retryable: false, message: 'Request was aborted before it was sent' } };
        }

        const controller = new AbortController();
        const timeoutMs = options.timeout ?? deps.defaultTimeout;
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        // THE TIMER MUST OUTLIVE THE HEADERS.
        //
        // Clearing it when `issue()` returns disarms it the moment response HEADERS arrive —
        // and the body is read afterwards, by `response.json()` or by the SSE reader. A
        // provider that sends headers and then stalls mid-body would hang for as long as the
        // runtime allows, with the tenant's request (and, on a stream, the tenant's key)
        // pinned open. The caller signals completion via `done()` instead; only the error
        // paths below clear it here.
        const done = () => clearTimeout(timer);
        if (options.signal) options.signal.addEventListener('abort', () => controller.abort(), { once: true });

        try {
            const response = await doFetch(resolved.url, {
                method: 'POST',
                headers: buildHeaders(resolved.adapter, options),
                body: JSON.stringify(buildBody({ wire: resolved.wire, model: resolved.modelId, options, stream })),
                signal: controller.signal,
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                done();
                return {
                    ok: false,
                    error: {
                        statusCode: response.status,
                        retryable: response.status >= 500 || response.status === 429,
                        // Redacted HERE, at the adapter boundary — provider 4xx bodies
                        // routinely echo the Authorization header back.
                        message: redactSecrets(text || `Upstream returned ${response.status}`, sentinels),
                    },
                };
            }

            return {
                ok: true,
                response,
                provider: resolved.provider,
                wire: resolved.wire,
                modelId: resolved.modelId,
                done,
            };
        } catch (thrown) {
            done();
            const aborted = (thrown as { name?: string })?.name === 'AbortError';
            return {
                ok: false,
                error: {
                    retryable: !aborted,
                    message: aborted
                        ? `Request timed out after ${timeoutMs}ms`
                        : redactSecrets(thrown instanceof Error ? thrown.message : String(thrown), sentinels),
                },
            };
        }
    }

    return {
        async complete(options) {
            const issued = await issue(options, false);
            if (!issued.ok) return { ok: false, error: issued.error };

            let payload: Record<string, unknown>;
            try {
                payload = (await issued.response.json()) as Record<string, unknown>;
            } catch (error) {
                return {
                    ok: false,
                    error: {
                        statusCode: issued.response.status,
                        retryable: false,
                        message: redactSecrets(
                            `Provider returned an unparseable response: ${error instanceof Error ? error.message : String(error)}`,
                            sentinels,
                        ),
                    },
                };
            } finally {
                // The body is read; the timeout has done its job.
                issued.done();
            }

            return { ok: true, result: normalizeResult(issued.wire, payload, issued.provider, issued.modelId) };
        },

        async *stream(options) {
            const issued = await issue(options, true);
            if (!issued.ok) {
                yield { type: 'error', error: issued.error };
                return;
            }
            const body = issued.response.body;
            if (!body) {
                issued.done();
                yield { type: 'error', error: { retryable: false, message: 'Provider returned no stream body' } };
                return;
            }
            try {
                yield* parseSse(body, issued.wire, sentinels);
            } finally {
                // Runs on normal completion AND on early consumer termination, so the
                // timeout is always disarmed once this generator is finalized.
                issued.done();
            }
        },
    };
}

// ---------------------------------------------------------------------------
// SSE
// ---------------------------------------------------------------------------

/**
 * Parse an SSE byte stream into TYPED signals.
 *
 * Two things the core must never do itself: parse vendor SSE, and discover that an auth
 * failure arrived INSIDE a 200 response. Both are handled here so the instrumented client
 * sees `{type:'error'}` either way.
 *
 * Framing follows the SSE spec rather than one provider's habits: CRLF and bare CR are
 * normalised to LF, and an event's `data:` lines are CONCATENATED before parsing. A parser
 * that only understands single-line LF frames does not error on a CRLF provider — it simply
 * buffers the whole response and emits it in one lump at the end, which is a silent
 * downgrade from streaming to not-streaming.
 */
async function* parseSse(
    body: ReadableStream<Uint8Array>,
    wire: GatewayWire,
    sentinels: Array<string | null | undefined>,
): AsyncIterable<AiStreamEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    const stream = createStreamReader(wire);
    let buffer = '';
    /**
     * A CR at the very end of a chunk is HELD, not translated.
     *
     * It may be the first half of a CRLF that the network split across two chunks. Rewriting
     * it to LF immediately, and then meeting the LF that follows, manufactures a `\n\n`
     * boundary in the MIDDLE of a frame — which truncates that frame's JSON and silently
     * drops it. So it waits one chunk to find out what it was.
     */
    let pendingCr = false;

    /** Append a decoded chunk, normalising CRLF and bare CR to LF across chunk boundaries. */
    function absorb(chunk: string): void {
        if (pendingCr) {
            // Held CR resolves to exactly one LF, whether or not an LF followed it.
            buffer += '\n';
            pendingCr = false;
            if (chunk.startsWith('\n')) chunk = chunk.slice(1);
        }
        if (chunk.endsWith('\r')) {
            pendingCr = true;
            chunk = chunk.slice(0, -1);
        }
        buffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    function* handleEvent(rawEvent: string): Generator<AiStreamEvent> {
        // Per the SSE spec an event may carry several `data:` lines; they join with newlines
        // and form ONE payload. Parsing each line separately drops every multi-line frame.
        const data = rawEvent
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).replace(/^ /, ''))
            .join('\n')
            .trim();

        if (!data || data === '[DONE]') return;

        let parsed: Record<string, unknown>;
        try {
            parsed = JSON.parse(data) as Record<string, unknown>;
        } catch {
            return;
        }

        // An in-stream error object — the 200-with-a-failure case.
        if (parsed.error) {
            const err = parsed.error as { message?: string; code?: string; status?: number };
            yield {
                type: 'error',
                error: {
                    statusCode: err.status,
                    providerCode: err.code,
                    retryable: false,
                    message: redactSecrets(err.message ?? 'Provider reported a stream error', sentinels),
                },
            };
            return;
        }

        yield* stream.handle(parsed);
    }

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) {
                // FLUSH THE DECODER and parse whatever is left. A provider that ends the
                // stream without a trailing blank line would otherwise have its final frame —
                // which for OpenAI-shaped providers is the one carrying USAGE — silently
                // discarded, so the metering that streaming exists to get right reports zero.
                absorb(decoder.decode());
                if (pendingCr) {
                    buffer += '\n';
                    pendingCr = false;
                }
                if (buffer.trim().length > 0) yield* handleEvent(buffer);
                buffer = '';
                break;
            }
            absorb(decoder.decode(value, { stream: true }));

            let boundary = buffer.indexOf('\n\n');
            while (boundary !== -1) {
                const event = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                boundary = buffer.indexOf('\n\n');
                yield* handleEvent(event);
            }
        }
    } finally {
        // CANCEL, then release. On early consumer termination `releaseLock` alone leaves the
        // upstream response body open — and with it the request that carries the tenant's key.
        try {
            await reader.cancel();
        } catch {
            // The stream may already be closed or errored; nothing to tear down.
        }
        reader.releaseLock();
    }

    const model = stream.model();
    yield { type: 'done', ...(model ? { model } : {}) };
}
