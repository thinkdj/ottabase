// ============================================================
// @ottabase/ottaai — Specificity score + the TOTAL ranking order
// ============================================================

import type { AiStrategy, CredentialRecord } from '../types';
import { dimensionMatch } from './verdict';

/**
 * Specificity score — computed ONLY for `ELIGIBLE` candidates.
 *
 * | match class      | `user` | `org` | `user-then-org` | `org-then-user` |
 * | ---------------- | ------ | ----- | --------------- | --------------- |
 * | user **and** org | 3      | 3     | 4               | 4               |
 * | user only        | 2      | 0     | 3               | 2               |
 * | org only         | 0      | 2     | 2               | 3               |
 * | neither          | 0      | 0     | 0               | 0               |
 *
 * A score of 0 means "does not apply to this scope" ⇒ verdict `NOT_IN_SCOPE`; the
 * selector skips everything ≤ 0.
 *
 * TRAP — THE COUNTER-INTUITIVE CELL: an exact user+org match ranks highest under EVERY
 * strategy, INCLUDING `user`. `strategy: 'user'` means *must match the user*, not *must
 * have no org*. Prose saying "only the user's own credentials" contradicts this table;
 * the table wins.
 *
 * THE OTHER CLARIFIED CELL: a row with neither dimension set is eligible under the
 * conflict rules but scores 0 under all four strategies — PERMANENTLY UNSELECTABLE. That
 * is intended: THERE IS NO SUCH THING AS A GLOBAL CREDENTIAL. The write layer rejects
 * such a row so unreachable data does not accumulate.
 *
 * NOTE `appId` contributes 0 by design: it is an ISOLATION BOUNDARY, not a precedence
 * dimension. Scoring on it would let an app-bound org row outrank a more specific user
 * row, inverting the chosen strategy.
 */
export function specificityScore(
    record: Pick<CredentialRecord, 'organizationId' | 'userId'>,
    context: { organizationId: string | null; userId: string | null },
    strategy: AiStrategy,
): number {
    const orgMatch = dimensionMatch(record.organizationId, context.organizationId).match;
    const userMatch = dimensionMatch(record.userId, context.userId).match;

    if (userMatch && orgMatch) {
        return strategy === 'user-then-org' || strategy === 'org-then-user' ? 4 : 3;
    }
    if (userMatch) {
        switch (strategy) {
            case 'user':
                return 2;
            case 'org':
                return 0;
            case 'user-then-org':
                return 3;
            case 'org-then-user':
                return 2;
        }
    }
    if (orgMatch) {
        switch (strategy) {
            case 'user':
                return 0;
            case 'org':
                return 2;
            case 'user-then-org':
                return 2;
            case 'org-then-user':
                return 3;
        }
    }
    return 0;
}

/**
 * Read a timestamp DEFENSIVELY — `Date` *or* epoch number, because ORM casts may not have
 * been applied on every path that produces a record.
 */
export function readTimestamp(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

export interface ScoredCandidate {
    record: CredentialRecord;
    score: number;
}

/**
 * THE RANKING MUST BE A TOTAL ORDER:
 *
 *   1. score       descending (skip ≤ 0)
 *   2. isActive    `!== false` beats `=== false`; absent counts as active
 *   3. updatedAt   descending, read defensively
 *   4. id          ascending — REQUIRED
 *
 * TRAP: without rung 4, two rows with equal score, activeness and timestamp are resolved
 * by map insertion order — i.e. the concatenation order of two database queries, which is
 * not part of any contract. Equal timestamps are NOT exotic: bulk import, a seeded
 * fixture, a migration backfill, or two writes in the same millisecond all produce them.
 * The same request then resolves to different keys on different isolates, and the failure
 * presents as "it works for me".
 *
 * The database `ORDER BY` is a pre-sort convenience only — THIS COMPARATOR IS THE
 * CONTRACT, and a change in query ordering must not change the winner.
 */
export function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
    if (a.score !== b.score) return b.score - a.score;

    const aActive = a.record.isActive !== false;
    const bActive = b.record.isActive !== false;
    if (aActive !== bActive) return aActive ? -1 : 1;

    const aUpdated = readTimestamp(a.record.updatedAt);
    const bUpdated = readTimestamp(b.record.updatedAt);
    if (aUpdated !== bUpdated) return bUpdated - aUpdated;

    return a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : 0;
}
