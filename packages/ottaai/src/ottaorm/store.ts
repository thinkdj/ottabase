// ============================================================
// @ottabase/ottaai — OttaORM-backed CredentialStore
// ============================================================
// The ONLY place the resolver touches the database. Every method returns PLAIN
// RECORDS, so the pure layers never see an ORM instance.
// ============================================================

import { AiProviderCredential } from './AiProviderCredential';
import { parseEnvelopeOrNull } from '../crypto';
import type { CredentialStore, StoreScope } from '../resolver/store';
import type { AiStrategy, CredentialRecord } from '../types';

/**
 * Build the store.
 *
 * NOTE ON THE FAN-OUT: `findCandidates` issues TWO scoped queries and concatenates.
 * Row-level filters are single-equality and cannot express `org = X OR user = Y`; anyone
 * who "optimises" this into one OR query has either bypassed row scoping or changed the
 * candidate set. De-dupe by id happens in the RESOLVER, so selection stays pure.
 */
export function createOrmCredentialStore(): CredentialStore {
    return {
        async findCandidates(scope: StoreScope, strategy: AiStrategy): Promise<CredentialRecord[]> {
            const queries: Array<Promise<AiProviderCredential[]>> = [];

            const wantsUser = strategy !== 'org';
            const wantsOrg = strategy !== 'user';

            // Filter ONLY on the tenancy dimensions. NOT on `enabled`, `appId` or
            // `provider` — every one of those is a VERDICT the resolver must be able to
            // report, and filtering them in SQL kills the reason code at the database layer.
            if (wantsUser && scope.userId) {
                queries.push(AiProviderCredential.where({ userId: scope.userId }) as Promise<AiProviderCredential[]>);
            }
            if (wantsOrg && scope.organizationId) {
                queries.push(
                    AiProviderCredential.where({
                        organizationId: scope.organizationId,
                    }) as Promise<AiProviderCredential[]>,
                );
            }
            if (queries.length === 0) return [];

            const results = await Promise.all(queries);
            return results.flat().map((row) => row.toRecord());
        },

        async findByIdInScope(scope: StoreScope, id: string): Promise<CredentialRecord | null> {
            // The scope check is IN THE QUERY, not a comparison after it: two branches that
            // differ in work performed reopen the existence oracle as a timing side channel.
            // Two queries again, for the same single-equality reason.
            const attempts: Array<Record<string, unknown>> = [];
            if (scope.userId) attempts.push({ id, userId: scope.userId });
            if (scope.organizationId) attempts.push({ id, organizationId: scope.organizationId });
            if (attempts.length === 0) return null;

            const rows = await Promise.all(attempts.map((where) => AiProviderCredential.first(where)));
            const found = rows.find(Boolean) as AiProviderCredential | undefined;
            if (!found) return null;

            const record = found.toRecord();
            // MANAGEMENT IS ALWAYS STRICT ON THE APP DIMENSION — see `appMatch`, whose
            // contract is "`wildcard` WIDENS USE, NEVER MANAGEMENT". So this is deliberately
            // NOT `appMatch(...)`: even under `appScope: 'wildcard'` an unbound row must not
            // become manageable from an app that merely happens to be allowed to USE it.
            //
            // An UNBOUND row (`appId: null`) is therefore not a wildcard here. The check used
            // to be `record.appId && record.appId !== scope.appId`, which let every null-appId
            // row through for every app. Those rows are reachable — generic auto-CRUD, a
            // direct database write, or any deployment that ran before an `appId` was
            // configured — so a manager in app B could load, re-key or delete an unbound
            // credential belonging to app A, through the management plane, with no RLS
            // violation to detect. Strict equality on BOTH sides is the boundary.
            if ((scope.appId ?? null) !== (record.appId ?? null)) return null;
            return record;
        },

        async markActive(id: string): Promise<boolean> {
            return AiProviderCredential.activate(id);
        },

        async recordOutcome(id, outcome): Promise<void> {
            await AiProviderCredential.recordOutcome(id, outcome);
        },

        async *iterateByKeyId(keyId: string, batchSize: number) {
            let offset = 0;
            for (;;) {
                const rows = (await AiProviderCredential.where(
                    { keyId },
                    { orderBy: 'id', orderDirection: 'asc', limit: batchSize, offset },
                )) as AiProviderCredential[];
                if (rows.length === 0) return;
                yield rows.map((row) => row.toRecord());
                if (rows.length < batchSize) return;
                offset += rows.length;
            }
        },

        async replaceSecret(id, next, expect): Promise<boolean> {
            // The model owns the re-read-inside-the-write and the key-id precondition.
            return AiProviderCredential.rewrapSecret(id, next, expect);
        },

        async deleteById(id: string): Promise<boolean> {
            // HARD delete, including the ciphertext. Soft delete would mean the operator
            // still holds the tenant's third-party secret — in production and in every
            // backup — after being explicitly asked to remove it.
            return AiProviderCredential.delete(id);
        },

        async countByEnvelopeKeyId(keyId: string): Promise<number> {
            // SCAN THE ENVELOPE, NOT THE INDEX COLUMN. A partial restore, or a re-wrap that
            // updated one and not the other, makes the index count read zero while old-key
            // rows remain — retire the secret on that and those credentials become
            // permanently undecryptable, reported as "decrypt-failed", which means "wrong
            // master secret deployed" and sends incident response in exactly the wrong
            // direction.
            const rows = (await AiProviderCredential.where({ secretKind: 'inline' })) as AiProviderCredential[];
            let count = 0;
            for (const row of rows) {
                const record = row.toRecord();
                if (record.secret.kind !== 'inline') continue;
                const parsed = parseEnvelopeOrNull(record.secret.ciphertext);
                if (parsed?.keyId === keyId) count += 1;
            }
            return count;
        },
    };
}
