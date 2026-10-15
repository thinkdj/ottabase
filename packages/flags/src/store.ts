import { FlagOverride } from './ottaorm-models/FlagOverride';
import type { Override, OverrideStore, Subject } from './types';

/**
 * The default store: three narrow reads (app-wide, the organization's, the user's own),
 * each hitting the subject index. The resolver orders them; this only fetches.
 *
 * Expiry is filtered by the resolver, not the query, so a row the operator set to expire
 * shows in the admin until it is deleted and stops applying the moment it is past.
 */
export function createModelOverrideStore<Env = unknown>(): OverrideStore<Env> {
    return {
        async list(_env, subject): Promise<Override[]> {
            const scopes: Array<Record<string, unknown>> = [
                { appId: subject.appId, organizationId: null, userId: null },
            ];
            if (subject.organizationId) {
                scopes.push({ appId: subject.appId, organizationId: subject.organizationId, userId: null });
            }
            if (subject.userId) {
                scopes.push({ appId: subject.appId, organizationId: subject.organizationId, userId: subject.userId });
            }
            const rows = await Promise.all(scopes.map((where) => FlagOverride.where(where) as Promise<FlagOverride[]>));
            return rows.flat().map((row) => row.toOverride());
        },
    };
}

/** For tests and for hosts that keep overrides elsewhere. */
export function createMemoryOverrideStore<Env = unknown>(
    overrides: Array<Override & Pick<Subject, 'appId'> & Partial<Pick<Subject, 'organizationId' | 'userId'>>> = [],
): OverrideStore<Env> & { overrides: typeof overrides } {
    return {
        overrides,
        async list(_env, subject) {
            return overrides.filter((override) => {
                if (override.appId !== subject.appId) return false;
                if (override.scope === 'app') return !override.organizationId && !override.userId;
                if (override.scope === 'organization') {
                    return override.organizationId === subject.organizationId && !override.userId;
                }
                return (
                    override.userId === subject.userId && (override.organizationId ?? null) === subject.organizationId
                );
            });
        },
    };
}
