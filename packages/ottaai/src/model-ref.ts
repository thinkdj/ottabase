// ============================================================
// @ottabase/ottaai — Model-ref grammar (three forms, one column)
// ============================================================
// | stored value        | resolves to                                                    |
// | ------------------- | -------------------------------------------------------------- |
// | bare id             | qualified with the credential's provider                       |
// | already qualified   | verbatim — but the provider head MUST match the credential's   |
// | `dynamic/<route>`   | verbatim; provider/model/A-B split/budget live in the gateway   |
//
// The middle row used to read "even if the credential's provider differs". That was an
// escape hatch onto a request routed to one provider and authenticated for another — see
// `modelProviderMismatch` for why both the write path and the transport now refuse it.
//
// Qualification MUST be idempotent — that is precisely what lets one column hold
// three forms with no discriminator column.
// ============================================================

import type { AiProviderRegistry } from './registry';

/** Prefix that marks a gateway dynamic route. Operator namespace — NEVER tenant input. */
export const DYNAMIC_MODEL_PREFIX = 'dynamic/';

export type ParsedModelRef =
    | { form: 'dynamic'; dynamic: true; route: string; provider: null; model: string; raw: string }
    | { form: 'qualified'; dynamic: false; provider: string; model: string; raw: string }
    | { form: 'bare'; dynamic: false; provider: null; model: string; raw: string };

/**
 * Parse a stored model reference.
 *
 * TRAP — "contains a slash ⇒ already qualified" is wrong, twice over:
 *
 *  1. THE SIGIL. Cloudflare's edge-inference model ids are themselves slash paths
 *     beginning with `@` (`@cf/meta/llama-…`). Naive splitting turns `@cf` into a
 *     provider and corrupts the id silently. A head beginning with `@` is NEVER a provider.
 *
 *  2. ORG-PREFIXED IDS. Open-weights registries publish ids shaped `<org>/<Model-Name>`,
 *     whose head is a lowercase-alnum-hyphen ORGANISATION, not a provider. A rule of
 *     "any lowercase-alnum-hyphen head is a provider" silently reinterprets those,
 *     discards the credential's real provider, and routes nowhere.
 *
 * The rule that survives both: **a head is a provider iff it does not begin with `@`
 * AND it is registered on this instance.** Unregistered heads are part of the model id.
 * That costs the "future providers parse without registration" convenience, and the
 * trade is right: an unregistered provider is already ineligible at resolve time, so a
 * provider you have not registered cannot be used anyway.
 *
 * Split on the FIRST slash only, keeping the whole multi-slash tail. A bare id parses
 * to a `null` provider — never an empty string, never a default.
 */
export function parseModelRef(raw: string, registry: AiProviderRegistry): ParsedModelRef {
    const value = raw.trim();

    if (value.startsWith(DYNAMIC_MODEL_PREFIX)) {
        return {
            form: 'dynamic',
            dynamic: true,
            route: value.slice(DYNAMIC_MODEL_PREFIX.length),
            provider: null,
            model: value,
            raw: value,
        };
    }

    const slash = value.indexOf('/');
    if (slash > 0 && !value.startsWith('@')) {
        const head = value.slice(0, slash);
        if (registry.has(head)) {
            return { form: 'qualified', dynamic: false, provider: head, model: value.slice(slash + 1), raw: value };
        }
    }

    return { form: 'bare', dynamic: false, provider: null, model: value, raw: value };
}

/**
 * Combine a provider with a model reference into the value that goes on the wire.
 *
 * IDEMPOTENT by contract: an already-qualified or dynamic ref is returned unchanged,
 * even when a *different* provider is passed. Without that you get doubled prefixes
 * (`openai/openai/gpt-4o`) or you need a discriminator column.
 */
export function qualifyModelRef(
    provider: string | null | undefined,
    model: string | null | undefined,
    registry: AiProviderRegistry,
): string | null {
    if (!model) return null;
    const parsed = parseModelRef(model, registry);
    if (parsed.form !== 'bare') return parsed.raw;
    if (!provider) return parsed.model;
    return `${provider}/${parsed.model}`;
}

/** True when a model reference targets a gateway dynamic route. */
export function isDynamicModelRef(model: string | null | undefined): boolean {
    return typeof model === 'string' && model.trim().startsWith(DYNAMIC_MODEL_PREFIX);
}

/**
 * A qualified model ref that names a DIFFERENT provider than the credential it is stored on.
 *
 * THIS IS INVALID, NOT MERELY SUSPICIOUS — and it used to be the documented "escape hatch".
 * The escape hatch does not survive contact with a real transport: the URL is chosen from the
 * model's provider while the auth header is chosen from the credential's, so the request is
 * routed to provider B carrying provider A's key. The two possible outcomes are an upstream
 * 401 that reads to the tenant as "your key is invalid" (the good case), or, on a provider
 * pair that happens to share an auth scheme, a LIVE CREDENTIAL SUBMISSION to a provider the
 * tenant never chose.
 *
 * So both ends refuse it: the write path rejects the pairing (see
 * `AiProviderCredential.create`/`update`) and the gateway transport rejects a per-call
 * override that does the same thing. Neither can be the only check — a per-call model never
 * touches the write path, and auto-CRUD never touches the transport.
 *
 * @returns an explanatory message, or null when the pairing is coherent.
 */
export function modelProviderMismatch(
    credentialProvider: string,
    model: string | null | undefined,
    registry: AiProviderRegistry,
): string | null {
    if (!model) return null;
    const parsed = parseModelRef(model, registry);
    if (parsed.form !== 'qualified') return null;
    if (parsed.provider === credentialProvider) return null;
    return (
        `Model "${parsed.raw}" targets provider "${parsed.provider}" but this credential is for ` +
        `"${credentialProvider}". A model reference may not change the provider — save a credential for ` +
        `"${parsed.provider}" instead, or use a bare model id.`
    );
}
