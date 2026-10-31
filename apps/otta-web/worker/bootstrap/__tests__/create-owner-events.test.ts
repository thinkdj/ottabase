/**
 * The bootstrap owner is an account like any other: once it exists (past every rollback), the bus
 * hears `user.created` and, since it is created verified, `user.verified`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    userCreate: vi.fn(),
    provision: vi.fn(),
    createSession: vi.fn(),
    emitAccountEvent: vi.fn(),
}));

vi.mock('@ottabase/auth/backend', () => ({
    bootstrapFirstUser: vi.fn(async () => undefined),
    createSessionCookieForUser: m.createSession,
    hashPassword: vi.fn(async () => 'hashed'),
}));
vi.mock('@ottabase/db/drizzle-d1', () => ({ createD1Driver: vi.fn(() => ({})) }));
vi.mock('@ottabase/ottaorm', () => ({
    registerConnection: vi.fn(),
    Role: { ensureDefaultRoles: vi.fn(async () => undefined) },
    User: { create: m.userCreate, delete: vi.fn() },
    Organization: { delete: vi.fn() },
}));
vi.mock('../state-resolver', () => ({ ensureMetaTable: vi.fn(async () => undefined) }));
vi.mock('../../lib/user-provisioning', () => ({ provisionDefaultOrganizationForUser: m.provision }));
vi.mock('../../lib/auth-utils', () => ({
    emitAccountEvent: m.emitAccountEvent,
    reconcileSystemRoleSessions: vi.fn(),
}));
vi.mock('../../../ottabase/packages', () => ({ packages: {} }));
vi.mock('../../../ottabase/db/schemas-helper', () => ({ getAllSchemas: vi.fn() }));
vi.mock('../../../ottabase/migrations', () => ({ buildAppMigrations: vi.fn() }));
vi.mock('../../../ottabase/config.loader', () => ({ getOttabaseConfig: () => ({ appId: 'otta-web' }) }));

const { handleBootstrapRoute } = await import('../routes');

/** A D1 that lets the owner claim through and reports no users yet. */
const d1 = {
    prepare: () => {
        const statement = { bind: () => statement, run: async () => ({}), first: async () => ({ count: 0 }) };
        return statement;
    },
};

function createOwner() {
    const request = new Request('https://app.test/__bootstrap__/api/create-owner', {
        method: 'POST',
        headers: { 'X-Bootstrap-Secret': 'fixture-secret', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'Owner@Example.com', password: 'Str0ng!Password', name: 'Owner' }),
    });
    return handleBootstrapRoute({
        request,
        url: new URL(request.url),
        env: { BOOTSTRAP_OWNER_SECRET: 'fixture-secret', OBCF_D1: d1 } as any,
        platformState: { state: 'UNINITIALIZED', source: 'probe' } as any,
    });
}

describe('create-owner account events', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        m.userCreate.mockImplementation(async (data: Record<string, unknown>) => ({
            get: (key: string) => (key === 'id' ? 'owner-1' : data[key]),
        }));
        m.provision.mockResolvedValue({ organizationId: 'org-1', assignedRole: 'owner' });
        m.createSession.mockResolvedValue({ cookie: 'session=1', session: { expiresAt: 1 } });
    });

    it('announces the owner created, with its workspace, and verified', async () => {
        expect((await createOwner()).status).toBe(200);

        const verifiedAt = m.userCreate.mock.calls[0][0].emailVerified;
        expect(m.emitAccountEvent.mock.calls).toEqual([
            [
                expect.anything(),
                'user.created',
                {
                    userId: 'owner-1',
                    email: 'owner@example.com',
                    name: 'Owner',
                    organizationId: 'org-1',
                    method: 'credentials',
                    at: verifiedAt,
                },
            ],
            [expect.anything(), 'user.verified', { userId: 'owner-1', email: 'owner@example.com', at: verifiedAt }],
        ]);
    });

    it('announces nothing for an owner rolled back', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        m.createSession.mockRejectedValue(new Error('KV not bound'));

        expect((await createOwner()).status).toBe(500);
        expect(m.emitAccountEvent).not.toHaveBeenCalled();
    });
});
