// ============================================================
// @ottabase/ottaai — Task declarations, mode intersection, gate strength
// ============================================================
// Call sites pass IDENTITY and a TASK KEY only. That split is the promise:
// an operator flips provisioning behaviour without touching call sites.
// ============================================================

import { AI_ERROR_CODES, AiProvisioningError } from './errors';
import type { AiCapability, AiMode, ModeBits, ResolutionSource } from './types';

// ---------------------------------------------------------------------------
// mode as two permission bits
// ---------------------------------------------------------------------------

export function modeToBits(mode: AiMode): ModeBits {
    switch (mode) {
        case 'platform':
            return { mayUseTenantKey: false, mayUsePlatformKey: true };
        case 'byok':
            return { mayUseTenantKey: true, mayUsePlatformKey: false };
        case 'auto':
        default:
            return { mayUseTenantKey: true, mayUsePlatformKey: true };
    }
}

export function bitsToMode(bits: ModeBits): AiMode | null {
    if (bits.mayUseTenantKey && bits.mayUsePlatformKey) return 'auto';
    if (bits.mayUseTenantKey) return 'byok';
    if (bits.mayUsePlatformKey) return 'platform';
    return null;
}

/**
 * COMPOSITION LAW: `effective = packageDefault ∧ appConfig ∧ taskPolicy ∧ perCallOverride`.
 * A layer may only REMOVE a permission, never grant one.
 *
 * Consequences, all intended:
 *  • app `auto` + task `byok`     ⇒ `byok`     — the gate lives in the resolver, not the browser.
 *  • app `auto` + task `platform` ⇒ `platform` — a cheap internal task is kept off tenant keys.
 *  • app `byok` + task `auto`     ⇒ `byok`     — A CALL SITE CAN NEVER RE-ENABLE a platform key
 *    the operator switched off. A cost and consent boundary set once at app config cannot be
 *    widened by a handler, a copy-paste, or a library.
 *
 * @throws when the intersection is `{✗,✗}` — programmer error. Static combinations are
 *         validated EAGERLY at composition, so only a per-call override can reach this throw.
 */
export function intersectModes(...modes: Array<AiMode | undefined>): AiMode {
    let bits: ModeBits = { mayUseTenantKey: true, mayUsePlatformKey: true };
    for (const mode of modes) {
        if (!mode) continue;
        const next = modeToBits(mode);
        bits = {
            mayUseTenantKey: bits.mayUseTenantKey && next.mayUseTenantKey,
            mayUsePlatformKey: bits.mayUsePlatformKey && next.mayUsePlatformKey,
        };
    }
    const result = bitsToMode(bits);
    if (!result) {
        throw new AiProvisioningError(
            'AI mode composition produced {tenant: false, platform: false} — no key source is permitted. ' +
                'Check the app mode, the task mode, and any per-call override. To turn BYOK off entirely, ' +
                'set `byokEnabled: false` on the instance instead of composing modes.',
            AI_ERROR_CODES.CONFIGURATION,
            { details: { modes: modes.filter(Boolean) } },
        );
    }
    return result;
}

// ---------------------------------------------------------------------------
// Gate strength
// ---------------------------------------------------------------------------

/**
 * Gate strength is a property of the TASK, read only by the gate primitives.
 * IT IS NEVER AN INPUT TO THE RESOLVER.
 *
 * | strength   | meaning                                        | requireByok            | useGate                               |
 * | ---------- | ---------------------------------------------- | ---------------------- | ------------------------------------- |
 * | `required` | the tenant's key is needed to run at all       | denies unless BYOK     | `{ allowed:false, reason }`           |
 * | `soft`     | runs on the platform; BYOK is the upsell       | always passes          | `{ allowed:true, upsell: !byok }`     |
 *
 * BYOK IS NOT A PLAN TIER. The package never takes a plan or entitlement input, and an
 * entitlement package never reads credential state. A tenant can be free-with-key or
 * paid-without-key; the axes never share gating logic.
 */
export type GateStrength = 'required' | 'soft';

/** Whether the tenant's own key is preferred, or the task pins its model. */
export type ModelPolicy = 'tenant-preferred' | 'task-pinned';

export interface AiTaskPolicy {
    /** Serialisable identity. A KEY (not an object) is what makes deferred work and memoisation possible. */
    key: string;
    /** Human label for admin/status surfaces. */
    label?: string;
    /** NARROWING ONLY — intersected with the app mode. */
    mode?: AiMode;
    /** `required` blocks without a tenant key; `soft` runs on the platform and upsells. Default `soft`. */
    gate?: GateStrength;
    /** Whether the credential's model wins, or the task's pinned model does. Default `tenant-preferred`. */
    modelPolicy?: ModelPolicy;
    /**
     * Pinned models per provider, used when `modelPolicy: 'task-pinned'`.
     * A credential whose provider has no entry is INELIGIBLE for that task — filtered at
     * eligibility so it cannot shadow a credential that can serve it.
     */
    pinnedModels?: Record<string, string>;
    /** Task default model, used when neither a per-call model nor a credential model applies. */
    defaultModel?: string;
    /** Capabilities the serving model must have. Checked as an ELIGIBILITY FILTER, not post-selection. */
    requiredCapabilities?: AiCapability[];
    /**
     * What to do with a model the registry has never seen when `requiredCapabilities` is set.
     * Default `deny` — fail closed, because a free-text model silently admitted to a vision
     * task produces a confusing upstream failure the tenant cannot diagnose.
     */
    unknownModelPolicy?: 'deny' | 'allow';
    /** NARROWING ONLY. `platform-on-auth-error` is structurally impossible under `byok`. */
    degradation?: import('./types').DegradationPolicy;
    /** NARROWING ONLY. */
    onCredentialError?: import('./types').CredentialErrorPolicy;
    /**
     * Response caching for this task. OFF by default, and always off for BYOK-sourced calls:
     * a completion cache keyed on prompt+model across a multi-tenant deployment serves tenant
     * A's completion to tenant B — worse under BYOK, because A paid for it.
     */
    responseCacheTtlSeconds?: number;

    // NOTE: there is deliberately NO `strategy` field. Strategy is one half of a decision
    // whose other half is the RLS filter dimension; a per-task strategy would mean the set
    // of credentials a tenant can MANAGE differs from the set serving a given feature,
    // differently per feature, and no management UI can honestly represent that.
}

/** A task policy with every default filled in. */
export interface ResolvedTaskPolicy extends AiTaskPolicy {
    gate: GateStrength;
    modelPolicy: ModelPolicy;
    unknownModelPolicy: 'deny' | 'allow';
}

export function resolveTaskDefaults(task: AiTaskPolicy): ResolvedTaskPolicy {
    return {
        ...task,
        gate: task.gate ?? 'soft',
        modelPolicy: task.modelPolicy ?? 'tenant-preferred',
        unknownModelPolicy: task.unknownModelPolicy ?? 'deny',
    };
}

// ---------------------------------------------------------------------------
// The gate predicate — ONE function, three call sites
// ---------------------------------------------------------------------------

export interface GateAnswer {
    allowed: boolean;
    /** True when the task would run, but on the platform — i.e. BYOK is the upsell. */
    upsell: boolean;
    gate: GateStrength;
    source: ResolutionSource;
    reason: string | null;
}

/**
 * The gate's predicate is `source === 'byok'` AND the resolved credential CARRIES A SECRET
 * (inline or a validated alias) — not `hasSecret` alone and not "a credential exists".
 *
 * WHY: a tenant who connects a `requiresKey: false` provider has a credential that resolves
 * with `source: 'byok'` and no secret at all — walking straight past the gate into the exact
 * quality the gate existed to prevent.
 *
 * Three call sites depend on this being ONE function: the status primitive, `requireByok`,
 * and the React `useGate` hook.
 */
export function evaluateGate(input: {
    gate: GateStrength;
    source: ResolutionSource;
    tenantSecretPresent: boolean;
    reason?: string | null;
}): GateAnswer {
    const onTenantKey = input.source === 'byok' && input.tenantSecretPresent;

    if (input.gate === 'required') {
        return {
            allowed: onTenantKey,
            upsell: !onTenantKey,
            gate: 'required',
            source: input.source,
            reason: onTenantKey ? null : (input.reason ?? 'BYOK_REQUIRED'),
        };
    }

    return {
        allowed: true,
        upsell: !onTenantKey,
        gate: 'soft',
        source: input.source,
        reason: input.reason ?? null,
    };
}
