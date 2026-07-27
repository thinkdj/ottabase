// ============================================================
// @ottabase/ottaai — CredentialStore seam
// ============================================================
// Returns PLAIN RECORDS, never ORM instances. That is what makes the resolver
// unit-testable with no database today, lets an adopting app back the package
// with its own table, and gives an external vault exactly one place to plug in.
//
// The MAINTENANCE methods are not optional: the re-wrap job and hard delete are
// package-owned, and a re-wrap that reaches past the store to the ORM breaks the
// abstraction it depends on.
// ============================================================

import type { AiStrategy, CredentialRecord } from '../types';

/** The tenancy tuple a store query is scoped to. */
export interface StoreScope {
    organizationId: string | null;
    userId: string | null;
    appId: string | null;
}

export interface CredentialStore {
    /**
     * Fetch candidate rows for a scope.
     *
     * TWO SCOPED QUERIES, NOT ONE `OR`. Row-level filters are single-equality and cannot
     * express `org = X OR user = Y`; anyone who "optimises" the fan-out into one OR query
     * has either bypassed row scoping or changed the candidate set. The store owns the
     * fan-out; the RESOLVER owns the union and de-dupe, so selection stays pure.
     *
     * Filters ONLY on the tenancy dimensions — NOT on `enabled`, `appId` or `provider`,
     * because every one of those is a VERDICT the resolver must be able to report.
     * Filtering them in SQL kills the reason code at the database layer.
     */
    findCandidates(scope: StoreScope, strategy: AiStrategy): Promise<CredentialRecord[]>;

    /**
     * Load one credential by client-supplied id, SCOPE-CHECKED IN THE QUERY.
     *
     * Returns null for both "not found" and "not yours" — the same answer closes the
     * existence oracle. The scope check must be part of the query, not a comparison after
     * it, or the two branches differ in work performed and the oracle reopens as a timing
     * side channel.
     */
    findByIdInScope(scope: StoreScope, id: string): Promise<CredentialRecord | null>;

    /** Make one credential active for its full tenancy tuple, deactivating siblings. */
    markActive(id: string): Promise<boolean>;

    /** Record a call outcome on the health columns. Best-effort; must never fail a request. */
    recordOutcome(id: string, outcome: { ok: boolean; at: number; errorCode?: string | null }): Promise<void>;

    // ── Maintenance (rotation + deletion) ─────────────────────────────────────────
    /** Iterate rows whose envelope index says they were wrapped with `keyId`. */
    iterateByKeyId(keyId: string, batchSize: number): AsyncIterable<CredentialRecord[]>;
    /**
     * Replace a row's ciphertext, RE-READING the row inside the write so a concurrent
     * tenant edit is not clobbered.
     */
    replaceSecret(
        id: string,
        next: { ciphertext: string; keyId: string; formatVersion: string },
        expect: { keyId: string | null },
    ): Promise<boolean>;
    /** HARD delete, including the ciphertext. Not soft delete, not disable-and-retain. */
    deleteById(id: string): Promise<boolean>;
    /**
     * Scan EVERY row's envelope (not the index column) for a retiring key id.
     *
     * The completion criterion for removing a secret from the keyring is that this
     * returns 0. A partial restore, or a re-wrap that updated the blob and not the
     * column, makes the INDEX count read zero while old-key rows remain — retire on
     * that and those credentials are permanently undecryptable, reported as
     * "decrypt-failed", which sends incident response in exactly the wrong direction.
     */
    countByEnvelopeKeyId(keyId: string): Promise<number>;
}
