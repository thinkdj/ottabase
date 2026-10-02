import { drizzle } from 'drizzle-orm/d1';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearConnection, registerConnection } from '../../context';
import { UserRole } from '../UserRole';

/** Minimal D1 fake that records every statement drizzle prepares. */
function fakeD1(returningRows: Record<string, unknown>[] = []) {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    return {
        statements,
        prepare(sql: string) {
            const stmt = {
                sql,
                params: [] as unknown[],
                bind(...params: unknown[]) {
                    stmt.params = params;
                    return stmt;
                },
                async run() {
                    statements.push({ sql, params: stmt.params });
                    return { success: true, meta: {} };
                },
                async all() {
                    statements.push({ sql, params: stmt.params });
                    return { success: true, results: returningRows, meta: {} };
                },
                async raw() {
                    statements.push({ sql, params: stmt.params });
                    return returningRows.map((row) => Object.values(row));
                },
            };
            return stmt;
        },
    };
}

/**
 * user_roles has a COMPOSITE key (userId + roleId + organizationId) but BaseModel addresses rows by
 * one column (`primaryKey = 'userId'`). Every write must use the full key, or revoking one grant
 * deletes every role the user holds in every org (including a system-scoped platform_owner).
 */
describe('UserRole composite-key persistence', () => {
    let d1: ReturnType<typeof fakeD1>;

    beforeEach(() => {
        clearConnection('default');
        d1 = fakeD1();
        const db = drizzle(d1 as never);
        registerConnection('default', { getDb: () => db, execute: async () => [], executeRaw: async () => [] });
    });

    afterEach(() => clearConnection('default'));

    const grant = () =>
        new UserRole({
            entity: 'user_roles',
            data: { userId: 'u1', roleId: 'r1', organizationId: 'org-1', appId: null, assignedBy: null },
        });

    it('destroy() deletes by userId + roleId + organizationId, not userId alone', async () => {
        await grant().destroy();

        expect(d1.statements).toHaveLength(1);
        const { sql, params } = d1.statements[0];
        expect(sql.toLowerCase()).toMatch(/^delete from "user_roles"/);
        expect(sql).toContain('"user_id" = ?');
        expect(sql).toContain('"role_id" = ?');
        expect(sql).toContain('"organization_id" = ?');
        expect(params).toEqual(['u1', 'r1', 'org-1']);
    });

    it('save() updates by the full key', async () => {
        d1 = fakeD1([
            { user_id: 'u1', role_id: 'r1', organization_id: 'org-1', app_id: null, assigned_at: 1, assigned_by: 'a' },
        ]);
        const db = drizzle(d1 as never);
        registerConnection('default', { getDb: () => db, execute: async () => [], executeRaw: async () => [] });

        await grant().save();

        const { sql, params } = d1.statements[0];
        expect(sql.toLowerCase()).toMatch(/^update "user_roles"/);
        expect(sql).toContain('"role_id" = ?');
        expect(sql).toContain('"organization_id" = ?');
        expect(params.slice(-3)).toEqual(['u1', 'r1', 'org-1']);
    });

    it('refuses to address a grant without its full key', async () => {
        const partial = new UserRole({ entity: 'user_roles', data: { userId: 'u1', roleId: 'r1' } });
        await expect(partial.destroy()).rejects.toThrow(/organizationId/);
        expect(d1.statements).toHaveLength(0);
    });

    it.each(['update', 'updateConstrained', 'delete', 'deleteConstrained', 'forceDelete'] as const)(
        'blocks static single-key %s()',
        async (method) => {
            await expect((UserRole as any)[method]('u1', {})).rejects.toThrow(/composite key/);
            expect(d1.statements).toHaveLength(0);
        },
    );

    it('removeRole/hasRole require an organizationId', async () => {
        await expect(UserRole.removeRole('u1', 'r1', '' as string)).rejects.toThrow(/organizationId/);
        await expect(UserRole.hasRole('u1', 'r1', undefined as unknown as string)).rejects.toThrow(/organizationId/);
    });
});

/**
 * Callers gate a privilege DOWNGRADE on this method (roster demotion/removal revokes the user's
 * org-scoped grants before the membership row is rewritten). So "resolved" has to mean "every grant
 * is gone" — a partial delete that resolves would let a demoted owner keep media:*, org:admin, etc.
 */
describe('UserRole.revokeAllForOrganization', () => {
    afterEach(() => vi.restoreAllMocks());

    it('destroys every grant for the user in that org and returns the count', async () => {
        const destroyA = vi.fn().mockResolvedValue(undefined);
        const destroyB = vi.fn().mockResolvedValue(undefined);
        const whereSpy = vi
            .spyOn(UserRole as any, 'where')
            .mockResolvedValueOnce([{ destroy: destroyA }, { destroy: destroyB }])
            .mockResolvedValueOnce([]); // re-read confirms none survived

        await expect(UserRole.revokeAllForOrganization('u1', 'org-1')).resolves.toBe(2);

        expect(whereSpy).toHaveBeenCalledWith({ userId: 'u1', organizationId: 'org-1' });
        expect(destroyA).toHaveBeenCalled();
        expect(destroyB).toHaveBeenCalled();
    });

    it('THROWS when a grant survives — a partial delete must not resolve as success', async () => {
        vi.spyOn(UserRole as any, 'where')
            .mockResolvedValueOnce([{ destroy: vi.fn().mockResolvedValue(undefined) }])
            .mockResolvedValueOnce([{ id: 'grant-still-present' }]); // re-read finds a survivor

        await expect(UserRole.revokeAllForOrganization('u1', 'org-1')).rejects.toThrow(/still present/);
    });

    it('propagates a destroy() failure instead of swallowing it', async () => {
        vi.spyOn(UserRole as any, 'where').mockResolvedValueOnce([
            { destroy: vi.fn().mockRejectedValue(new Error('D1 unavailable')) },
        ]);

        await expect(UserRole.revokeAllForOrganization('u1', 'org-1')).rejects.toThrow('D1 unavailable');
    });
});
