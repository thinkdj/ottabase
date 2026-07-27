// ============================================================
// @ottabase/ottaai/transports — Cloudflare AI Gateway provider table
// ============================================================
// THE URL IS THE CONTRACT, AND IT IS NOT UNIFORM.
//
// The tempting implementation is one `chatPathFor(provider)` with an
// OpenAI-shaped default. It is wrong, and it fails in the least visible way
// possible: a 404 that reads like "bad model" or "bad key".
//
// AI Gateway proxies to each provider's OWN base URL, and those bases already
// differ in whether they include a version segment:
//
//   openai        → api.openai.com/v1        ⇒ gateway path is  /openai/chat/completions
//   anthropic     → api.anthropic.com        ⇒ gateway path is  /anthropic/v1/messages
//   mistral       → api.mistral.ai           ⇒ gateway path is  /mistral/v1/chat/completions
//   groq/deepseek → …/openai/v1 folded in    ⇒ gateway path is  /groq/chat/completions
//
// So `/openai/v1/chat/completions` resolves upstream to `/v1/v1/chat/completions`
// and 404s, while `/mistral/chat/completions` 404s for the opposite reason. There
// is no default that is right for both. Every entry below is therefore a QUOTED
// FACT from Cloudflare's provider docs, with the doc link attached, and a provider
// with no verified entry is REFUSED rather than guessed at.
//
// This table lives in ottaai (not in a shared Cloudflare helper package) because it
// is not a catalogue of AI Gateway — it is exactly the set of paths this transport
// is tested against. See `__tests__/gateway-wire.test.ts`, which asserts the literal
// URL, headers and body for every entry here.
//
// @see https://developers.cloudflare.com/ai-gateway/usage/providers/
// ============================================================

/**
 * The request/response dialect a provider speaks.
 *
 * NOT the same axis as the URL: Groq and OpenAI share a wire but not a path, while
 * Anthropic and Google differ on both.
 */
export type GatewayWire = 'openai' | 'anthropic' | 'google';

/** Where the model id belongs for a given provider. */
export type ModelPlacement = 'body' | 'path';

export interface GatewayPathInput {
    /** Bare model id (never a qualified ref) — needed by providers that put it in the path. */
    model: string | null;
    stream: boolean;
    /** The OPERATOR's merged transport bag. Tenant-writable keys are already filtered out. */
    transportConfig: Record<string, unknown>;
}

export type GatewayPathResult = { ok: true; path: string } | { ok: false; message: string };

export interface GatewayProviderAdapter {
    /** Registry id — the head of a qualified model ref. */
    id: string;
    /** Path segment AI Gateway routes on. Not always equal to `id` (`azure` → `azure-openai`). */
    slug: string;
    wire: GatewayWire;
    modelPlacement: ModelPlacement;
    /** How a raw provider key is presented. A key in a query string is a key in a log. */
    auth: { header: string; prefix: string };
    /** Headers the provider REQUIRES on every call (Anthropic's API version, for example). */
    staticHeaders?: Record<string, string>;
    /** Everything after `/<slug>`, including a leading slash. */
    path(input: GatewayPathInput): GatewayPathResult;
    /** The Cloudflare page this entry was transcribed from. Keep it — it is the review trail. */
    docs: string;
}

/** Shared by every provider whose gateway path is a bare `/chat/completions`. */
function openAiCompatPath(): GatewayPathResult {
    return { ok: true, path: '/chat/completions' };
}

/**
 * Providers this transport can actually call, with WIRE CONTRACTS VERIFIED AGAINST THE DOCS.
 *
 * Absence is deliberate and is not a TODO list:
 *
 *  • `cohere` speaks its own `chat_history` / `message` dialect and returns `.text`, not
 *    `choices[]`. Sending it an OpenAI body "works" (HTTP 200) and returns an empty
 *    completion — the worst possible failure. It needs its own wire before it ships.
 *  • `hugging-face` has no single chat contract across its inference providers.
 *  • `workers-ai` is not reachable through this provider-native proxy shape at all; it is
 *    Cloudflare-billed inference via the REST API or a Worker binding, which is a different
 *    transport, not a tenant BYOK credential.
 *
 * All three are marked `tenantSelectable: false` in the registry so the form never offers a
 * provider this transport would then refuse.
 */
export const GATEWAY_PROVIDERS: Readonly<Record<string, GatewayProviderAdapter>> = Object.freeze({
    openai: {
        id: 'openai',
        slug: 'openai',
        wire: 'openai',
        modelPlacement: 'body',
        auth: { header: 'Authorization', prefix: 'Bearer ' },
        // NO `/v1`. The gateway already proxies to api.openai.com/v1.
        path: openAiCompatPath,
        docs: 'https://developers.cloudflare.com/ai-gateway/usage/providers/openai/',
    },

    anthropic: {
        id: 'anthropic',
        slug: 'anthropic',
        wire: 'anthropic',
        modelPlacement: 'body',
        auth: { header: 'x-api-key', prefix: '' },
        // REQUIRED, not optional: Anthropic rejects a versionless request outright. Omitting
        // it fails 100% of calls with a message about the header rather than about the key.
        staticHeaders: { 'anthropic-version': '2023-06-01' },
        path: () => ({ ok: true, path: '/v1/messages' }),
        docs: 'https://developers.cloudflare.com/ai-gateway/usage/providers/anthropic/',
    },

    'google-ai-studio': {
        id: 'google-ai-studio',
        slug: 'google-ai-studio',
        wire: 'google',
        // THE MODEL IS PART OF THE URL for Gemini, so it must NOT also appear in the body.
        modelPlacement: 'path',
        // Google also accepts `?key=`; a header keeps the tenant's plaintext out of access
        // logs, proxy logs and error reports.
        auth: { header: 'x-goog-api-key', prefix: '' },
        path: ({ model, stream }) => {
            if (!model) {
                return { ok: false, message: 'Google AI Studio requires a model — it is part of the request URL.' };
            }
            const method = stream ? 'streamGenerateContent' : 'generateContent';
            // Encoded per segment: a model id reaches here from tenant input.
            const suffix = stream ? '?alt=sse' : '';
            return { ok: true, path: `/v1/models/${encodeURIComponent(model)}:${method}${suffix}` };
        },
        docs: 'https://developers.cloudflare.com/ai-gateway/usage/providers/google-ai-studio/',
    },

    groq: {
        id: 'groq',
        slug: 'groq',
        wire: 'openai',
        modelPlacement: 'body',
        auth: { header: 'Authorization', prefix: 'Bearer ' },
        path: openAiCompatPath,
        docs: 'https://developers.cloudflare.com/ai-gateway/usage/providers/groq/',
    },

    mistral: {
        id: 'mistral',
        slug: 'mistral',
        wire: 'openai',
        modelPlacement: 'body',
        auth: { header: 'Authorization', prefix: 'Bearer ' },
        // WITH `/v1` — the gateway proxies to api.mistral.ai, which is versionless.
        path: () => ({ ok: true, path: '/v1/chat/completions' }),
        docs: 'https://developers.cloudflare.com/ai-gateway/usage/providers/mistral/',
    },

    deepseek: {
        id: 'deepseek',
        slug: 'deepseek',
        wire: 'openai',
        modelPlacement: 'body',
        auth: { header: 'Authorization', prefix: 'Bearer ' },
        path: openAiCompatPath,
        docs: 'https://developers.cloudflare.com/ai-gateway/usage/providers/deepseek/',
    },

    perplexity: {
        id: 'perplexity',
        // The slug is NOT the registry id.
        slug: 'perplexity-ai',
        wire: 'openai',
        modelPlacement: 'body',
        auth: { header: 'Authorization', prefix: 'Bearer ' },
        path: openAiCompatPath,
        docs: 'https://developers.cloudflare.com/ai-gateway/usage/providers/perplexity/',
    },

    azure: {
        id: 'azure',
        slug: 'azure-openai',
        wire: 'openai',
        // Azure names the model by DEPLOYMENT, in the path; the body's `model` is ignored.
        modelPlacement: 'path',
        auth: { header: 'api-key', prefix: '' },
        path: ({ transportConfig }) => {
            // These three are `destinationKeys` on the registry entry, so they are
            // OPERATOR-ONLY by construction — a tenant cannot point the request elsewhere.
            const resource = asSegment(transportConfig.resourceName);
            const deployment = asSegment(transportConfig.deploymentName);
            const apiVersion = typeof transportConfig.apiVersion === 'string' ? transportConfig.apiVersion : null;
            if (!resource || !deployment || !apiVersion) {
                return {
                    ok: false,
                    // Named explicitly: an Azure deployment that silently 404s is otherwise
                    // debugged as a key problem for hours.
                    message:
                        'Azure OpenAI needs operator transport config: resourceName, deploymentName and apiVersion. ' +
                        'Set them in the platform transportConfig — they decide where the request goes, so they are ' +
                        'never tenant-writable.',
                };
            }
            return {
                ok: true,
                path: `/${resource}/${deployment}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
            };
        },
        docs: 'https://developers.cloudflare.com/ai-gateway/usage/providers/azureopenai/',
    },
} satisfies Record<string, GatewayProviderAdapter>);

/**
 * A single URL path segment, or null.
 *
 * ENCODED, NEVER INTERPOLATED RAW. These values come from operator config today, but a
 * single future path that forwarded a caller value would otherwise let `../..` retarget the
 * whole gateway URL while the request still carries the operator's gateway token.
 */
function asSegment(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed === '.' || trimmed === '..' || trimmed.includes('/')) return null;
    return encodeURIComponent(trimmed);
}

/** The adapter for a provider id, or undefined when this transport cannot call it. */
export function gatewayAdapterFor(provider: string): GatewayProviderAdapter | undefined {
    return GATEWAY_PROVIDERS[provider];
}

/** Provider ids this transport has a verified wire contract for. */
export const GATEWAY_SUPPORTED_PROVIDERS: readonly string[] = Object.freeze(Object.keys(GATEWAY_PROVIDERS));
