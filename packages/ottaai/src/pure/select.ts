// ============================================================
// @ottabase/ottaai — Selection (ONE pass, ONE winner) + stage-4a aggregation
// ============================================================

import type { AiProviderRegistry } from '../registry';
import type { ResolvedTaskPolicy } from '../tasks';
import type { AiStrategy, AppScope, CredentialRecord, CredentialVerdict, ResolutionReason } from '../types';
import { compareCandidates, specificityScore, type ScoredCandidate } from './score';
import { evaluateEligibility } from './verdict';

export interface SelectionInput {
    candidates: CredentialRecord[];
    context: { organizationId: string | null; userId: string | null; appId: string | null };
    strategy: AiStrategy;
    appScope: AppScope;
    registry: AiProviderRegistry;
    task: ResolvedTaskPolicy;
}

export interface AssessedCandidate {
    record: CredentialRecord;
    verdict: CredentialVerdict;
    allVerdicts: CredentialVerdict[];
    /** Present only for ELIGIBLE candidates whose score is > 0. */
    score?: number;
    selected: boolean;
}

export interface SelectionResult {
    winner: CredentialRecord | null;
    assessed: AssessedCandidate[];
    /** Populated when nothing was selected — the aggregated stage-4a reason. */
    aggregatedReason: ResolutionReason | null;
}

/**
 * Stage 4a's aggregated reason, with EXACT precedence.
 *
 * The common real case is a MIXTURE of failing candidates, so pick by the highest-precedence
 * verdict PRESENT among the rows, not by "all":
 *
 *   ALL_DISABLED (the tenant turned something off — most actionable)
 *     → CAPABILITY_UNMET → PROVIDER_UNREGISTERED → APP_MISMATCH
 *     → NOT_IN_SCOPE (least actionable)
 */
const AGGREGATE_PRECEDENCE: Array<{ verdict: CredentialVerdict; reason: ResolutionReason }> = [
    { verdict: 'DISABLED', reason: 'ALL_DISABLED' },
    { verdict: 'SOFT_DELETED', reason: 'ALL_DISABLED' },
    { verdict: 'CAPABILITY_UNMET', reason: 'CAPABILITY_UNMET' },
    { verdict: 'PROVIDER_UNREGISTERED', reason: 'PROVIDER_UNREGISTERED' },
    { verdict: 'APP_MISMATCH', reason: 'APP_MISMATCH' },
    { verdict: 'NOT_IN_SCOPE', reason: 'NOT_IN_SCOPE' },
];

/**
 * ONE SELECTION PASS. Returns ONE credential.
 *
 * De-dupe by id happens HERE (not in the store): the two-query fan-out returns a
 * both-dimension row twice. The store owns the fan-out, the resolver owns the union, so
 * the whole selection stays pure and testable with no database.
 *
 * THE ONLY LEGITIMATE WAY TO EXTEND THE RESOLVER IS TO ENRICH THE ELIGIBILITY PREDICATE,
 * never to add a runtime retry. Eligibility keeps this one pass with one deterministic
 * winner and one attributable payer; retry turns it into a cascade.
 */
export function selectCredential(input: SelectionInput): SelectionResult {
    const seen = new Set<string>();
    const unique: CredentialRecord[] = [];
    for (const record of input.candidates) {
        if (seen.has(record.id)) continue;
        seen.add(record.id);
        unique.push(record);
    }

    const assessed: AssessedCandidate[] = [];
    const eligible: ScoredCandidate[] = [];

    for (const record of unique) {
        const { verdict, allVerdicts } = evaluateEligibility({
            record,
            context: input.context,
            registry: input.registry,
            task: input.task,
            appScope: input.appScope,
        });

        if (verdict !== 'ELIGIBLE') {
            assessed.push({ record, verdict, allVerdicts, selected: false });
            continue;
        }

        const score = specificityScore(record, input.context, input.strategy);
        if (score <= 0) {
            // Eligible under the conflict rules but out of scope for this strategy.
            assessed.push({ record, verdict: 'NOT_IN_SCOPE', allVerdicts: ['NOT_IN_SCOPE'], score, selected: false });
            continue;
        }

        assessed.push({ record, verdict: 'ELIGIBLE', allVerdicts, score, selected: false });
        eligible.push({ record, score });
    }

    if (eligible.length === 0) {
        const present = new Set(assessed.map((a) => a.verdict));
        const aggregate = AGGREGATE_PRECEDENCE.find((entry) => present.has(entry.verdict));
        return {
            winner: null,
            assessed,
            aggregatedReason: unique.length === 0 ? 'NO_CREDENTIAL' : (aggregate?.reason ?? 'NOT_IN_SCOPE'),
        };
    }

    eligible.sort(compareCandidates);
    const winner = eligible[0]!.record;
    for (const entry of assessed) {
        if (entry.record.id === winner.id) entry.selected = true;
    }

    return { winner, assessed, aggregatedReason: null };
}
