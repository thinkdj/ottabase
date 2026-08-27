import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureDbConnection, initAdminCron, resetDbConnectionForTests } from '../db-utils';

const {
    mockRegisterConnection,
    mockRegisterModels,
    mockRegisterPolicy,
    mockInitRLS,
    mockClearConnection,
    mockHasConnection,
    mockCreateD1Driver,
    mockConfigureOttaORM,
} = vi.hoisted(() => ({
    mockRegisterConnection: vi.fn(),
    mockRegisterModels: vi.fn(),
    mockRegisterPolicy: vi.fn(),
    mockInitRLS: vi.fn(),
    mockClearConnection: vi.fn(),
    mockHasConnection: vi.fn(() => false),
    mockCreateD1Driver: vi.fn((binding) => ({ binding })),
    mockConfigureOttaORM: vi.fn(),
}));

vi.mock('@ottabase/brand-engine/persistence', () => ({
    BrandKit: class BrandKit {},
    LayoutRouteMapping: class LayoutRouteMapping {},
    LayoutTemplate: class LayoutTemplate {},
    MenuSlotAssignment: class MenuSlotAssignment {},
}));

vi.mock('@ottabase/comments', () => ({
    Comment: class Comment {},
    CommentReaction: class CommentReaction {},
}));

vi.mock('@ottabase/db/drizzle-d1', () => ({
    createD1Driver: mockCreateD1Driver,
}));

vi.mock('@ottabase/ottablog', () => ({
    OttablogPlugin: class OttablogPlugin {},
    OttablogTheme: class OttablogTheme {},
    Post: class Post {},
    PostCategory: class PostCategory {},
    PostCategoryLink: class PostCategoryLink {},
    PostSeries: class PostSeries {},
    PostTag: class PostTag {},
    PostTagLink: class PostTagLink {},
    PostVersion: class PostVersion {},
}));

vi.mock('@ottabase/ottaorm', () => ({
    BaseModel: class BaseModel {},
    clearConnection: mockClearConnection,
    configureOttaORM: mockConfigureOttaORM,
    hasConnection: mockHasConnection,
    initRLS: mockInitRLS,
    registerConnection: mockRegisterConnection,
    registerModels: mockRegisterModels,
    registerPolicy: mockRegisterPolicy,
}));

vi.mock('@ottabase/ottaorm/models', () => ({
    Account: class Account {},
    Authenticator: class Authenticator {},
    Media: class Media {},
    Organization: class Organization {},
    OrganizationMember: class OrganizationMember {},
    Permission: class Permission {},
    Role: class Role {},
    ScheduledTask: class ScheduledTask {},
    Session: class Session {},
    UserGroup: class UserGroup {},
    UserGroupMember: class UserGroupMember {},
    UserRole: class UserRole {},
    VerificationToken: class VerificationToken {},
}));

vi.mock('@ottabase/referrals', () => ({
    ReferralTracking: class ReferralTracking {},
}));

vi.mock('@ottabase/shortlinks', () => ({
    Shortlink: class Shortlink {},
}));

vi.mock('../../ottabase/config.loader', () => ({
    getOttabaseConfig: vi.fn(() => ({
        packages: {
            ottablog: true,
            comments: true,
            shortlinks: true,
            referrals: true,
        },
    })),
}));

vi.mock('../../ottabase/models/Todo', () => ({
    Todo: class Todo {},
}));

vi.mock('../../ottabase/models/mediaLibraryPolicy', () => ({
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
        // Asserted as "unchanged by the second call", NOT as a fixed number: the policy
        // count is a function of which packages are enabled (media, plus ottaai's credential
        // policy, plus the ottablog org-mode overrides), so a hard-coded 1 would break every
        // time a package is added — while saying nothing about the invariant under test.
        expect(mockRegisterPolicy.mock.calls.length).toBe(policyCallsAfterFirst);
        expect(policyCallsAfterFirst).toBeGreaterThan(0);
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
