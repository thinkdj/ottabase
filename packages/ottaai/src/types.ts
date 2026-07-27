// ============================================================
// @ottabase/ottaai — Core types (L0, dependency-free)
// ============================================================
// Vocabulary, normalised once so the rest of the package can stop arguing about it:
//   mode      — WHERE a key may come from
//   strategy  — WHOSE key outranks whose
//   context   — the AUTHENTICATED org/user/app of this request
//   source    — 'byok' | 'platform' | null
//   reason    — WHY that source
//   task key  — which declared task this call belongs to
//
// Two collisions worth naming because they are silent:
//   • Do NOT name either the precedence dial or the request identity `scope` —
//     they sit one line apart at every call site.
//   • Do NOT use `app` as a mode or source value. `appId` is a real tenancy
//     dimension here, so `mode: 'app'` reads as "the app dimension". Use `platform`.
// ============================================================

import type { AiCapability } from './registry';
import type { SecretRef, SecretValue } from './secret';

// ---------------------------------------------------------------------------
// Dials
// ---------------------------------------------------------------------------

/**
 * Where a key may come from — really TWO PERMISSION BITS.
 *
 * | mode       | mayUseTenantKey | mayUsePlatformKey |
 * | ---------- | --------------- | ----------------- |
 * | `platform` | ✗               | ✓                 |
 * | `auto`     | ✓               | ✓                 |
 * | `byok`     | ✓               | ✗                 |
 * | —          | ✗               | ✗ → error         |
 */
export type AiMode = 'platform' | 'auto' | 'byok';

/** Whose key outranks whose. A TASK MAY NEVER OVERRIDE THIS — see `AiTaskPolicy`. */
export type AiStrategy = 'user' | 'org' | 'user-then-org' | 'org-then-user';

/** App-dimension matching. `strict` is the default and the only safe first configuration. */
export type AppScope = 'strict' | 'wildcard';

/** What happens when the SELECTED credential fails at runtime. */
export type DegradationPolicy = 'strict' | 'platform-on-auth-error';

/** What happens when a credential row exists but cannot be decrypted. */
export type CredentialErrorPolicy = 'fail-closed' | 'fall-through';

/** Two permission bits, derived from a mode. */
export interface ModeBits {
    mayUseTenantKey: boolean;
    mayUsePlatformKey: boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

declare const AI_CONTEXT_BRAND: unique symbol;

/**
 * The tenancy tuple a host maps its own auth type onto.
 *
 * `impersonated` is REQUIRED rather than optional on purpose: an impersonated session
 * resolving to the tenant's credential means staff actions spend the tenant's money and
 * are attributed to the tenant with no marker anywhere. Making the field required forces
 * every host to state the answer instead of inheriting a silent `false`.
 */
export interface AiTenancyTuple {
    userId: string | null;
    organizationId: string | null;
    /**
     * The deployment's app identity. MUST come from authenticated deployment identity
     * (config), NEVER from a request header, host, or query parameter — it is an
     * isolation boundary, and a boundary derived from client input is not one.
     */
    appId: string | null;
    /** True when a support/staff actor is acting AS this user. Derived, never a call-site parameter. */
    impersonated: boolean;
}

/**
 * An authenticated resolution context.
 *
 * BRANDED AND WITHOUT A PUBLIC CONSTRUCTOR. The only way a consuming app can mint one is
 * `instance.contextFrom(hostSecurityContext)`, so an inline object literal does not
 * type-check anywhere in that app.
 *
 * WHY THAT MATTERS: the resolver deliberately bypasses RLS (it is trusted code with an
 * already-authenticated context). A resolver running on an UNVERIFIED context is a
 * cross-tenant key oracle, and the realistic bug is mundane — an org id derived from a
 * header, subdomain or query parameter, fed to both the RLS policy and the RLS-bypassing
 * resolver. Set one header, run on another tenant's key and bill.
 *
 * WHAT THE BRAND IS NOT: an authorization boundary. It stops an ACCIDENT (a hand-built
 * literal), not an adversary — the minting function is one import away for anyone editing
 * this package, and `contextFrom` trusts whatever the host's mapper returns. Membership is
 * verified separately and unconditionally, on every resolution, inside the resolver.
 *
 * The minting function deliberately lives in `internal/brand.ts` and is NOT re-exported from
 * any entry point, so "no public constructor" is a fact about the package surface rather than
 * a comment. It used to sit here, which meant `export * from './types'` published it.
 */
export interface AiContext extends AiTenancyTuple {
    readonly [AI_CONTEXT_BRAND]: true;
}

// ---------------------------------------------------------------------------
// Credential record (the plain-record boundary)
// ---------------------------------------------------------------------------

/**
 * A credential as the PURE layers see it: a plain record, never an ORM instance.
 *
 * With ORM instances in the pure layer, every consumer's tests duplicate a cast through
 * a constructor that is not public API — and the "storage interface" becomes fiction,
 * because every implementation would have to produce ORM instances.
 *
 * NON-SERIALISABLE BY CONSTRUCTION: `secret` carries the union, so a record must never
 * be handed to `JSON.stringify`, a log call, or an event payload. The redacting
 * `SecretValue` holder covers decrypted plaintext; ciphertext and alias are covered by
 * never putting a record in an event payload (the payload types forbid it).
 *
 * Two details must survive the store's row→record mapping:
 *  • ABSENT FLAGS ARE PERMISSIVE — only an explicit `false` disables or deactivates, so
 *    migrated/seeded/imported rows are not silently dead.
 *  • The tie-break timestamp is read DEFENSIVELY (Date *or* epoch number) because casts
 *    may not have been applied.
 */
export interface CredentialRecord {
    id: string;
    label: string | null;
    provider: string;
    /** Bare id, qualified ref, or `dynamic/<route>` — one column holds all three. */
    model: string | null;
    secret: SecretRef;
    keyHint: string;
    /** Tenant pause switch. HARD FILTER. Absent counts as enabled. */
    enabled: boolean;
    /** Tenant preference among siblings. RANK ONLY — never excludes. Absent counts as active. */
    isActive: boolean;
    organizationId: string | null;
    userId: string | null;
    appId: string | null;
    createdAt: number;
    updatedAt: number;
    /** Non-secret, operator-validated per-provider bag (see `destinationKeysFor`). */
    transportConfig: Record<string, unknown> | null;
    /** Keyring index — the ENVELOPE stays authoritative, these columns are for batching only. */
    keyId: string | null;
    formatVersion: string | null;
    // Health (system-written only — see the three-axis lifecycle rule).
    lastUsedAt: number | null;
    lastSuccessAt: number | null;
    lastErrorAt: number | null;
    lastErrorCode: string | null;
    consecutiveFailures: number;
}

/**
 * The safe projection of a credential — everything the management UI and support need,
 * with the secret union STRUCTURALLY ABSENT from the type.
 *
 * `explainResolution` returns these, never `CredentialRecord`s: a version that returns
 * records serves every ciphertext in scope over HTTP and into ticket attachments.
 */
export interface CredentialView {
    id: string;
    label: string | null;
    provider: string;
    model: string | null;
    keyHint: string;
    hasSecret: boolean;
    secretKind: SecretRef['kind'];
    enabled: boolean;
    isActive: boolean;
    scope: 'user' | 'organization' | 'user+organization' | 'unscoped';
    organizationId: string | null;
    userId: string | null;
    appId: string | null;
    createdAt: number;
    updatedAt: number;
    lastUsedAt: number | null;
    lastSuccessAt: number | null;
    lastErrorAt: number | null;
    lastErrorCode: string | null;
    consecutiveFailures: number;
}

// ---------------------------------------------------------------------------
// Verdicts, scores, reasons
// ---------------------------------------------------------------------------

/**
 * Every candidate gets a VERDICT; only eligible candidates get a SCORE.
 *
 * (A tri-state numeric score cannot carry these reasons — `-1` for disabled and `0`
 * for out-of-scope end up sharing a channel with specificity.)
 */
export type CredentialVerdict =
    | 'ELIGIBLE'
    | 'DISABLED'
    | 'SOFT_DELETED'
    | 'APP_MISMATCH'
    | 'NOT_IN_SCOPE'
    | 'CAPABILITY_UNMET'
    | 'PROVIDER_UNREGISTERED';

/** Why the resolver ended where it did. Returned on EVERY path — public API. */
export type ResolutionReason =
    | 'SELECTED'
    | 'PLATFORM_FALLBACK'
    | 'PLATFORM_INCOMPLETE'
    | 'MODE_PLATFORM_ONLY'
    | 'IMPERSONATED_ACTOR'
    | 'NO_TENANT_CONTEXT'
    | 'NO_CREDENTIAL'
    | 'ALL_DISABLED'
    | 'CAPABILITY_UNMET'
    | 'PROVIDER_UNREGISTERED'
    | 'APP_MISMATCH'
    | 'NOT_IN_SCOPE'
    | 'CREDENTIAL_UNREADABLE'
    | 'SKIPPED_KEYLESS_MISMATCH'
    | 'NO_TENANT_SECRET'
    | 'MERGE_INCOMPLETE'
    | 'BYOK_DISABLED';

/** Where the key that will pay for this call came from. */
export type ResolutionSource = 'byok' | 'platform' | null;

/** Per-candidate detail for `explainResolution` — a verdict projection, never records. */
export interface CandidateExplanation extends CredentialView {
    verdict: CredentialVerdict;
    /** Specificity score. Present only for `ELIGIBLE` candidates. */
    score?: number;
    /** True for the candidate the ranking selected. */
    selected: boolean;
}

// ---------------------------------------------------------------------------
// Platform config + merged transport config
// ---------------------------------------------------------------------------

/**
 * The operator's fallback configuration. Enumerated (rather than left as a bag) because
 * the merge invariant, the boot coherence check, and the adapter completeness check all
 * need it checkable.
 */
export interface PlatformAiConfig {
    /** Cloudflare account id (or the equivalent deployment identity for another transport). */
    accountId?: string;
    /** AI Gateway name / endpoint slug. */
    gateway?: string;
    /** Gateway authentication token (`cf-aig-authorization`), when the gateway is authenticated. */
    gatewayToken?: string;
    /**
     * The provider whose key `providerKey` belongs to. DECLARED, never inferred from the
     * key's prefix — inference is a guess that goes stale.
     */
    provider?: string;
    /**
     * The platform's provider key. OPTIONAL ON PURPOSE: gateway-billed inference has no
     * platform provider key, and sending no provider authorization header is a FEATURE —
     * it is what routes a call to gateway-billed inference.
     */
    providerKey?: string;
    /** Platform default model. `dynamic/<route>` is recommended (see model-ref.ts). */
    model?: string;
    /** Injected fetch — lets resolver tests run with no network. Inherited by tenant clients. */
    fetch?: typeof fetch;
    /** Per-request defaults handed to the transport (timeouts, cache ttl, …). */
    defaults?: Record<string, unknown>;
    /** Operator-only transport bag (base urls, headers, …). Never tenant-writable. */
    transportConfig?: Record<string, unknown>;
}

/**
 * The result of merging a credential OVER the platform config.
 *
 * NOTE this object carries the tenant's provider key. It exists ONLY inside the transport
 * adapter and is NEVER part of a resolution return shape — returning it would mean any app
 * that logs a resolution has written a tenant's provider key to a log aggregator.
 */
export interface MergedTransportConfig {
    provider: string;
    /** Fully qualified model ref, or null when the transport supplies one per request. */
    model: string | null;
    /** The provider key to authenticate with, if any. */
    secret: SecretValue | null;
    /** A gateway/vault-held key NAME to authenticate with, if any. */
    alias: string | null;
    accountId?: string;
    gateway?: string;
    gatewayToken?: string;
    fetch?: typeof fetch;
    defaults?: Record<string, unknown>;
    transportConfig: Record<string, unknown>;
    /** Provenance, injected into the client's config defaults so EVERY call carries it. */
    provenance: {
        source: Exclude<ResolutionSource, null>;
        credentialId: string | null;
        taskKey: string;
        appId: string | null;
        organizationId: string | null;
        userId: string | null;
    };
}

/** The redacted, non-secret projection of a resolution that IS safe to log. */
export interface ResolutionConfigSummary {
    provider: string | null;
    model: string | null;
    transport: string | null;
    /** Whether a TENANT secret (inline or validated alias) is in play. */
    tenantSecret: boolean;
}

// ---------------------------------------------------------------------------
// Resolution return shape
// ---------------------------------------------------------------------------

export interface AiResolution<TClient = unknown> {
    /** The instrumented client, or null. ABSENCE OF A CLIENT IS THE SIGNAL — resolve never throws. */
    client: TClient | null;
    source: ResolutionSource;
    /** The terminal reason. */
    reason: ResolutionReason;
    /**
     * Why the TENANT path produced nothing — populated whenever the tenant path was
     * attempted. Without this, the default configuration (`auto`) flattens every distinct
     * cause into `PLATFORM_FALLBACK`, and "why am I not on my own key?" becomes
     * permanently unanswerable.
     */
    tenantReason: ResolutionReason | null;
    credentialId: string | null;
    keyHint: string | null;
    provider: string | null;
    /** The resolved model ref (after the separate model-resolution chain). */
    model: string | null;
    configSummary: ResolutionConfigSummary;
}

// ---------------------------------------------------------------------------
// Capability requirements
// ---------------------------------------------------------------------------

export type { AiCapability };
