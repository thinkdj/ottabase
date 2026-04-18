import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureDbConnection, resetDbConnectionForTests } from '../db-utils';

const {
    mockRegisterConnection,
    mockRegisterModels,
    mockRegisterPolicy,
    mockInitRLS,
    mockClearConnection,
    mockHasConnection,
    mockCreateD1Driver,
} = vi.hoisted(() => ({
    mockRegisterConnection: vi.fn(),
    mockRegisterModels: vi.fn(),
    mockRegisterPolicy: vi.fn(),
    mockInitRLS: vi.fn(),
    mockClearConnection: vi.fn(),
    mockHasConnection: vi.fn(() => false),
    mockCreateD1Driver: vi.fn((binding) => ({ binding })),
}));

vi.mock('@ottabase/brand-engine/persistence', () => ({
    BrandKit: class BrandKit {},
    LayoutRouteMapping: class LayoutRouteMapping {},
    LayoutTemplate: class LayoutTemplate {},
    MenuSlotAssignment: class MenuSlotAssignment {},
}));

vi.mock('@ottabase/comments', () => ({
    Comment: class Comment {},
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
        const env = { OBCF_D1: { id: 'binding-1' } } as any;

        ensureDbConnection(env);
        ensureDbConnection(env);

        expect(mockCreateD1Driver).toHaveBeenCalledTimes(1);
        expect(mockRegisterConnection).toHaveBeenCalledTimes(1);
        expect(mockRegisterModels).toHaveBeenCalledTimes(1);
        expect(mockRegisterPolicy).toHaveBeenCalledTimes(1);
        expect(mockInitRLS).toHaveBeenCalledTimes(1);
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
