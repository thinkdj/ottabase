// ============================================================
// @ottabase/ottaai — Provider registry (per instance, composable)
// ============================================================
// Lives in the DEPENDENCY-FREE ROOT on purpose: the browser form, the model's
// field metadata (the provider <select> options are generated from it) and the
// resolver's guards must all read ONE object. Put it behind the ORM boundary and
// either the form drifts from the guards, or the frontend drags in a database library.
//
// The registry is seeded from built-ins, then EXTENDED, OVERRIDDEN or SUBSET per
// instance. Subsetting is the half that gets forgotten and is the more common
// enterprise requirement — a B2B app restricting tenants to two approved providers
// would otherwise have to fork the package.
// ============================================================

import type { HintSource } from './secret';

/**
 * Capabilities a task may require of the model that will serve it.
 *
 * MODEL-SELECTION METADATA, NOT A CALL CONTRACT. These decide which credential is ELIGIBLE
 * for a task; they do not describe what you can send. The package's call contract is text
 * chat completion — `AiCallOptions` message content is a plain string — so requiring
 * `vision` or `audio` today buys a stricter eligibility filter and nothing else. See the
 * note on `AiCallOptions`.
 */
export type AiCapability = 'text' | 'vision' | 'audio' | 'embedding' | 'image' | 'tools' | 'json' | 'reasoning';

export interface AiModelEntry {
    /** Bare model id as the provider names it (e.g. `gpt-4o-mini`, `@cf/meta/llama-3.1-8b-instruct`). */
    id: string;
    /** Human label for the picker. */
    label?: string;
    /** What this model can do. Falls back to the provider's `defaultCapabilities`. */
    capabilities?: AiCapability[];
}

export interface AiProviderEntry {
    /** Registry key. Also the head of a qualified model ref (`openai/gpt-4o`). */
    id: string;
    displayName: string;

    /**
     * Whether a provider key is required to call this provider.
     *
     * NOT a UI hint — load-bearing in four places: form field visibility, the
     * keyless-mismatch guard, the provider-change write guard, and operator display.
     * Defaults to TRUE for providers that are not registered (see `requiresKeyFor`).
     */
    requiresKey: boolean;

    /** Placeholder shown in the form (`sk-…`, `sk-ant-…`, `AIza…`). Tells a user instantly they pasted the wrong provider's key. */
    keyFormatHint?: string;

    /** Cheap client + server shape check. A hint, never the security control. */
    keyPattern?: RegExp;

    /** "Where do I get a key" — materially reduces support load. */
    docsUrl?: string;

    /** How the display hint is derived from the plaintext. */
    hintSource?: HintSource;

    /** Suggested models. A SUGGESTION LIST, never a whitelist — see `allowCustomModel`. */
    models?: AiModelEntry[];

    /** Capabilities assumed for a model that is not in `models`. */
    defaultCapabilities?: AiCapability[];

    /**
     * Whether a tenant may type a model id that is not in `models`.
     * Defaults to true — a whitelist turns every upstream model release into a deploy
     * in every consuming app.
     */
    allowCustomModel?: boolean;

    /**
     * Keys of the per-provider transport config bag that can influence WHERE a request
     * goes or HOW it authenticates. Enumerated ONCE, here; rejected from every tenant
     * write path, for every provider.
     *
     * The invariant: the tenant controls WHICH provider key is used; the operator
     * controls WHERE the request goes.
     */
    destinationKeys?: string[];

    /**
     * Whether a TENANT may save a credential for this provider. Defaults to true.
     *
     * SEPARATE FROM `requiresKey`, and separate from being registered at all. A provider can
     * be legitimately present for the PLATFORM path while being meaningless as a tenant
     * credential — Cloudflare Workers AI is the case that forced this field: it is billed to
     * the operator's account and has no tenant provider key to bring, so offering it in the
     * BYOK form produces a row that can never satisfy a `required` gate and never explains
     * why.
     *
     * It is also how a provider the shipped transport has no verified wire contract for stays
     * out of the form instead of being offered and then refused at call time.
     */
    tenantSelectable?: boolean;
}

/** A frozen, per-instance view of the providers this deployment supports. */
export interface AiProviderRegistry {
    get(providerId: string): AiProviderEntry | undefined;
    has(providerId: string): boolean;
    list(): AiProviderEntry[];
    /**
     * The providers a TENANT may save a credential for — `list()` minus the platform-only and
     * no-verified-wire entries. This is what the form and every tenant write path read; the
     * unfiltered `list()` remains for operator surfaces and for the platform path.
     */
    tenantSelectable(): AiProviderEntry[];
    /** Whether a tenant may save a credential for this provider. False when unregistered. */
    isTenantSelectable(providerId: string | null | undefined): boolean;
    /** `requiresKey` for a provider id, defaulting to TRUE when unregistered. */
    requiresKeyFor(providerId: string | null | undefined): boolean;
    /** Capabilities of `modelId` under `providerId`, or null when the model is unknown. */
    capabilitiesFor(providerId: string, modelId: string | null | undefined): AiCapability[] | null;
}

// ---------------------------------------------------------------------------
// Built-ins
// ---------------------------------------------------------------------------

/**
 * Providers Cloudflare AI Gateway can route to, seeded with the metadata the BYOK
 * surfaces need. Deliberately WITHOUT pinned current model ids beyond a couple of
 * stable families — model lists date instantly and imply the whitelist this design rejects.
 *
 * Registry entries are DATA WITH LIFECYCLE: removing a provider or flipping
 * `requiresKey` invalidates stored credentials in the field, so both are deprecations
 * with a migration note, never silent edits.
 */
export const BUILT_IN_PROVIDERS: readonly AiProviderEntry[] = Object.freeze([
    {
        id: 'openai',
        displayName: 'OpenAI',
        requiresKey: true,
        keyFormatHint: 'sk-…',
        keyPattern: /^sk-[A-Za-z0-9_-]{16,}$/,
        docsUrl: 'https://platform.openai.com/api-keys',
        defaultCapabilities: ['text', 'vision', 'tools', 'json'],
        models: [
            { id: 'gpt-4o-mini', label: 'GPT-4o mini', capabilities: ['text', 'vision', 'tools', 'json'] },
            { id: 'gpt-4o', label: 'GPT-4o', capabilities: ['text', 'vision', 'tools', 'json'] },
            { id: 'text-embedding-3-small', label: 'text-embedding-3-small', capabilities: ['embedding'] },
            { id: 'text-embedding-3-large', label: 'text-embedding-3-large', capabilities: ['embedding'] },
        ],
    },
    {
        id: 'anthropic',
        displayName: 'Anthropic',
        requiresKey: true,
        keyFormatHint: 'sk-ant-…',
        keyPattern: /^sk-ant-[A-Za-z0-9_-]{16,}$/,
        docsUrl: 'https://console.anthropic.com/settings/keys',
        defaultCapabilities: ['text', 'vision', 'tools', 'json', 'reasoning'],
        models: [
            { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
            { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
        ],
    },
    {
        id: 'google-ai-studio',
        displayName: 'Google AI Studio',
        requiresKey: true,
        keyFormatHint: 'AIza…',
        docsUrl: 'https://aistudio.google.com/app/apikey',
        defaultCapabilities: ['text', 'vision', 'tools', 'json'],
    },
    {
        id: 'workers-ai',
        displayName: 'Cloudflare Workers AI',
        // Gateway-billed / binding-billed inference legitimately has NO tenant provider key.
        requiresKey: false,
        // PLATFORM-ONLY. Registered because a gateway-billed deployment names it as
        // `platform.provider` (and the keyless-mismatch guard depends on that being a valid,
        // keyless provider), but it is not a credential a TENANT can bring: there is no
        // Workers AI key to paste, so such a row can never satisfy a `required` BYOK gate.
        // It is also not reachable through AI Gateway's provider-native proxy shape — Workers
        // AI is called via the REST API or a Worker binding, which is a different transport.
        tenantSelectable: false,
        docsUrl: 'https://developers.cloudflare.com/workers-ai/models/',
        defaultCapabilities: ['text', 'json'],
    },
    {
        id: 'groq',
        displayName: 'Groq',
        requiresKey: true,
        keyFormatHint: 'gsk_…',
        docsUrl: 'https://console.groq.com/keys',
        defaultCapabilities: ['text', 'tools', 'json'],
    },
    {
        id: 'mistral',
        displayName: 'Mistral AI',
        requiresKey: true,
        docsUrl: 'https://console.mistral.ai/api-keys/',
        defaultCapabilities: ['text', 'tools', 'json'],
    },
    {
        id: 'deepseek',
        displayName: 'DeepSeek',
        requiresKey: true,
        docsUrl: 'https://platform.deepseek.com/api_keys',
        defaultCapabilities: ['text', 'json', 'reasoning'],
    },
    {
        id: 'cohere',
        displayName: 'Cohere',
        requiresKey: true,
        // NO VERIFIED WIRE CONTRACT in the shipped gateway transport. Cohere speaks its own
        // `chat_history` / `message` dialect and answers with `.text`, not `choices[]` — so an
        // OpenAI-shaped request returns HTTP 200 with an EMPTY completion rather than an
        // error. Offering it in the form would ship that silent failure to tenants. Flip this
        // to true in the same change that adds a Cohere wire and its contract tests.
        tenantSelectable: false,
        docsUrl: 'https://dashboard.cohere.com/api-keys',
        defaultCapabilities: ['text', 'embedding'],
    },
    {
        id: 'perplexity',
        displayName: 'Perplexity',
        requiresKey: true,
        docsUrl: 'https://www.perplexity.ai/settings/api',
        defaultCapabilities: ['text'],
    },
    {
        id: 'azure',
        displayName: 'Azure OpenAI',
        requiresKey: true,
        docsUrl: 'https://learn.microsoft.com/azure/ai-services/openai/',
        defaultCapabilities: ['text', 'vision', 'tools', 'json'],
        // Azure's deployment/resource fields decide the destination host — operator-only.
        destinationKeys: ['resourceName', 'deploymentName', 'apiVersion', 'baseUrl'],
    },
    {
        id: 'hugging-face',
        displayName: 'Hugging Face',
        requiresKey: true,
        // NO VERIFIED WIRE CONTRACT: the chat shape varies by inference provider behind the
        // router, so there is no single path/body this transport can assert. See `cohere`.
        tenantSelectable: false,
        docsUrl: 'https://huggingface.co/settings/tokens',
        defaultCapabilities: ['text'],
    },
]);

/**
 * Transport-bag keys that are operator-only for EVERY provider, on top of any
 * provider-specific `destinationKeys`. If a tenant could set these, your server would
 * issue a request carrying the platform gateway token to a host of the tenant's choosing.
 */
export const UNIVERSAL_DESTINATION_KEYS: readonly string[] = Object.freeze([
    'baseUrl',
    'endpoint',
    'url',
    'host',
    'origin',
    'headers',
    'fetch',
    'proxy',
    'gateway',
    'gatewayName',
    'accountId',
    'query',
    'searchParams',
    'retryTarget',
]);

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateProviderRegistryOptions {
    /** Restrict the registry to these provider ids (applied to built-ins AND extensions). */
    only?: string[];
    /** Remove these provider ids. Applied after `only`. */
    exclude?: string[];
    /** Add new providers, or override built-in fields (shallow-merged onto a matching built-in). */
    extend?: Array<Partial<AiProviderEntry> & Pick<AiProviderEntry, 'id'>>;
    /** Start from an empty set rather than the built-ins. */
    seed?: 'built-ins' | 'none';
}

/** Build a per-instance provider registry. */
export function createProviderRegistry(options: CreateProviderRegistryOptions = {}): AiProviderRegistry {
    const entries = new Map<string, AiProviderEntry>();

    if (options.seed !== 'none') {
        for (const entry of BUILT_IN_PROVIDERS) entries.set(entry.id, { ...entry });
    }

    for (const patch of options.extend ?? []) {
        const existing = entries.get(patch.id);
        if (existing) {
            entries.set(patch.id, { ...existing, ...patch });
        } else {
            entries.set(patch.id, {
                requiresKey: true,
                displayName: patch.id,
                ...patch,
            } as AiProviderEntry);
        }
    }

    if (options.only) {
        const keep = new Set(options.only);
        for (const id of [...entries.keys()]) if (!keep.has(id)) entries.delete(id);
    }
    for (const id of options.exclude ?? []) entries.delete(id);

    return {
        get: (providerId) => entries.get(providerId),
        has: (providerId) => entries.has(providerId),
        list: () => [...entries.values()],
        tenantSelectable: () => [...entries.values()].filter((entry) => entry.tenantSelectable !== false),
        isTenantSelectable: (providerId) => {
            if (!providerId) return false;
            const entry = entries.get(providerId);
            // An UNREGISTERED provider is not selectable. The write path used to accept any
            // non-empty string, which produced rows that list and test fine and then resolve
            // to `PROVIDER_UNREGISTERED` forever.
            return entry ? entry.tenantSelectable !== false : false;
        },
        requiresKeyFor: (providerId) => {
            if (!providerId) return true;
            const entry = entries.get(providerId);
            // Fail safe: an unregistered provider is assumed to need a key. This default is
            // live only on the WRITE path and in the form — at resolve time an unregistered
            // provider is already ineligible (verdict PROVIDER_UNREGISTERED).
            return entry ? entry.requiresKey : true;
        },
        capabilitiesFor: (providerId, modelId) => {
            const entry = entries.get(providerId);
            if (!entry) return null;
            if (modelId) {
                const model = entry.models?.find((m) => m.id === modelId);
                if (model?.capabilities) return model.capabilities;
                if (model) return entry.defaultCapabilities ?? null;
            }
            // A free-text model the registry has never seen. Returning null (rather than the
            // provider default) is what makes a capability-constrained task fail CLOSED.
            return entry.models?.length ? null : (entry.defaultCapabilities ?? null);
        },
    };
}

/**
 * A view of `registry` with `ids` removed from TENANT SELECTION only.
 *
 * Used at composition when the transport reports providers it cannot serve under this
 * operator's configuration (see `TransportAdapter.unservableProviders`). It narrows rather
 * than removes on purpose: the provider stays registered, so the platform path, the
 * keyless-mismatch guard and `PROVIDER_UNREGISTERED` verdicts all behave exactly as before —
 * only the tenant-facing surfaces (form, `/providers`, write paths, verify) stop offering it.
 *
 * Returns the same registry unchanged when there is nothing to narrow.
 */
export function withTenantSelectionRemoved(registry: AiProviderRegistry, ids: readonly string[]): AiProviderRegistry {
    if (ids.length === 0) return registry;
    const removed = new Set(ids);
    return {
        ...registry,
        get: (providerId) => registry.get(providerId),
        has: (providerId) => registry.has(providerId),
        list: () => registry.list(),
        tenantSelectable: () => registry.tenantSelectable().filter((entry) => !removed.has(entry.id)),
        isTenantSelectable: (providerId) =>
            !(providerId && removed.has(providerId)) && registry.isTenantSelectable(providerId),
        requiresKeyFor: (providerId) => registry.requiresKeyFor(providerId),
        capabilitiesFor: (providerId, modelId) => registry.capabilitiesFor(providerId, modelId),
    };
}

/** Every operator-only key for a provider — universal set plus the provider's own. */
export function destinationKeysFor(registry: AiProviderRegistry, providerId: string): Set<string> {
    const keys = new Set<string>(UNIVERSAL_DESTINATION_KEYS);
    for (const key of registry.get(providerId)?.destinationKeys ?? []) keys.add(key);
    return keys;
}
