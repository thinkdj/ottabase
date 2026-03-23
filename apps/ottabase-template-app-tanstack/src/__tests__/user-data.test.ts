/**
 * Tests for GDPR user data export & account deletion handlers
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================
// Hoisted mock fns — these are accessible inside vi.mock factories
// ============================================================
const mocks = vi.hoisted(() => ({
    getSession: vi.fn(),
    createD1Driver: vi.fn(() => ({})),
    registerConnection: vi.fn(),
    getOttabaseConfig: vi.fn(() => ({
        packages: { comments: false, referrals: false, shortlinks: false, ottablog: false },
    })),
    getAuthOptions: vi.fn(() => ({})),
    enforceRateLimit: vi.fn(() => null),
    getClientIpAddress: vi.fn(() => '127.0.0.1'),
    readJson: vi.fn(),

    // Models
    userFind: vi.fn(),
    userDelete: vi.fn(),
    accountWhere: vi.fn(),
    accountDelete: vi.fn(),
    sessionWhere: vi.fn(),
    sessionDelete: vi.fn(),
    userRoleWhere: vi.fn(),
    userRoleDelete: vi.fn(),
    orgMemberWhere: vi.fn(),
    orgMemberDelete: vi.fn(),
    auditLogWhere: vi.fn(),
    auditLogLog: vi.fn(),
    todoWhere: vi.fn(),
    todoDelete: vi.fn(),
}));

vi.mock('@ottabase/auth/backend', () => ({
    getSession: mocks.getSession,
}));

vi.mock('@ottabase/db/drizzle-d1', () => ({
    createD1Driver: mocks.createD1Driver,
}));

vi.mock('@ottabase/ottaorm', () => ({
    registerConnection: mocks.registerConnection,
}));

vi.mock('@ottabase/ottaorm/models', () => ({
    User: { find: mocks.userFind, delete: mocks.userDelete },
    Account: { where: mocks.accountWhere, delete: mocks.accountDelete },
    Session: { where: mocks.sessionWhere, delete: mocks.sessionDelete },
    UserRole: { where: mocks.userRoleWhere, delete: mocks.userRoleDelete },
    OrganizationMember: { where: mocks.orgMemberWhere, delete: mocks.orgMemberDelete },
    AuditLog: { where: mocks.auditLogWhere, log: mocks.auditLogLog },
}));

vi.mock('../../ottabase/models/Todo', () => ({
    Todo: { where: mocks.todoWhere, delete: mocks.todoDelete },
}));

vi.mock('../../ottabase/config.loader', () => ({
    getOttabaseConfig: mocks.getOttabaseConfig,
}));

vi.mock('../../worker/lib/auth-utils', () => ({
    getAuthOptions: mocks.getAuthOptions,
}));

vi.mock('../../worker/lib/rate-limiting', () => ({
    enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('../../worker/lib/utils', () => ({
    getClientIpAddress: mocks.getClientIpAddress,
    readJson: mocks.readJson,
}));

// Now import the handlers
import { handleUserAccountDelete, handleUserDataExport } from '../../worker/routes/user-data';

function createContext(overrides: Partial<any> = {}) {
    const request = overrides.request || new Request('https://example.com/api/users/me/export', { method: 'GET' });
    return {
        request,
        env: {
            OBCF_D1: {},
            ...(overrides.env || {}),
        },
        url: overrides.url || new URL(request.url),
        withAuthCors: overrides.withAuthCors || ((r: Response) => r),
    } as any;
}

function createMockModel(data: Record<string, any>) {
    return {
        toJson: () => ({ ...data }),
        get: (key: string) => data[key],
        set: vi.fn((key: string, value: any) => {
            data[key] = value;
        }),
        save: vi.fn(),
    };
}

describe('handleUserDataExport', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.enforceRateLimit.mockReturnValue(null);
        mocks.auditLogLog.mockResolvedValue({});
        mocks.getOttabaseConfig.mockReturnValue({
            packages: { comments: false, referrals: false, shortlinks: false, ottablog: false },
        });
    });

    it('returns 401 when not authenticated', async () => {
        mocks.getSession.mockResolvedValue(null);
        const response = await handleUserDataExport(createContext());
        expect(response.status).toBe(401);
    });

    it('returns 500 when D1 is not configured', async () => {
        const response = await handleUserDataExport(createContext({ env: { OBCF_D1: undefined } }));
        expect(response.status).toBe(500);
    });

    it('returns user data as downloadable JSON', async () => {
        mocks.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } });

        mocks.userFind.mockResolvedValue(
            createMockModel({ id: 'user-1', name: 'Test User', email: 'test@example.com' }),
        );
        mocks.accountWhere.mockResolvedValue([]);
        mocks.sessionWhere.mockResolvedValue([]);
        mocks.userRoleWhere.mockResolvedValue([]);
        mocks.orgMemberWhere.mockResolvedValue([]);
        mocks.auditLogWhere.mockResolvedValue([]);
        mocks.todoWhere.mockResolvedValue([]);

        const response = await handleUserDataExport(createContext());

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Disposition')).toContain('user-data-export');
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(response.headers.get('Cache-Control')).toBe('no-store');

        const body = JSON.parse(await response.text());
        expect(body.profile).toBeDefined();
        expect(body.profile.id).toBe('user-1');
        expect(body.exportedAt).toBeDefined();
    });

    it('strips sensitive fields from exported data', async () => {
        mocks.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } });

        mocks.userFind.mockResolvedValue(
            createMockModel({ id: 'user-1', email: 'test@example.com', passwordHash: 'secret-hash' }),
        );
        mocks.accountWhere.mockResolvedValue([
            createMockModel({
                id: 'acc-1',
                provider: 'google',
                access_token: 'secret-token',
                refresh_token: 'secret-refresh',
                id_token: 'secret-id-token',
            }),
        ]);
        mocks.sessionWhere.mockResolvedValue([]);
        mocks.userRoleWhere.mockResolvedValue([]);
        mocks.orgMemberWhere.mockResolvedValue([]);
        mocks.auditLogWhere.mockResolvedValue([]);
        mocks.todoWhere.mockResolvedValue([]);

        const response = await handleUserDataExport(createContext());
        const body = JSON.parse(await response.text());

        expect(body.profile.passwordHash).toBeUndefined();
        expect(body.accounts[0].access_token).toBeUndefined();
        expect(body.accounts[0].refresh_token).toBeUndefined();
        expect(body.accounts[0].id_token).toBeUndefined();
        expect(body.accounts[0].provider).toBe('google');
    });

    it('logs the export action to audit', async () => {
        mocks.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } });
        mocks.userFind.mockResolvedValue(createMockModel({ id: 'user-1' }));
        mocks.accountWhere.mockResolvedValue([]);
        mocks.sessionWhere.mockResolvedValue([]);
        mocks.userRoleWhere.mockResolvedValue([]);
        mocks.orgMemberWhere.mockResolvedValue([]);
        mocks.auditLogWhere.mockResolvedValue([]);
        mocks.todoWhere.mockResolvedValue([]);

        await handleUserDataExport(createContext());

        expect(mocks.auditLogLog).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                action: 'export',
                resourceType: 'user',
            }),
        );
    });
});

describe('handleUserAccountDelete', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.enforceRateLimit.mockReturnValue(null);
        mocks.auditLogLog.mockResolvedValue({});
        mocks.getOttabaseConfig.mockReturnValue({
            packages: { comments: false, referrals: false, shortlinks: false, ottablog: false },
        });
    });

    it('returns 401 when not authenticated', async () => {
        mocks.getSession.mockResolvedValue(null);
        const ctx = createContext({
            request: new Request('https://example.com/api/users/me/delete', { method: 'POST' }),
        });
        const response = await handleUserAccountDelete(ctx);
        expect(response.status).toBe(401);
    });

    it('returns 400 when email confirmation is missing', async () => {
        mocks.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } });
        mocks.readJson.mockResolvedValue({});

        const ctx = createContext({
            request: new Request('https://example.com/api/users/me/delete', { method: 'POST' }),
        });
        const response = await handleUserAccountDelete(ctx);
        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body.code).toBe('CONFIRMATION_REQUIRED');
    });

    it('returns 400 when email does not match', async () => {
        mocks.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } });
        mocks.readJson.mockResolvedValue({ confirmEmail: 'wrong@example.com' });
        mocks.userFind.mockResolvedValue(createMockModel({ id: 'user-1', email: 'test@example.com' }));

        const ctx = createContext({
            request: new Request('https://example.com/api/users/me/delete', { method: 'POST' }),
        });
        const response = await handleUserAccountDelete(ctx);
        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body.code).toBe('EMAIL_MISMATCH');
    });

    it('deletes user and related data on correct email confirmation', async () => {
        mocks.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } });
        mocks.readJson.mockResolvedValue({ confirmEmail: 'test@example.com' });
        mocks.userFind.mockResolvedValue(createMockModel({ id: 'user-1', email: 'test@example.com' }));
        mocks.userDelete.mockResolvedValue(true);

        mocks.sessionWhere.mockResolvedValue([createMockModel({ id: 'sess-1' })]);
        mocks.sessionDelete.mockResolvedValue(true);
        mocks.accountWhere.mockResolvedValue([createMockModel({ id: 'acc-1' })]);
        mocks.accountDelete.mockResolvedValue(true);
        mocks.userRoleWhere.mockResolvedValue([]);
        mocks.orgMemberWhere.mockResolvedValue([]);
        mocks.todoWhere.mockResolvedValue([]);
        mocks.auditLogWhere.mockResolvedValue([]);

        const ctx = createContext({
            request: new Request('https://example.com/api/users/me/delete', { method: 'POST' }),
        });
        const response = await handleUserAccountDelete(ctx);
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.deletedTables).toContain('users');
        expect(body.deletedTables).toContain('sessions');
        expect(body.deletedTables).toContain('accounts');
    });

    it('anonymizes audit logs instead of deleting them', async () => {
        mocks.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } });
        mocks.readJson.mockResolvedValue({ confirmEmail: 'test@example.com' });
        mocks.userFind.mockResolvedValue(createMockModel({ id: 'user-1', email: 'test@example.com' }));
        mocks.userDelete.mockResolvedValue(true);

        const auditLog = createMockModel({
            id: 'audit-1',
            userId: 'user-1',
            userEmail: 'test@example.com',
        });
        mocks.sessionWhere.mockResolvedValue([]);
        mocks.accountWhere.mockResolvedValue([]);
        mocks.userRoleWhere.mockResolvedValue([]);
        mocks.orgMemberWhere.mockResolvedValue([]);
        mocks.todoWhere.mockResolvedValue([]);
        mocks.auditLogWhere.mockResolvedValue([auditLog]);

        const ctx = createContext({
            request: new Request('https://example.com/api/users/me/delete', { method: 'POST' }),
        });
        await handleUserAccountDelete(ctx);

        // Verify audit log was anonymized, not deleted
        expect(auditLog.set).toHaveBeenCalledWith('userId', null);
        expect(auditLog.set).toHaveBeenCalledWith('userEmail', 'deleted-user');
        expect(auditLog.set).toHaveBeenCalledWith('ipAddress', null);
        expect(auditLog.set).toHaveBeenCalledWith('userAgent', null);
        expect(auditLog.save).toHaveBeenCalled();
    });

    it('logs deletion to audit before deleting', async () => {
        mocks.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } });
        mocks.readJson.mockResolvedValue({ confirmEmail: 'test@example.com' });
        mocks.userFind.mockResolvedValue(createMockModel({ id: 'user-1', email: 'test@example.com' }));
        mocks.userDelete.mockResolvedValue(true);
        mocks.sessionWhere.mockResolvedValue([]);
        mocks.accountWhere.mockResolvedValue([]);
        mocks.userRoleWhere.mockResolvedValue([]);
        mocks.orgMemberWhere.mockResolvedValue([]);
        mocks.todoWhere.mockResolvedValue([]);
        mocks.auditLogWhere.mockResolvedValue([]);

        const ctx = createContext({
            request: new Request('https://example.com/api/users/me/delete', { method: 'POST' }),
        });
        await handleUserAccountDelete(ctx);

        expect(mocks.auditLogLog).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                action: 'delete',
                resourceType: 'user',
                metadata: expect.objectContaining({ type: 'gdpr_account_deletion' }),
            }),
        );
    });
});
