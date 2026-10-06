/**
 * The audit feed: rows under the caller's scope plus the filters, facets over the scope alone.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ottabase/auth/backend', () => ({ getSession: vi.fn(async () => ({ user: { id: 'u1' } })) }));
vi.mock('../../lib/auth-utils', () => ({ getAuthOptions: () => ({}) }));
vi.mock('../../lib/admin-guard', () => ({
    SYSTEM_ORGANIZATION_ID: 'system',
    requireAdminAccess: vi.fn(async () => ({ user: { id: 'u1' }, organizationId: 'system' })),
}));

import { getSession } from '@ottabase/auth/backend';
import { requireAdminAccess } from '../../lib/admin-guard';
import { handleAuditLogs } from '../audit';

type Statement = { sql: string; values: unknown[] };
const row = { id: 'l1', user_id: 'u1', action: 'create', resource_type: 'role', status: 'success', created_at: 1 };

/** A D1 double that records every statement and answers by what the SQL asks for */
function d1() {
    const statements: Statement[] = [];
    const answer = (s: Statement) => {
        if (s.sql.includes('organization_members')) return { results: [{ organization_id: 'org1' }] };
        if (s.sql.includes('count(*) as total')) return { results: [{ total: 1 }] };
        if (s.sql.includes('GROUP BY')) return { results: [{ value: 'create', count: 1 }] };
        return { results: [row] };
    };
    const prepare = (sql: string) => ({
        bind: (...values: unknown[]) => {
            const statement = { sql, values };
            return {
                ...statement,
                all: async () => answer(statement),
                first: async () => answer(statement).results[0],
            };
        },
    });
    return {
        statements,
        prepare,
        batch: async (list: Statement[]) => list.map((s) => (statements.push(s), answer(s))),
    };
}

const call = async (query: string, env: Record<string, unknown> = {}) => {
    const db = d1();
    const url = new URL(`http://x/api/audit/logs${query}`);
    const res = await handleAuditLogs({ request: new Request(url), env: { OBCF_D1: db, ...env } as never, url });
    return { db, json: (await res.json()) as Record<string, any>, status: res.status };
};

describe('handleAuditLogs', () => {
    it('returns the page with facets counted over the scope, not the filters', async () => {
        const { db, json } = await call('?status=failure&action=create&search=ada');
        expect(json.data).toEqual([row]);
        expect(json.pagination.total).toBe(1);
        expect(json.facets).toEqual({
            actions: [{ value: 'create', count: 1 }],
            resourceTypes: [{ value: 'create', count: 1 }],
        });

        const [count, rows, actions] = db.statements;
        expect(rows.sql).toContain('status = ?');
        expect(rows.values).toEqual(expect.arrayContaining(['failure', 'create', '%ada%']));
        expect(count.values).toEqual(rows.values.slice(0, -2));
        expect(actions.sql).not.toContain('status = ?');
        expect(actions.sql).toContain('organization_id IN (?, ?)');
        expect(actions.values).toEqual(['org1', 'system']);
    });

    it('ignores a status it does not know', async () => {
        const { db } = await call('?status=whatever');
        expect(db.statements[1].sql).not.toContain('status = ?');
    });

    it('refuses an organization the caller is not a member of', async () => {
        const { status } = await call('?organizationId=other');
        expect(status).toBe(403);
    });

    // wrangler.jsonc's top-level ENVIRONMENT is 'development', so a dev bypass here would ship
    // every tenant's audit rows to any signed-in user on a deploy without --env.
    it('scopes a non-admin to their own rows even when ENVIRONMENT is development', async () => {
        vi.mocked(getSession).mockResolvedValueOnce({ user: { id: 'user-a', organizationId: 'org-a' } } as never);
        vi.mocked(requireAdminAccess).mockResolvedValueOnce(new Response(null, { status: 403 }));
        const { db, status } = await call('?organizationId=org-b&userId=user-b', { ENVIRONMENT: 'development' });
        expect(status).toBe(200);
        const rows = db.statements[1];
        expect(rows.sql).toContain('user_id = ?');
        expect(rows.sql).toContain('organization_id = ?');
        expect(rows.values.slice(0, 2)).toEqual(['user-a', 'org-a']);
    });

    it('returns 500 without a D1 binding', async () => {
        const url = new URL('http://x/api/audit/logs');
        const res = await handleAuditLogs({ request: new Request(url), env: {} as never, url });
        expect(res.status).toBe(500);
    });
});
