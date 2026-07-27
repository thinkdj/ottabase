// ============================================================
// @ottabase/ottaai — Merge rules
// ============================================================
// The credential layers OVER the platform config; unset fields fall through.
// A BYOK credential normally supplies only a secret and a model, and rides the
// platform's gateway.
//
// THREE RULES CARRY ALL THE VALUE:
//   1. The TENANT SECRET REPLACES THE PLATFORM SECRET ENTIRELY. Tenant's key ⇒
//      tenant's bill. NEVER send both.
//   2. Model and provider combine into a QUALIFIED reference, kept verbatim if
//      already qualified or dynamic.
//   3. Everything else INHERITS. That is what lets a tenant bring only a key and a
//      model — and what makes an injected `fetch` survive into tenant clients, so
//      resolver tests need no network.
// ============================================================

import { destinationKeysFor, type AiProviderRegistry } from '../registry';
import { qualifyModelRef } from '../model-ref';
import { SecretValue } from '../secret';
import type { CredentialRecord, MergedTransportConfig, PlatformAiConfig, ResolutionSource } from '../types';

export interface MergeInput {
    platform: PlatformAiConfig;
    registry: AiProviderRegistry;
    /** The selected credential, or null on the platform path. */
    credential: CredentialRecord | null;
    /** The decrypted inline secret, when the credential carries one. */
    tenantSecret: SecretValue | null;
    /** The final model reference from the SEPARATE model-resolution chain. */
    model: string | null;
    taskKey: string;
    context: { organizationId: string | null; userId: string | null; appId: string | null };
}

/**
 * TRAP — THE MERGE IS SUBTRACTIVE ON SECRETS, AND A NAIVE SPREAD BREAKS THE STRICTEST MODE.
 *
 * Spreading the whole platform fallback and overlaying credential fields inherits the
 * platform provider key on paths where it must not be inherited. Two live holes:
 *
 *  • A KEYLESS credential for a `requiresKey: false` provider passes the keyless-mismatch
 *    guard (which fires only when a key IS required), merges, and inherits the platform
 *    key — so `mode: 'byok'` produced a client with ZERO tenant secret, funded entirely by
 *    the operator.
 *  • An ALIAS-ONLY credential keeps the platform key alongside the alias, so two auth
 *    mechanisms go out together and the gateway silently arbitrates.
 *
 * | credential carries | resulting config                                                     |
 * | ------------------ | -------------------------------------------------------------------- |
 * | inline secret      | tenant's provider key; DELETE any inherited alias                    |
 * | alias only         | tenant's alias; DELETE any inherited provider key                    |
 * | both               | tenant's key + tenant's alias; nothing inherited                     |
 * | neither            | tenant model applied; inherited provider key DELETED                 |
 *
 * ONE INVARIANT: a credential either supplies the COMPLETE provider authentication or it
 * supplies NONE; the two sides are never mixed.
 */
export function mergeConfig(input: MergeInput): MergedTransportConfig {
    const { platform, credential } = input;
    const source: Exclude<ResolutionSource, null> = credential ? 'byok' : 'platform';
    const provider = credential?.provider ?? platform.provider ?? '';

    // Start from the operator's transport bag — the tenant NEVER contributes a
    // destination-bearing key (validated on write, filtered again here as defence in depth).
    const transportConfig: Record<string, unknown> = { ...(platform.transportConfig ?? {}) };
    if (credential?.transportConfig) {
        const forbidden = destinationKeysFor(input.registry, provider);
        for (const [key, value] of Object.entries(credential.transportConfig)) {
            if (forbidden.has(key)) continue;
            transportConfig[key] = value;
        }
    }

    let secret: SecretValue | null = null;
    let alias: string | null = null;

    if (credential) {
        // Subtractive: the tenant either owns the authentication for this call, or none of it.
        if (credential.secret.kind === 'inline') {
            secret = input.tenantSecret;
        } else if (credential.secret.kind === 'alias') {
            alias = credential.secret.alias;
        }
        // `secretKind === 'none'` leaves BOTH null — the platform key is deliberately NOT
        // inherited. Without this deletion a keyless credential quietly spends the platform
        // key under a `byok` label.
    } else {
        // Platform path. The platform key is wrapped in the same redacting holder as a tenant
        // key so error/telemetry paths cannot distinguish them and leak one but not the other.
        secret = platform.providerKey ? new SecretValue(platform.providerKey) : null;
    }

    return {
        provider,
        model: qualifyModelRef(provider, input.model, input.registry),
        secret,
        alias,
        accountId: platform.accountId,
        gateway: platform.gateway,
        gatewayToken: platform.gatewayToken,
        fetch: platform.fetch,
        defaults: platform.defaults,
        transportConfig,
        // Provenance is injected into the CLIENT'S CONFIG DEFAULTS, not per call, so every
        // call from that client carries the tag automatically. Per-call-site tagging is the
        // version that drifts — and partial metering is worse than none, because the numbers
        // look plausible and get used.
        provenance: {
            source,
            credentialId: credential?.id ?? null,
            taskKey: input.taskKey,
            appId: input.context.appId,
            organizationId: input.context.organizationId,
            userId: input.context.userId,
        },
    };
}

/**
 * THE KEYLESS-MISMATCH GUARD.
 *
 * Skip a selected credential when ALL THREE hold:
 *   1. `registry.requiresKeyFor(provider)`  — a dynamic model ref counts as requiring a key
 *      regardless of the credential's provider, because the route's provider is unknown here
 *      and fail-safe is the only defensible default;
 *   2. the credential's `secretKind === 'none'` — an ALIAS COUNTS AS A SECRET;
 *   3. the platform fallback carries a provider key THAT THE EFFECTIVE MODE PERMITS USING.
 *
 * TERM 3 IS THE ONE THAT GETS "SIMPLIFIED AWAY". Without it, gateway-billed deployments
 * break entirely: there is no platform provider key, and a keyless credential is PERFECTLY
 * VALID BYOK. Only skip when there is something to mismatch against.
 * >>> COUNTER-CASE, ATTACHED HERE ON PURPOSE: a Workers-AI / gateway-billed deployment has
 * >>> `platform.providerKey === undefined`. Deleting term 3 makes every such tenant fall
 * >>> through to a platform config that also has no key. Do not delete term 3.
 *
 * The "mode permits" clause matters: under `byok` the platform key exists but may not be
 * used, so the guard does NOT fire and the row proceeds to the `NO_TENANT_SECRET` exit —
 * one reason, not two defensible ones.
 *
 * THE FAILURE PREVENTED: merging such a row pairs the TENANT'S MODEL with the PLATFORM'S
 * (usually different provider's) KEY. It fails confusingly, or worse, succeeds against the
 * wrong provider.
 *
 * THE PART THAT IS EASY TO GET WRONG: the guard discards the WHOLE CREDENTIAL, INCLUDING
 * ITS MODEL. The fall-through uses the PLATFORM'S model. Half-merging tenant model over
 * platform key is exactly the failure being prevented.
 */
export function keylessMismatch(input: {
    credential: CredentialRecord;
    registry: AiProviderRegistry;
    platform: PlatformAiConfig;
    mayUsePlatformKey: boolean;
    /** True when the credential's model is a `dynamic/<route>` reference. */
    dynamicModel: boolean;
}): boolean {
    const requiresKey = input.dynamicModel || input.registry.requiresKeyFor(input.credential.provider);
    if (!requiresKey) return false;
    if (input.credential.secret.kind !== 'none') return false;
    if (!input.platform.providerKey) return false;
    if (!input.mayUsePlatformKey) return false;
    return true;
}
