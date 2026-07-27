// ============================================================
// @ottabase/ottaai — Eligibility verdicts (pure, over plain records)
// ============================================================
// EVERY candidate gets a verdict; only ELIGIBLE candidates get a score.
// Order below is DIAGNOSTIC, not short-circuit — compute all applicable verdicts
// so `explainResolution` can show why each row lost.
// ============================================================

import type { AiProviderRegistry } from '../registry';
import type { ResolvedTaskPolicy } from '../tasks';
import type { AiCapability, AppScope, CredentialRecord, CredentialVerdict } from '../types';
import { parseModelRef } from '../model-ref';

export interface EligibilityInput {
    record: CredentialRecord;
    context: { organizationId: string | null; userId: string | null; appId: string | null };
    registry: AiProviderRegistry;
    task: ResolvedTaskPolicy;
    appScope: AppScope;
}

export interface EligibilityResult {
    verdict: CredentialVerdict;
    /** All verdicts that applied, most actionable first. Used by `explainResolution`. */
    allVerdicts: CredentialVerdict[];
}

// ---------------------------------------------------------------------------
// Dimension matching
// ---------------------------------------------------------------------------

/**
 * Org/user dimension matching. Normalise `undefined` → `null` first, then per dimension:
 *
 * | credential | context | result                                     |
 * | ---------- | ------- | ------------------------------------------ |
 * | `null`     | `null`  | no conflict, no match (contributes nothing)|
 * | `null`     | `X`     | no conflict, no match — row is unbound     |
 * | `X`        | `null`  | CONFLICT ⇒ ineligible                      |
 * | `X`        | `X`     | match                                      |
 * | `X`        | `Y`     | CONFLICT ⇒ ineligible                      |
 *
 * THE CONSEQUENCE NOBODY EXPECTS: a credential carrying BOTH dimensions is usable only
 * by that exact (org, user) pair. It never degrades to "a user-only key" for a different
 * org. A user who saved a key while acting in org A gets NO BYOK when the same user makes
 * a request scoped to org B. That is correct — the key was connected in a workspace
 * context, and silently spending it in another workspace is a consent problem — but it
 * has to be written down, because the alternative reading ("it matches the user, so it
 * applies") is equally plausible and produces the opposite behaviour.
 */
export function dimensionMatch(
    credentialValue: string | null | undefined,
    contextValue: string | null | undefined,
): { conflict: boolean; match: boolean } {
    const cred = credentialValue ?? null;
    const ctx = contextValue ?? null;
    if (cred === null) return { conflict: false, match: false };
    if (cred === ctx) return { conflict: false, match: true };
    return { conflict: true, match: false };
}

/**
 * App-dimension matching. STRICT BY DEFAULT.
 *
 * | credential.appId | context.appId | `strict` (default) | `wildcard` (opt-in) |
 * | ---------------- | ------------- | ------------------ | ------------------- |
 * | `null`           | `null`        | eligible           | eligible            |
 * | `null`           | `X`           | INELIGIBLE         | eligible            |
 * | `X`              | `null`        | INELIGIBLE         | INELIGIBLE          |
 * | `X`              | `X`           | eligible           | eligible            |
 * | `X`              | `Y`           | ineligible         | ineligible          |
 *
 * TRAP: treating org/user as strict while treating app as lenient (conflict only when
 * BOTH sides specify) means an app-bound credential still applies to a request that omits
 * the app id. In a shared-database multi-app deployment, a key connected inside one app
 * becomes silently usable by every other app on the platform — that user's prompts
 * leaving through their provider contract from applications they never authorised.
 *
 * `wildcard` exists only for a first-party suite under one brand and one consent surface,
 * and even there a BOUND row never leaks upward. `wildcard` WIDENS USE, NEVER MANAGEMENT —
 * the RLS filter keeps the app dimension on writes in both modes.
 */
export function appMatch(
    credentialAppId: string | null | undefined,
    contextAppId: string | null | undefined,
    scope: AppScope,
): boolean {
    const cred = credentialAppId ?? null;
    const ctx = contextAppId ?? null;
    if (cred === null) return scope === 'wildcard' || ctx === null;
    return cred === ctx;
}

// ---------------------------------------------------------------------------
// Capability filtering
// ---------------------------------------------------------------------------

/**
 * CAPABILITY IS AN ELIGIBILITY FILTER, NOT A POST-SELECTION CHECK.
 *
 * Checked after selection, a user-level text-only credential would SHADOW an org-level
 * vision-capable credential for a vision task, and the org key that could have served it
 * is never considered. Filtering first means specificity ranks only over credentials that
 * can actually do the job.
 */
export function capabilitiesSatisfied(input: EligibilityInput): boolean {
    const record = input.record;
    const required = input.task.requiredCapabilities;

    // `task-pinned`: the model is decided by the TASK, per provider. A credential whose
    // provider has no pinned entry cannot serve this task at all.
    //
    // THIS CHECK RUNS BEFORE THE no-required-capabilities SHORTCUT, and that ordering is the
    // whole point. Behind the shortcut, a pinned task with no capability requirements would
    // let an unpinnable provider stay ELIGIBLE, win on specificity, and then fall past the
    // pin in the model chain onto the credential's OWN model — which is exactly the
    // shadowing the eligibility filter exists to prevent, and the pinnable credential that
    // could have served the task is never even considered.
    if (input.task.modelPolicy === 'task-pinned') {
        const pinned = input.task.pinnedModels?.[record.provider];
        if (!pinned) return false;
        if (!required || required.length === 0) return true;
        return modelHasCapabilities(input, record.provider, pinned, required);
    }

    if (!required || required.length === 0) return true;

    const parsed = record.model ? parseModelRef(record.model, input.registry) : null;
    // A dynamic route's model is decided inside the gateway; the package cannot inspect it.
    // Treat it as unknown and defer to `unknownModelPolicy`.
    if (parsed?.dynamic) return input.task.unknownModelPolicy === 'allow';

    const provider = parsed?.form === 'qualified' ? parsed.provider : record.provider;
    const modelId = parsed?.form === 'qualified' ? parsed.model : (parsed?.model ?? null);

    return modelHasCapabilities(input, provider, modelId, required);
}

function modelHasCapabilities(
    input: EligibilityInput,
    provider: string,
    modelId: string | null,
    required: AiCapability[],
): boolean {
    const capabilities = input.registry.capabilitiesFor(provider, modelId);
    if (capabilities === null) {
        // A model that matches neither a registry entry nor the provider default is
        // INELIGIBLE for a capability-constrained task — fail closed, because a free-text
        // model silently admitted to a vision task produces a confusing upstream failure
        // the tenant cannot diagnose. An operator who knows better opts out per task.
        return input.task.unknownModelPolicy === 'allow';
    }
    return required.every((capability) => capabilities.includes(capability));
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

/** Precedence when several verdicts apply — most actionable first. */
const VERDICT_PRECEDENCE: CredentialVerdict[] = [
    'DISABLED',
    'SOFT_DELETED',
    'CAPABILITY_UNMET',
    'PROVIDER_UNREGISTERED',
    'APP_MISMATCH',
    'NOT_IN_SCOPE',
];

export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
    const { record, context, registry } = input;
    const verdicts: CredentialVerdict[] = [];

    // `enabled` is a HARD FILTER; absent counts as enabled (strict `=== false`), so
    // migrated/seeded/imported rows are never silently dead.
    if (record.enabled === false) verdicts.push('DISABLED');

    if (!registry.has(record.provider)) verdicts.push('PROVIDER_UNREGISTERED');

    if (!appMatch(record.appId, context.appId, input.appScope)) verdicts.push('APP_MISMATCH');

    const org = dimensionMatch(record.organizationId, context.organizationId);
    const user = dimensionMatch(record.userId, context.userId);
    if (org.conflict || user.conflict) verdicts.push('NOT_IN_SCOPE');

    if (!capabilitiesSatisfied(input)) verdicts.push('CAPABILITY_UNMET');

    if (verdicts.length === 0) {
        return { verdict: 'ELIGIBLE', allVerdicts: ['ELIGIBLE'] };
    }

    const ordered = VERDICT_PRECEDENCE.filter((v) => verdicts.includes(v));
    return { verdict: ordered[0]!, allVerdicts: ordered };
}
