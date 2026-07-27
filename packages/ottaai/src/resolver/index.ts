// ============================================================
// @ottabase/ottaai/resolver — the core (L3)
// ============================================================
// AN INSTANCE, NOT MODULE GLOBALS.
//
// Holding the master secret, registry and logger at module scope with a
// per-request setter is not merely inelegant on a reused edge isolate — it is
// INCORRECT: request A sets secret X, awaits, request B sets secret Y, A decrypts
// with Y. A single-app, single-secret deployment can never observe this, which is
// why it would be found in production by the first consumer running two apps,
// per-app key custody, or two environments in one worker — and the symptom is a
// generic decrypt failure, indistinguishable from a botched rotation.
// ============================================================

import { createDefaultDecryptorRegistry, decryptSecret, type DecryptorRegistry, type Keyring } from '../crypto';
import { AI_ERROR_CODES, AiProvisioningError, type AiErrorCode } from '../errors';
import { isDynamicModelRef, parseModelRef, qualifyModelRef } from '../model-ref';
import { keylessMismatch, mergeConfig, selectCredential, type AssessedCandidate } from '../pure';
import { createProviderRegistry, withTenantSelectionRemoved, type AiProviderRegistry } from '../registry';
import { hasSecret, SecretValue } from '../secret';
import {
    evaluateGate,
    intersectModes,
    modeToBits,
    resolveTaskDefaults,
    type AiTaskPolicy,
    type GateAnswer,
    type ResolvedTaskPolicy,
} from '../tasks';
import { brandContext } from '../internal/brand';
import {
    type AiContext,
    type AiMode,
    type AiResolution,
    type AiStrategy,
    type AiTenancyTuple,
    type AppScope,
    type CandidateExplanation,
    type CredentialErrorPolicy,
    type CredentialRecord,
    type CredentialView,
    type DegradationPolicy,
    type PlatformAiConfig,
    type ResolutionReason,
    type ResolutionSource,
} from '../types';
import { noopEventSink, type EventSink } from './events';
import { createInstrumentedClient, type AiClient, type QuotaCheck } from './instrumented-client';
import type { CredentialStore, StoreScope } from './store';
import type { RawAiClient, TransportAdapter } from './transport';

export * from './store';
export * from './transport';
export * from './events';
export * from './instrumented-client';
export * from './verify';

// ---------------------------------------------------------------------------
// Authorization seam
// ---------------------------------------------------------------------------

export type CredentialOperation = 'create' | 'update' | 'delete' | 'activate' | 'test' | 'explain' | 'status';

export interface AuthorizeInput {
    context: AiContext;
    operation: CredentialOperation;
    /** Identity of the credential being acted on, when there is one. */
    credential: { id: string | null; organizationId: string | null; userId: string | null } | null;
}

/**
 * RLS ISOLATES TENANTS, NOT MEMBERS.
 *
 * Under an org strategy, EVERY member of the org can read the key hint, replace the key,
 * disable it, or delete it. Replacement is the sharp end: a member who swaps the org key
 * for one they control makes every colleague's prompts flow through their provider
 * account — prompt exfiltration wearing a settings form.
 *
 * "PRIVILEGED READ" IS NOT PADDING: `testSavedCredential` decrypts the org key and emits
 * it outbound on a member's command; classifying that as a read is what lets a non-admin
 * member exfiltrate an org key without ever performing a mutation.
 */
export type Authorize = (input: AuthorizeInput) => boolean | Promise<boolean>;

/** Membership verification. Required whenever the strategy has an org dimension. */
export type VerifyMembership = (input: { userId: string | null; organizationId: string }) => boolean | Promise<boolean>;

// ---------------------------------------------------------------------------
// Instance options
// ---------------------------------------------------------------------------

export interface CreateAiProvisioningOptions<HostContext = unknown> {
    /** Encryption keyring. NEVER defaulted — composition fails without it. */
    keyring: Keyring;
    /** Optional extra/legacy envelope readers. Defaults to the v1 registry. */
    decryptors?: DecryptorRegistry;
    /** Credential storage. */
    store: CredentialStore;
    /** Transport. NEVER defaulted. */
    transport: TransportAdapter;
    /** The operator's fallback configuration. */
    platform: PlatformAiConfig;
    /** Per-instance provider registry. Defaults to the built-ins. */
    registry?: AiProviderRegistry;
    /** Declared tasks, keyed by task key. Validated EAGERLY at composition. */
    tasks: AiTaskPolicy[];

    /**
     * Maps the HOST'S security context onto the tenancy tuple.
     *
     * This is the ONLY function anywhere that produces the branded `AiContext`. The
     * guarantee is structural (nothing else can construct the brand) AND dependency-free
     * (the package imports no auth package).
     *
     * NAME IT `contextFrom` IN EXACTLY ONE PLACE — the app-level helper that turns an
     * HTTP request into a security context is `contextFromRequest` and belongs to the app.
     */
    contextFrom: (hostContext: HostContext) => AiTenancyTuple;

    /** Required whenever `strategy` includes an org dimension. */
    verifyMembership?: VerifyMembership;
    /** Required whenever `strategy` includes an org dimension. */
    authorize?: Authorize;

    /**
     * Hands an off-hot-path promise to a `waitUntil`-equivalent.
     *
     * BEST-EFFORT NEEDS A MECHANISM, NOT AN ADJECTIVE. On a Workers-style runtime a
     * fire-and-forget promise is either cancelled at response or it delays the call.
     * The default swallows rejections and awaits nothing; AN EDGE HOST MUST SUPPLY
     * `ctx.waitUntil`, and the failure of not doing so is silent data loss.
     */
    defer?: (promise: Promise<unknown>) => void;

    eventSink?: EventSink;
    quota?: QuotaCheck;

    // ── Dials (frozen at major; logged once at boot) ──────────────────────────
    mode?: AiMode;
    strategy?: AiStrategy;
    appScope?: AppScope;
    degradation?: DegradationPolicy;
    onCredentialError?: CredentialErrorPolicy;
    /**
     * Whether a tenant may save a credential for the WHOLE ORGANISATION. Defaults to true.
     *
     * A SERVER DIAL, not a UI prop. It reaches `handlers.create` (which refuses an
     * organization-scoped write when false) and `status().orgScopeManageable` (so the
     * settings component derives the affordance from server truth rather than from a second,
     * independently-read copy of the config). Passing it only to the React component hides a
     * radio button and leaves `POST /credentials {"scope":"organization"}` working for every
     * authorized admin with a fetch call.
     *
     * Distinct from `strategy`: the strategy decides whether such a row could ever be
     * SELECTED; this decides whether the operator wants to offer it at all.
     */
    allowOrgCredentials?: boolean;
    /**
     * The KILL SWITCH — turning BYOK off is NOT expressed as a mode.
     *
     * `app: 'platform'` + any declared `byok` task intersects to {✗,✗}, which would hard
     * throw every gated feature at boot rather than degrading. That is a foreseeable
     * adoption cliff, so this dial (a) rewrites every task's mode to `platform` BEFORE
     * composition, and (b) downgrades every `required` gate to `soft`. Intersection stays
     * the law; the kill switch is a REWRITE, not an intersection.
     */
    byokEnabled?: boolean;
    /** Emits the effective dial set once at composition. Defaults to a no-op. */
    onBoot?: (summary: Record<string, unknown>) => void;
}

export interface ResolveOptions {
    /** Narrowing only — intersected with app + task modes. */
    mode?: AiMode;
    /** Per-call model override. Beats every other rung of the model chain. */
    model?: string;
    /**
     * THREE-STATE SEAM. `undefined` ⇒ do the lookup; a record ⇒ use it; explicit `null`
     * ⇒ FORCE THE PLATFORM PATH with no lookup.
     *
     * The check is `!== undefined`, not truthiness — a `?? await lookup()` refactor
     * destroys it.
     */
    credential?: CredentialRecord | null;
    /**
     * Run stages 1–7 and stop BEFORE constructing a transport client.
     *
     * DO NOT build the status endpoint by passing `credential: null` — that is the
     * force-platform flag and it makes status report `source: 'platform'` for every
     * tenant forever, including tenants with a working key, so the gate never opens.
     */
    buildClient?: boolean;
}

export interface AiStatus {
    configured: boolean;
    source: ResolutionSource;
    reason: ResolutionReason;
    tenantReason: ResolutionReason | null;
    provider: string | null;
    model: string | null;
    credentialId: string | null;
    keyHint: string | null;
    hasSecret: boolean;
    /** The gate answer for every declared task. */
    gates: Record<string, GateAnswer>;
    /** The instance's strategy, so a client can explain what outranks what. */
    strategy: AiStrategy;
    /**
     * Whether an ORG-scoped credential is worth creating under this deployment's strategy.
     *
     * A rung the strategy cannot SCORE is dead data: under `strategy: 'user'` an org-only
     * row scores 0 and is permanently unselectable, so offering "save for the whole
     * workspace" there produces a credential that is written, listed, and never used — the
     * worst kind of bug, because nothing errors.
     *
     * NOTE this is about SELECTABILITY, not visibility. The management list is built on the
     * store's two-query fan-out (see `handlers.list`), NOT on the single-dimension RLS
     * filter, so under `user-then-org` a user still sees BOTH their own and their org's
     * rows. That is deliberate: the RLS policy guards the generic-CRUD path (which this
     * model is default-denied from anyway) as defence in depth, while the route factory
     * gives the honest union.
     *
     * The settings component ANDs this with its own `allowOrgScope` prop.
     */
    orgScopeManageable: boolean;
}

/** Strategies under which an org-scoped row can actually be selected (score > 0). */
const ORG_MANAGEABLE_STRATEGIES: AiStrategy[] = ['org', 'user-then-org', 'org-then-user'];

/** The answer to "may this context run this task?" — allowed, or allowed-not plus why. */
export type GateDecision = { allowed: true } | { allowed: false; code: AiErrorCode; reason: ResolutionReason };

export interface AiProvisioning<HostContext = unknown> {
    /** The ONLY way to mint a resolution context. */
    contextFrom(hostContext: HostContext): AiContext;

    resolve(context: AiContext, taskKey: string, options?: ResolveOptions): Promise<AiResolution<AiClient>>;

    /**
     * THE GATE AND THE CLIENT FROM ONE RESOLUTION — what an inference route should call.
     *
     * `requireByok(...)` followed by `resolve(...)` is the obvious shape and it does the
     * whole job TWICE: two candidate fan-outs (two D1 queries each under a mixed strategy)
     * and two envelope decryptions, per inference, on the hot path. Worse, the two runs can
     * legitimately disagree — a credential deleted between them turns an allowed gate into a
     * `NOT_CONFIGURED` client, which reads as a bug in the gate.
     *
     * One resolution, one verdict, one client.
     */
    resolveWithGate(
        context: AiContext,
        taskKey: string,
        options?: ResolveOptions,
    ): Promise<{ gate: GateDecision; resolution: AiResolution<AiClient> }>;

    /** "What would resolve for this context" — computed by the SAME resolver, via the dry run. */
    status(context: AiContext): Promise<AiStatus>;

    /**
     * Server-side route guard, implemented by the SAME resolver, so guard and runtime
     * cannot drift. A gate enforced in the browser is bypassable: a provider that checks a
     * derived flag and refuses to call the endpoint stops nobody with a fetch call.
     *
     * Prefer `resolveWithGate` on a route that goes on to make the call — this one builds no
     * client, so using both means resolving twice.
     */
    requireByok(context: AiContext, taskKey: string): Promise<GateDecision>;

    /** The dry run with per-candidate verdicts. Returns a VERDICT PROJECTION, never records. */
    explainResolution(
        context: AiContext,
        taskKey: string,
    ): Promise<{ resolution: AiResolution<null>; candidates: CandidateExplanation[] }>;

    readonly registry: AiProviderRegistry;
    readonly store: CredentialStore;
    readonly keyring: Keyring;
    readonly decryptors: DecryptorRegistry;
    readonly strategy: AiStrategy;
    readonly appScope: AppScope;
    /** The `allowOrgCredentials` dial, read by the route factory and by `status()`. */
    readonly orgCredentialsAllowed: boolean;
    /**
     * Whether a PLATFORM call can actually be made under this configuration — asked of the
     * transport at composition, not inferred from `platform.providerKey`.
     *
     * THE DISTINCTION IS LOAD-BEARING FOR SPEND WARNINGS. Gateway-billed inference has no
     * provider key: a gateway holding the credential (a BYOK alias, unified billing) still
     * produces a complete platform config, so a key-based check reports "nothing to protect"
     * on a deployment that can very much spend the operator's money. Host-side warnings about
     * missing rate limiting must key on this.
     */
    readonly platformRouteUsable: boolean;
    readonly tasks: ReadonlyMap<string, ResolvedTaskPolicy>;
    readonly platform: PlatformAiConfig;
    readonly transport: TransportAdapter;
    readonly emit: EventSink;
    readonly defer: (promise: Promise<unknown>) => void;
    readonly authorizeOp: Authorize;
    readonly verifyMembershipFn: VerifyMembership | null;
}

const STRATEGIES_WITH_ORG: AiStrategy[] = ['org', 'user-then-org', 'org-then-user'];

/** Project a record into the safe view. The secret union is structurally absent. */
export function toCredentialView(record: CredentialRecord): CredentialView {
    const scope =
        record.organizationId && record.userId
            ? 'user+organization'
            : record.organizationId
              ? 'organization'
              : record.userId
                ? 'user'
                : 'unscoped';
    return {
        id: record.id,
        label: record.label,
        provider: record.provider,
        model: record.model,
        keyHint: record.keyHint,
        hasSecret: hasSecret(record.secret),
        secretKind: record.secret.kind,
        enabled: record.enabled !== false,
        isActive: record.isActive !== false,
        scope,
        organizationId: record.organizationId,
        userId: record.userId,
        appId: record.appId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        lastUsedAt: record.lastUsedAt,
        lastSuccessAt: record.lastSuccessAt,
        lastErrorAt: record.lastErrorAt,
        lastErrorCode: record.lastErrorCode,
        consecutiveFailures: record.consecutiveFailures,
    };
}

export function createAiProvisioning<HostContext = unknown>(
    options: CreateAiProvisioningOptions<HostContext>,
): AiProvisioning<HostContext> {
    // ── Boot-tier validation: THROW. Misconfiguration a developer must fix. ──────
    if (!options.keyring) {
        throw new AiProvisioningError(
            'createAiProvisioning requires a keyring. Credential encryption is never optional.',
            AI_ERROR_CODES.CONFIGURATION,
        );
    }
    if (!options.transport) {
        throw new AiProvisioningError(
            'createAiProvisioning requires a transport adapter.',
            AI_ERROR_CODES.CONFIGURATION,
        );
    }
    if (!options.store) {
        throw new AiProvisioningError(
            'createAiProvisioning requires a credential store.',
            AI_ERROR_CODES.CONFIGURATION,
        );
    }

    const byokEnabled = options.byokEnabled !== false;
    const strategy: AiStrategy = options.strategy ?? 'user-then-org';
    const appScope: AppScope = options.appScope ?? 'strict';
    const orgCredentialsAllowed = options.allowOrgCredentials !== false;
    const appMode: AiMode = byokEnabled ? (options.mode ?? 'auto') : 'platform';
    const degradation: DegradationPolicy = options.degradation ?? 'strict';
    const onCredentialError: CredentialErrorPolicy = options.onCredentialError ?? 'fail-closed';
    // ASK THE TRANSPORT WHAT THIS DEPLOYMENT CAN ACTUALLY SERVE, at composition.
    //
    // A provider the transport supports in principle but cannot route under THIS operator's
    // config (Azure without `resourceName`/`deploymentName`/`apiVersion`) would otherwise be
    // offered in the form, accept a real tenant key, save, list — and fail every call with
    // `MERGE_INCOMPLETE`. Narrowing here means the offer is never made, and it is narrowing
    // rather than unregistering so the platform path and the keyless-mismatch guard are
    // untouched. Computed ONCE per instance: the answer depends only on operator config.
    const baseRegistry = options.registry ?? createProviderRegistry();
    const unservableProviders = options.transport.unservableProviders?.(options.platform) ?? [];
    const registry = withTenantSelectionRemoved(baseRegistry, unservableProviders);
    const decryptors = options.decryptors ?? createDefaultDecryptorRegistry();
    const emit = options.eventSink ?? noopEventSink;
    const defer = options.defer ?? ((promise) => void Promise.resolve(promise).catch(() => {}));

    const orgDimension = STRATEGIES_WITH_ORG.includes(strategy);
    if (orgDimension && !options.verifyMembership) {
        throw new AiProvisioningError(
            `strategy "${strategy}" includes an organization dimension, so createAiProvisioning requires ` +
                'a `verifyMembership(actor, orgId)` callback. A host with no membership source must write one — ' +
                '"the framework did not expose a list" is exactly the deployment where the check matters most.',
            AI_ERROR_CODES.CONFIGURATION,
        );
    }
    if (orgDimension && !options.authorize) {
        throw new AiProvisioningError(
            `strategy "${strategy}" includes an organization dimension, so createAiProvisioning requires an ` +
                '`authorize` hook. RLS isolates tenants, not members: without it, any org member could replace ' +
                "the org's provider key with one they control and harvest colleagues' prompts.",
            AI_ERROR_CODES.CONFIGURATION,
        );
    }

    // ── Tasks: apply the kill switch, then validate EVERY declared task eagerly ──
    const tasks = new Map<string, ResolvedTaskPolicy>();
    for (const declared of options.tasks) {
        const rewritten: AiTaskPolicy = byokEnabled
            ? declared
            : { ...declared, mode: 'platform', gate: declared.gate === 'required' ? 'soft' : declared.gate };
        const task = resolveTaskDefaults(rewritten);
        // Throws when the static intersection is {✗,✗} — a task that can never run is a
        // BOOT ERROR, not a silent dead feature.
        const effective = intersectModes(appMode, task.mode);
        if (effective === 'byok' && task.degradation === 'platform-on-auth-error') {
            throw new AiProvisioningError(
                `Task "${task.key}" declares degradation 'platform-on-auth-error' under an effective 'byok' mode. ` +
                    'Degrading to the platform key is structurally impossible when the platform key may not be used.',
                AI_ERROR_CODES.CONFIGURATION,
            );
        }
        tasks.set(task.key, task);
    }

    // ── Platform coherence, validated AT BOOT, not at first inference ────────────
    if (options.platform.providerKey && !options.platform.provider) {
        throw new AiProvisioningError(
            "platform.providerKey is set but platform.provider is not. The key's provider must be DECLARED — " +
                "inferring it from the key's prefix is a guess that goes stale.",
            AI_ERROR_CODES.CONFIGURATION,
        );
    }
    if (options.platform.provider && options.platform.model) {
        if (isDynamicModelRef(options.platform.model)) {
            // The route owns provider selection and the operator has taken that
            // responsibility, so the check is UNANSWERABLE — skip it out loud rather than
            // passing silently.
            options.onBoot?.({
                coherenceCheck: 'skipped',
                why: 'platform.model is a dynamic/<route> ref; the gateway route owns provider selection.',
            });
        } else {
            const parsed = parseModelRef(options.platform.model, registry);
            if (parsed.form === 'qualified' && parsed.provider !== options.platform.provider) {
                throw new AiProvisioningError(
                    `Platform config is incoherent: providerKey belongs to "${options.platform.provider}" but the ` +
                        `default model "${options.platform.model}" targets "${parsed.provider}". This fails silently ` +
                        'and confusingly at first inference.',
                    AI_ERROR_CODES.CONFIGURATION,
                );
            }
        }
    }

    /**
     * WHETHER A PLATFORM CALL CAN ACTUALLY BE MADE — asked of the TRANSPORT, not inferred
     * from `providerKey`.
     *
     * "The operator has a provider key" is the wrong predicate and it is wrong in the
     * direction that matters. GATEWAY-BILLED INFERENCE HAS NO PROVIDER KEY: a gateway holding
     * the credential (a BYOK alias, unified billing) still yields a complete platform config,
     * so a deployment with `accountId` + `gateway` + `provider` and NO `CFAI_*_API_KEY` can
     * spend the operator's money while a key-based check reports "nothing to protect". Every
     * spend warning derived from that predicate then stays silent on exactly the deployment
     * that needed it.
     *
     * Computed ONCE at composition by building the platform path's own merged config and
     * asking `transport.isComplete` — the same question the resolver asks at stage 9.
     */
    const platformRouteUsable = options.transport.isComplete(
        mergeConfig({
            platform: options.platform,
            registry,
            credential: null,
            tenantSecret: null,
            model: options.platform.model ?? null,
            taskKey: '__boot__',
            context: brandContext({ userId: null, organizationId: null, appId: null, impersonated: false }),
        }),
    );

    options.onBoot?.({
        mode: appMode,
        strategy,
        appScope,
        degradation,
        onCredentialError,
        byokEnabled,
        allowOrgCredentials: orgCredentialsAllowed,
        transport: options.transport.name,
        providers: registry.list().map((p) => p.id),
        // Logged separately because "which providers exist" and "which providers a TENANT may
        // pick" are different answers, and the gap between them is a support question.
        tenantSelectableProviders: registry.tenantSelectable().map((p) => p.id),
        // Named explicitly: "why is Azure missing from the form?" must be answerable from the
        // boot log, not from reading the transport.
        ...(unservableProviders.length > 0 ? { unservableUnderThisConfig: unservableProviders } : {}),
        tasks: [...tasks.values()].map((t) => ({ key: t.key, mode: t.mode ?? appMode, gate: t.gate })),
        keyIds: options.keyring.keyIds(),
        currentKeyId: options.keyring.currentKeyId,
        platform: {
            provider: options.platform.provider ?? null,
            model: options.platform.model ?? null,
            hasProviderKey: Boolean(options.platform.providerKey),
            gateway: options.platform.gateway ?? null,
        },
        // Whether the platform path can serve a call AT ALL. A host's own spend warnings
        // should key on this, not on `hasProviderKey` — see the note on `platformRouteUsable`.
        platformRouteUsable,
        // A USABLE PLATFORM ROUTE WITH NO QUOTA HOOK IS UNBOUNDED OPERATOR SPEND.
        //
        // Surfaced, not thrown. Missing `authorize` is a SECURITY hole (any org member can
        // take the shared key), so that one hard-fails at composition. This is a COST hole:
        // recoverable, visible on an invoice, and hard-failing it would brick every existing
        // deployment that has a platform route. But it is silent by nature — everything works
        // and the bill arrives later — so it must at least be in the record.
        ...(platformRouteUsable && !options.quota ? { platformSpendUnbounded: true } : {}),
    });

    if (platformRouteUsable && !options.quota) {
        console.warn(
            '[ottaai] A usable platform AI route is configured but NO `quota` hook was supplied. Every ' +
                "authenticated caller can spend the operator's budget without limit. Pass `quota` to " +
                'createAiProvisioning.',
        );
    }

    /** The shipped default: refuse org-scoped operations when no hook is configured. */
    const authorizeOp: Authorize =
        options.authorize ??
        ((input) => {
            // User-scoped rows are self-owned and need no gate.
            if (!input.credential?.organizationId) return true;
            throw new AiProvisioningError(
                'An org-scoped credential operation was attempted but no `authorize` hook is configured. ' +
                    'Pass `authorize` to createAiProvisioning.',
                AI_ERROR_CODES.CONFIGURATION,
            );
        });

    function taskOrThrow(taskKey: string): ResolvedTaskPolicy {
        const task = tasks.get(taskKey);
        if (!task) {
            throw new AiProvisioningError(
                `Unknown AI task "${taskKey}". Declare it in createAiProvisioning({ tasks }).`,
                AI_ERROR_CODES.CONFIGURATION,
            );
        }
        return task;
    }

    /**
     * THE SEPARATE MODEL-RESOLUTION CHAIN. The credential is AUTH; the model is POLICY.
     *
     * | # | source                | applies when                                          |
     * | - | --------------------- | ----------------------------------------------------- |
     * | 1 | per-call explicit     | always (escape hatch)                                  |
     * | 2 | task's pinned model   | `modelPolicy: 'task-pinned'`                           |
     * | 3 | credential's model    | `source === 'byok'` and task is tenant-preferred       |
     * | 4 | task's default model  | —                                                      |
     * | 5 | platform default      | —                                                      |
     */
    function resolveModel(input: {
        task: ResolvedTaskPolicy;
        credential: CredentialRecord | null;
        perCall?: string;
    }): string | null {
        if (input.perCall) {
            // A `dynamic/<route>` ref names an OPERATOR route — its key, its budget cap, its
            // fallback order. The write path already refuses one from a tenant credential;
            // the per-call override is a SECOND door into the same merge, and a call site
            // that forwards a request body would otherwise hand a caller the operator's
            // route while the resolution still reports whatever `source` it resolved.
            // Operator-chosen models reach the chain through `platform.model` and the task's
            // pinned/default models, never through this argument.
            if (isDynamicModelRef(input.perCall)) {
                throw new AiProvisioningError(
                    'A dynamic/<route> model reference is operator-only and cannot be supplied as a per-call ' +
                        'override. Set it as the platform default model or a task pinned model instead.',
                    AI_ERROR_CODES.CONFIGURATION,
                );
            }
            return input.perCall;
        }
        if (input.task.modelPolicy === 'task-pinned' && input.credential) {
            const pinned = input.task.pinnedModels?.[input.credential.provider];
            if (pinned) return pinned;
        }
        if (input.credential?.model) return input.credential.model;
        if (input.task.defaultModel) return input.task.defaultModel;
        return options.platform.model ?? null;
    }

    function buildPlatformClient(taskKey: string, context: AiContext, model: string | null): RawAiClient | null {
        const merged = mergeConfig({
            platform: options.platform,
            registry,
            credential: null,
            tenantSecret: null,
            model,
            taskKey,
            context,
        });
        if (!options.transport.isComplete(merged)) return null;
        return options.transport.createClient(merged);
    }

    /**
     * A per-invocation memo for the candidate fetch ONLY.
     *
     * Deliberately narrow. The full resolution memo must key on (context identity, effective
     * mode, task key) — BOTH terms are load-bearing, because two tasks in one request can
     * narrow mode differently and a context-only memo would hand a platform-narrowed task
     * the byok resolution, or the reverse. The CANDIDATE SET, by contrast, is mode- and
     * task-independent: it depends only on the tenancy tuple and the strategy. So this
     * caches exactly that, and nothing else.
     *
     * It exists because `status()` resolves EVERY declared task: without it, a status call
     * costs 2 database queries per task.
     */
    type CandidateMemo = Map<string, Promise<CredentialRecord[]>>;

    async function runResolution(
        context: AiContext,
        taskKey: string,
        resolveOptions: ResolveOptions,
        memo?: CandidateMemo,
    ): Promise<{ resolution: AiResolution<AiClient>; candidates: CandidateExplanation[] }> {
        const task = taskOrThrow(taskKey);
        const buildClient = resolveOptions.buildClient !== false;

        // ── Stage 0: compose mode ────────────────────────────────────────────────
        const effectiveMode = intersectModes(appMode, task.mode, resolveOptions.mode);
        const bits = modeToBits(effectiveMode);

        const finish = (input: {
            source: ResolutionSource;
            reason: ResolutionReason;
            tenantReason: ResolutionReason | null;
            credential: CredentialRecord | null;
            client: AiClient | null;
            model: string | null;
            tenantSecretPresent: boolean;
        }): AiResolution<AiClient> => {
            const resolution: AiResolution<AiClient> = {
                client: input.client,
                source: input.source,
                reason: input.reason,
                tenantReason: input.tenantReason,
                credentialId: input.credential?.id ?? null,
                keyHint: input.credential?.keyHint ?? null,
                provider: input.credential?.provider ?? options.platform.provider ?? null,
                model: input.model,
                configSummary: {
                    provider: input.credential?.provider ?? options.platform.provider ?? null,
                    model: input.model,
                    transport: options.transport.name,
                    tenantSecret: input.tenantSecretPresent,
                },
            };
            emit('credential.resolved', {
                credentialId: resolution.credentialId,
                source: resolution.source,
                reason: resolution.reason,
                tenantReason: resolution.tenantReason,
                provider: resolution.provider,
                model: resolution.model,
                taskKey,
                appId: context.appId,
                organizationId: context.organizationId,
                userId: context.userId,
            });
            return resolution;
        };

        /** Stages 8 → 9: the single fall-through gate every failed tenant path converges on. */
        const fallThrough = (tenantReason: ResolutionReason): AiResolution<AiClient> => {
            if (!bits.mayUsePlatformKey) {
                return finish({
                    source: null,
                    reason: tenantReason,
                    tenantReason,
                    credential: null,
                    client: null,
                    model: null,
                    tenantSecretPresent: false,
                });
            }
            const model = resolveModel({ task, credential: null, perCall: resolveOptions.model });
            const merged = mergeConfig({
                platform: options.platform,
                registry,
                credential: null,
                tenantSecret: null,
                model,
                taskKey,
                context,
            });
            if (!options.transport.isComplete(merged)) {
                return finish({
                    source: null,
                    reason: 'PLATFORM_INCOMPLETE',
                    tenantReason,
                    credential: null,
                    client: null,
                    model,
                    tenantSecretPresent: false,
                });
            }
            const client = buildClient
                ? createInstrumentedClient({
                      raw: options.transport.createClient(merged),
                      platformFallback: null,
                      config: merged,
                      source: 'platform',
                      taskKey,
                      degradation: 'strict',
                      emit,
                      defer,
                      quota: options.quota,
                      responseCacheTtlSeconds: task.responseCacheTtlSeconds,
                      redactionSentinels: [options.platform.providerKey, options.platform.gatewayToken],
                  })
                : null;
            return finish({
                source: 'platform',
                reason: 'PLATFORM_FALLBACK',
                tenantReason,
                credential: null,
                client,
                model: merged.model,
                tenantSecretPresent: false,
            });
        };

        // ── Stage 1: tenant-lookup gate ──────────────────────────────────────────
        if (!bits.mayUseTenantKey) {
            return { resolution: fallThrough('MODE_PLATFORM_ONLY'), candidates: [] };
        }

        // ── Stage 1i: impersonation gate ─────────────────────────────────────────
        // Staff actions must not spend the tenant's money, send content under the
        // tenant's provider contract, and be attributed to the tenant with no marker.
        if (context.impersonated) {
            return { resolution: fallThrough('IMPERSONATED_ACTOR'), candidates: [] };
        }

        // ── Stage 2: context guard ───────────────────────────────────────────────
        // An UNSCOPED query returns every tenant's rows and then scores them. Refuse.
        if (!context.organizationId && !context.userId) {
            return { resolution: fallThrough('NO_TENANT_CONTEXT'), candidates: [] };
        }

        // ── Stage 2m: MEMBERSHIP VERIFICATION — unconditional, inside the package ─
        //
        // The brand on `AiContext` enforces PROVENANCE (only the host's mapper can mint
        // one). It does NOT enforce VERIFICATION. Requiring a `verifyMembership` callback at
        // composition and then never calling it is worse than not requiring it at all: it
        // manufactures confidence that the org dimension of an RLS-BYPASSING lookup has been
        // checked, when nothing checked it.
        //
        // So it is checked HERE, on every resolution, before any query runs. A host whose
        // own membership source is momentarily unavailable (a D1 hiccup swallowed upstream)
        // therefore degrades to the user dimension rather than resolving an unverified org's
        // credential.
        let verifiedContext = context;
        if (context.organizationId && options.verifyMembership) {
            const isMember = await options.verifyMembership({
                userId: context.userId,
                organizationId: context.organizationId,
            });
            if (!isMember) {
                emit('credential.skipped', {
                    credentialId: null,
                    source: null,
                    reason: 'NOT_IN_SCOPE',
                    tenantReason: 'NOT_IN_SCOPE',
                    provider: null,
                    model: null,
                    taskKey,
                    verdict: 'NOT_IN_SCOPE',
                    appId: context.appId,
                    organizationId: context.organizationId,
                    userId: context.userId,
                });
                // Drop the org dimension rather than throwing: a user with their own key
                // must still get it, and the alternative (failing the whole call) turns a
                // membership-lookup blip into an outage.
                verifiedContext = brandContext({ ...context, organizationId: null });
                if (!verifiedContext.userId) {
                    return { resolution: fallThrough('NO_TENANT_CONTEXT'), candidates: [] };
                }
            }
        }
        context = verifiedContext;

        // ── Stage 3: candidate fetch ─────────────────────────────────────────────
        let candidates: CredentialRecord[];
        if (resolveOptions.credential !== undefined) {
            // Three-state seam: explicit null forces the platform path with NO lookup.
            if (resolveOptions.credential === null) {
                return { resolution: fallThrough('MODE_PLATFORM_ONLY'), candidates: [] };
            }
            candidates = [resolveOptions.credential];
        } else {
            const scope: StoreScope = {
                organizationId: context.organizationId,
                userId: context.userId,
                appId: context.appId,
            };
            if (memo) {
                const memoKey = `${scope.organizationId ?? ''}|${scope.userId ?? ''}|${scope.appId ?? ''}|${strategy}`;
                let pending = memo.get(memoKey);
                if (!pending) {
                    pending = options.store.findCandidates(scope, strategy);
                    memo.set(memoKey, pending);
                }
                candidates = await pending;
            } else {
                candidates = await options.store.findCandidates(scope, strategy);
            }
        }

        // ── Stage 4: verdicts + score, then selection ────────────────────────────
        const selection = selectCredential({
            candidates,
            context: { organizationId: context.organizationId, userId: context.userId, appId: context.appId },
            strategy,
            appScope,
            registry,
            task,
        });

        const explanations: CandidateExplanation[] = selection.assessed.map((assessed: AssessedCandidate) => ({
            ...toCredentialView(assessed.record),
            verdict: assessed.verdict,
            ...(assessed.score !== undefined ? { score: assessed.score } : {}),
            selected: assessed.selected,
        }));

        if (!selection.winner) {
            const reason = selection.aggregatedReason ?? 'NO_CREDENTIAL';
            emit('credential.skipped', {
                credentialId: null,
                source: null,
                reason,
                tenantReason: reason,
                provider: null,
                model: null,
                taskKey,
                verdict: 'NOT_IN_SCOPE',
                appId: context.appId,
                organizationId: context.organizationId,
                userId: context.userId,
            });
            return { resolution: fallThrough(reason), candidates: explanations };
        }

        const winner = selection.winner;

        // ── Stage 6: keyless-mismatch guard (before decrypt — nothing to decrypt) ─
        if (
            keylessMismatch({
                credential: winner,
                registry,
                platform: options.platform,
                mayUsePlatformKey: bits.mayUsePlatformKey,
                dynamicModel: isDynamicModelRef(winner.model),
            })
        ) {
            emit('credential.skipped', {
                credentialId: winner.id,
                source: null,
                reason: 'SKIPPED_KEYLESS_MISMATCH',
                tenantReason: 'SKIPPED_KEYLESS_MISMATCH',
                provider: winner.provider,
                model: winner.model,
                taskKey,
                verdict: 'KEYLESS_MISMATCH',
                appId: context.appId,
                organizationId: context.organizationId,
                userId: context.userId,
            });
            // The guard discards the WHOLE credential, INCLUDING ITS MODEL — the
            // fall-through uses the PLATFORM'S model. Half-merging tenant model over
            // platform key is exactly the failure being prevented.
            return { resolution: fallThrough('SKIPPED_KEYLESS_MISMATCH'), candidates: explanations };
        }

        // ── Stage 6b: secret presence under `byok` ───────────────────────────────
        if (!bits.mayUsePlatformKey && winner.secret.kind === 'none' && registry.requiresKeyFor(winner.provider)) {
            return { resolution: fallThrough('NO_TENANT_SECRET'), candidates: explanations };
        }

        // ── Stage 5: decrypt the winner ──────────────────────────────────────────
        let tenantSecret: SecretValue | null = null;
        if (winner.secret.kind === 'inline') {
            try {
                tenantSecret = await decryptSecret({
                    envelope: winner.secret.ciphertext,
                    keyring: options.keyring,
                    registry: decryptors,
                    aad: {
                        credentialId: winner.id,
                        organizationId: winner.organizationId,
                        userId: winner.userId,
                        appId: winner.appId,
                        provider: winner.provider,
                    },
                });
            } catch (error) {
                const code =
                    error instanceof AiProvisioningError ? error.code : (AI_ERROR_CODES.DECRYPT_FAILED as AiErrorCode);
                emit('credential.decrypt_failed', {
                    credentialId: winner.id,
                    errorCode: code,
                    keyId: winner.keyId,
                    formatVersion: winner.formatVersion,
                    taskKey,
                    appId: context.appId,
                    organizationId: context.organizationId,
                    userId: context.userId,
                });

                // FAIL CLOSED, IN EVERY MODE INCLUDING `auto`.
                //
                // A decrypt failure means A CREDENTIAL EXISTS AND WE CANNOT READ IT. The
                // reflexive implementation wraps resolve in try/catch and degrades to the
                // platform — which inverts the cost model exactly where it matters most: a
                // wrong master secret in a deploy silently moves EVERY tenant's spend onto
                // the operator's bill while traffic looks completely normal, and the
                // incident is discovered by invoice. Fail-closed makes a fleet-wide
                // rotation mistake visible in the first minute and is trivially reversible.
                if (onCredentialError === 'fail-closed') {
                    return {
                        resolution: finish({
                            source: null,
                            reason: 'CREDENTIAL_UNREADABLE',
                            tenantReason: 'CREDENTIAL_UNREADABLE',
                            credential: winner,
                            client: null,
                            model: null,
                            tenantSecretPresent: false,
                        }),
                        candidates: explanations,
                    };
                }
                return { resolution: fallThrough('CREDENTIAL_UNREADABLE'), candidates: explanations };
            }
        }

        // ── Stage 7: merge ───────────────────────────────────────────────────────
        const model = resolveModel({ task, credential: winner, perCall: resolveOptions.model });
        const merged = mergeConfig({
            platform: options.platform,
            registry,
            credential: winner,
            tenantSecret,
            model,
            taskKey,
            context,
        });

        if (!options.transport.isComplete(merged)) {
            emit('credential.skipped', {
                credentialId: winner.id,
                source: null,
                reason: 'MERGE_INCOMPLETE',
                tenantReason: 'MERGE_INCOMPLETE',
                provider: winner.provider,
                model,
                taskKey,
                verdict: 'MERGE_INCOMPLETE',
                appId: context.appId,
                organizationId: context.organizationId,
                userId: context.userId,
            });
            return { resolution: fallThrough('MERGE_INCOMPLETE'), candidates: explanations };
        }

        const tenantSecretPresent = winner.secret.kind !== 'none';

        // ONE effective degradation policy, read once. Gating the fallback CLIENT on the
        // instance dial while configuring the decorator with the TASK dial makes a
        // task-level `platform-on-auth-error` silently inert: `shouldDegrade` bails on
        // `!platformFallback` and no retry, and no `call.degraded` event, ever happens.
        const effectiveDegradation = task.degradation ?? degradation;
        // The fallback must use the SAME model chain as every other platform-path build.
        // Hard-coding `platform.model` skips the task's `defaultModel` and the per-call
        // override — so a deployment with no platform default sends a request with NO model
        // field at all, and a caller-requested model is silently swapped for another.
        const fallbackModel = resolveModel({ task, credential: null, perCall: resolveOptions.model });
        const platformFallback =
            effectiveDegradation === 'platform-on-auth-error' && bits.mayUsePlatformKey && buildClient
                ? buildPlatformClient(taskKey, context, fallbackModel)
                : null;

        const client = buildClient
            ? createInstrumentedClient({
                  raw: options.transport.createClient(merged),
                  platformFallback,
                  platformConfig: platformFallback
                      ? {
                            provider: options.platform.provider ?? merged.provider,
                            model: qualifyModelRef(options.platform.provider, fallbackModel, registry),
                        }
                      : null,
                  config: merged,
                  source: 'byok',
                  taskKey,
                  degradation: effectiveDegradation,
                  emit,
                  defer,
                  quota: options.quota,
                  responseCacheTtlSeconds: task.responseCacheTtlSeconds,
                  recordOutcome: (outcome) => options.store.recordOutcome(winner.id, outcome),
                  redactionSentinels: [
                      tenantSecret?.expose(),
                      winner.secret.kind === 'alias' ? winner.secret.alias : null,
                      options.platform.providerKey,
                      options.platform.gatewayToken,
                  ],
              })
            : null;

        return {
            resolution: finish({
                source: 'byok',
                reason: 'SELECTED',
                tenantReason: null,
                credential: winner,
                client,
                model: merged.model,
                tenantSecretPresent,
            }),
            candidates: explanations,
        };
    }

    /**
     * Turn a finished resolution into a gate verdict.
     *
     * ONE implementation, shared by `requireByok` and `resolveWithGate`, so the two can never
     * answer differently for the same resolution.
     */
    function gateFor(task: ResolvedTaskPolicy, resolution: AiResolution<AiClient>): GateDecision {
        const gate = evaluateGate({
            gate: task.gate,
            source: resolution.source,
            tenantSecretPresent: resolution.configSummary.tenantSecret,
            reason: resolution.tenantReason ?? resolution.reason,
        });
        if (gate.allowed) return { allowed: true };
        return {
            allowed: false,
            code: AI_ERROR_CODES.BYOK_REQUIRED,
            reason: resolution.tenantReason ?? resolution.reason,
        };
    }

    const instance: AiProvisioning<HostContext> = {
        contextFrom(hostContext) {
            const tuple = options.contextFrom(hostContext);
            return brandContext(tuple);
        },

        async resolve(context, taskKey, resolveOptions = {}) {
            const { resolution } = await runResolution(context, taskKey, resolveOptions);
            return resolution;
        },

        async resolveWithGate(context, taskKey, resolveOptions = {}) {
            const task = taskOrThrow(taskKey);
            // ONE resolution, with the client built. The gate is then a pure function of what
            // that resolution already computed — no second fan-out, no second decrypt.
            const { resolution } = await runResolution(context, taskKey, resolveOptions);
            return { gate: gateFor(task, resolution), resolution };
        },

        async status(context) {
            const gates: Record<string, GateAnswer> = {};
            let primary: AiResolution<AiClient> | null = null;
            // One candidate fetch for the whole status call, not one per declared task.
            const memo: CandidateMemo = new Map();

            for (const task of tasks.values()) {
                // THE DRY RUN — stages 1..7 with no transport client. NOT `credential: null`.
                const { resolution } = await runResolution(context, task.key, { buildClient: false }, memo);

                // PICK THE MOST INFORMATIVE resolution, not the first one declared.
                //
                // "Currently in use" is what the whole settings page hangs off, and taking
                // `tasks[0]` makes that answer a function of ARRAY ORDER: an operator who
                // declares a `mode: 'platform'` internal task first (a documented, supported
                // narrowing) would short-circuit it at stage 1 and report `source:'platform',
                // hasSecret:false` for EVERY tenant — telling a paying tenant their key is
                // unused while their gated tasks are in fact running on it.
                //
                // A byok resolution always wins; otherwise the first task whose tenant path
                // was actually ATTEMPTED beats one that mode short-circuited.
                if (
                    !primary ||
                    (resolution.source === 'byok' && primary.source !== 'byok') ||
                    (primary.tenantReason === 'MODE_PLATFORM_ONLY' && resolution.tenantReason !== 'MODE_PLATFORM_ONLY')
                ) {
                    primary = resolution;
                }

                gates[task.key] = evaluateGate({
                    gate: task.gate,
                    source: resolution.source,
                    tenantSecretPresent: resolution.configSummary.tenantSecret,
                    reason: resolution.tenantReason ?? resolution.reason,
                });
            }

            const base = primary;
            return {
                configured: Boolean(base && base.source !== null),
                source: base?.source ?? null,
                reason: base?.reason ?? 'NO_CREDENTIAL',
                tenantReason: base?.tenantReason ?? null,
                provider: base?.provider ?? null,
                model: base?.model ?? null,
                credentialId: base?.credentialId ?? null,
                keyHint: base?.keyHint ?? null,
                hasSecret: Boolean(base?.configSummary.tenantSecret),
                gates,
                strategy,
                // BOTH terms, ANDed on the SERVER. The strategy decides whether such a row
                // could ever be selected; the dial decides whether the operator offers it at
                // all. The settings component reads this one field — it does not need (and
                // must not need) a second, independently-read copy of the app config to work
                // out the same answer.
                orgScopeManageable: orgCredentialsAllowed && ORG_MANAGEABLE_STRATEGIES.includes(strategy),
            };
        },

        async requireByok(context, taskKey) {
            const task = taskOrThrow(taskKey);
            // The DRY RUN is right here and only here: a caller that just wants the verdict
            // (a middleware, a feature flag) should not pay to construct a client it will
            // discard. A caller that goes on to make the call wants `resolveWithGate`.
            const { resolution } = await runResolution(context, taskKey, { buildClient: false });
            return gateFor(task, resolution);
        },

        async explainResolution(context, taskKey) {
            const allowed = await authorizeOp({
                context,
                operation: 'explain',
                credential: context.organizationId
                    ? { id: null, organizationId: context.organizationId, userId: context.userId }
                    : null,
            });
            if (!allowed) {
                throw new AiProvisioningError(
                    'Not authorized to inspect AI credential resolution for this organization.',
                    AI_ERROR_CODES.FORBIDDEN,
                );
            }
            const { resolution, candidates } = await runResolution(context, taskKey, { buildClient: false });
            return { resolution: { ...resolution, client: null }, candidates };
        },

        registry,
        store: options.store,
        keyring: options.keyring,
        decryptors,
        strategy,
        appScope,
        orgCredentialsAllowed,
        platformRouteUsable,
        tasks,
        platform: options.platform,
        transport: options.transport,
        emit,
        defer,
        authorizeOp,
        verifyMembershipFn: options.verifyMembership ?? null,
    };

    return instance;
}
