import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureDbConnection, initAdminCron, resetDbConnectionForTests } from '../db-utils';
import { mediaBase } from '@ottabase/utils/media';

const {
    mockRegisterConnection,
    mockRegisterModels,
    mockRegisterPolicy,
    mockInitRLS,
    mockClearConnection,
    mockHasConnection,
    mockCreateD1Driver,
    mockConfigureOttaORM,
    PackageModel,
    packagePolicy,
} = vi.hoisted(() => ({
    mockRegisterConnection: vi.fn(),
    mockRegisterModels: vi.fn(),
    mockRegisterPolicy: vi.fn(),
    mockInitRLS: vi.fn(),
    mockClearConnection: vi.fn(),
    mockHasConnection: vi.fn(() => false),
    mockCreateD1Driver: vi.fn((binding) => ({ binding })),
    mockConfigureOttaORM: vi.fn(),
    PackageModel: class PackageModel {},
    packagePolicy: { model: 'package_rows', policy: { tenantScoped: true }, contextFields: ['organizationId'] },
}));

vi.mock('@ottabase/db/drizzle-d1', () => ({
    createD1Driver: mockCreateD1Driver,
}));

vi.mock('@ottabase/ottaorm', () => ({
    clearConnection: mockClearConnection,
    configureOttaORM: mockConfigureOttaORM,
    hasConnection: mockHasConnection,
    initRLS: mockInitRLS,
    registerConnection: mockRegisterConnection,
    registerModels: mockRegisterModels,
    registerPolicy: mockRegisterPolicy,
    // The files service (whose public base configures the ORM) is built over the media store.
    mediaFileStore: {},
}));

vi.mock('@ottabase/ottaorm/models', () => ({
    Account: class Account {},
    Media: class Media {},
    Organization: class Organization {},
    OrganizationMember: class OrganizationMember {},
    Permission: class Permission {},
    Role: class Role {},
    ScheduledTask: class ScheduledTask {},
    UserGroup: class UserGroup {},
    UserGroupMember: class UserGroupMember {},
    UserRole: class UserRole {},
    VerificationToken: class VerificationToken {},
}));

// The registry is what every package contributes, collected (ottabase/packages.ts). What the
// packages ARE is the registration test's business; here it is one model and one policy.
vi.mock('../../../ottabase/registry', () => ({
    packages: {
        models: () => [PackageModel],
        policies: () => [packagePolicy],
    },
}));

vi.mock('../../../ottabase/models/mediaLibraryPolicy', () => ({
    mediaLibraryPolicy: { name: 'mediaLibraryPolicy' },
}));

vi.mock('../utils', () => ({
    readJson: vi.fn(),
}));

describe('ensureDbConnection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHasConnection.mockReturnValue(false);
        resetDbConnectionForTests();
    });

    it('registers the connection only once per isolate for the same binding', () => {
        const env = { OBCF_D1: { id: 'binding-1' }, OTTAORM_MAX_ALL_ROWS: '5000' } as any;

        ensureDbConnection(env);
        const policyCallsAfterFirst = mockRegisterPolicy.mock.calls.length;
        ensureDbConnection(env);

        expect(mockCreateD1Driver).toHaveBeenCalledTimes(1);
        expect(mockRegisterConnection).toHaveBeenCalledTimes(1);
        expect(mockRegisterModels).toHaveBeenCalledTimes(1);
        expect(mockInitRLS).toHaveBeenCalledTimes(1);
        // Runtime safety configuration is intentionally refreshed on every entry,
        // even when the isolate can reuse the existing database connection.
        expect(mockConfigureOttaORM).toHaveBeenCalledTimes(2);
        expect(mockConfigureOttaORM).toHaveBeenNthCalledWith(1, { maxAllRows: '5000' });
        expect(mockConfigureOttaORM).toHaveBeenNthCalledWith(2, { maxAllRows: '5000' });
        expect(mediaBase()).toBe('/api/files/public');
        expect(mockRegisterPolicy.mock.calls.length).toBe(policyCallsAfterFirst);
        expect(policyCallsAfterFirst).toBeGreaterThan(0);
    });

    it('registers core models first, then every model the packages contribute', () => {
        ensureDbConnection({ OBCF_D1: { id: 'binding-1' } } as any);

        const registered = mockRegisterModels.mock.calls[0][0] as Array<{ name: string }>;
        const names = registered.map((model) => model.name);
        expect(names.slice(0, 2)).toEqual(['Account', 'Media']);
        expect(names.at(-1)).toBe('PackageModel');
    });

    it('registers package policies AFTER initRLS, so a package policy wins over a built-in of the same name', () => {
        ensureDbConnection({ OBCF_D1: { id: 'binding-1' } } as any);

        expect(mockRegisterPolicy).toHaveBeenCalledWith({ name: 'mediaLibraryPolicy' });
        expect(mockRegisterPolicy).toHaveBeenCalledWith(packagePolicy);
        const packagePolicyCall = mockRegisterPolicy.mock.invocationCallOrder[1];
        expect(packagePolicyCall).toBeGreaterThan(mockInitRLS.mock.invocationCallOrder[0]);
    });

    it('reinitializes when the D1 binding changes', () => {
        const firstEnv = { OBCF_D1: { id: 'binding-1' } } as any;
        const secondEnv = { OBCF_D1: { id: 'binding-2' } } as any;

        ensureDbConnection(firstEnv);
        mockHasConnection.mockReturnValue(true);
        ensureDbConnection(secondEnv);

        expect(mockCreateD1Driver).toHaveBeenCalledTimes(2);
        expect(mockRegisterConnection).toHaveBeenCalledTimes(2);
        expect(mockClearConnection).toHaveBeenCalledTimes(1);
    });
});

describe('initAdminCron', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('configures OttaORM before registering the cron connection', () => {
        const binding = { id: 'cron-binding' };
        const response = initAdminCron({ OBCF_D1: binding, OTTAORM_MAX_ALL_ROWS: '2500' } as any);

        expect(response).toBeNull();
        expect(mockConfigureOttaORM).toHaveBeenCalledWith({ maxAllRows: '2500' });
        expect(mockCreateD1Driver).toHaveBeenCalledWith(binding);
        expect(mockConfigureOttaORM.mock.invocationCallOrder[0]).toBeLessThan(
            mockRegisterConnection.mock.invocationCallOrder[0],
        );
    });

    it('fails closed without a D1 binding', async () => {
        const response = initAdminCron({} as any);

        expect(response?.status).toBe(500);
        expect(response?.headers.get('cache-control')).toBe('no-store');
        await expect(response?.json()).resolves.toMatchObject({ code: 'CONFIG_ERROR' });
        expect(mockConfigureOttaORM).not.toHaveBeenCalled();
    });
});
