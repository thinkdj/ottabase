import { describe, expect, it, vi } from 'vitest';

vi.mock('@ottabase/auth/backend', () => ({
    getSession: vi.fn(async () => ({ user: { id: 'user-a', organizationId: 'org-a' } })),
}));
vi.mock('../../worker/lib/auth-utils', () => ({ getAuthOptions: () => ({}) }));
vi.mock('../../worker/lib/admin-guard', () => ({
    SYSTEM_ORGANIZATION_ID: 'system',
    // Signed in, but not an admin.
    requireAdminAccess: vi.fn(async () => new Response(null, { status: 403 })),
}));

import { handleAuditLogs } from '../../worker/routes/audit';

/** Minimal D1 stub that records every query and its bound values. */
function recordingD1() {
    const calls: { sql: string; values: unknown[] }[] = [];
    const db = {
        prepare(sql: string) {
            return {
                bind(...values: unknown[]) {
                    calls.push({ sql, values });
                    return {
                        first: async () => ({ total: 0 }),
                        all: async () => ({ results: [] }),
                    };
                },
            };
        },
    };
    return { db, calls };
}

describe('handleAuditLogs', () => {
    it('returns 500 when D1 binding is missing', async () => {
        const request = new Request('http://localhost/api/audit/logs');
        const response = await handleAuditLogs({
            request,
            url: new URL(request.url),
            env: {} as any,
        });

        expect(response.status).toBe(500);
    });

    // wrangler.jsonc's top-level ENVIRONMENT is 'development', so a dev bypass here would ship
    // every tenant's audit rows to any signed-in user on a deploy without --env.
    it('scopes a non-admin to their own rows even when ENVIRONMENT is development', async () => {
        const { db, calls } = recordingD1();
        const request = new Request('http://localhost/api/audit/logs?organizationId=org-b&userId=user-b');
        const response = await handleAuditLogs({
            request,
            url: new URL(request.url),
            env: { OBCF_D1: db, ENVIRONMENT: 'development' } as any,
        });

        expect(response.status).toBe(200);
        expect(calls[0].sql).toContain('user_id = ?');
        expect(calls[0].sql).toContain('organization_id = ?');
        expect(calls[0].values).toEqual(['user-a', 'org-a']);
    });
});
