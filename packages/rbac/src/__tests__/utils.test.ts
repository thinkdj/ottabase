import { describe, expect, it, vi } from 'vitest';
import type { RBACContext } from '../types';
import {
    createRBACContext,
    evaluatePermission,
    evaluateRole,
    formatPermission,
    getAllowedActions,
    hasPermission,
    hasRole,
    isAdmin,
    parsePermission,
} from '../utils';

describe('formatPermission', () => {
    it('returns resource:action string', () => {
        expect(formatPermission('posts', 'read')).toBe('posts:read');
        expect(formatPermission('users', 'write')).toBe('users:write');
    });
});

describe('parsePermission', () => {
    it('parses valid permission string', () => {
        expect(parsePermission('posts:read')).toEqual({ resource: 'posts', action: 'read' });
        expect(parsePermission('users:write')).toEqual({ resource: 'users', action: 'write' });
    });

    it('returns null for invalid format', () => {
        expect(parsePermission('posts')).toBeNull();
        expect(parsePermission('posts:read:extra')).toBeNull();
        expect(parsePermission('posts:')).toBeNull();
        expect(parsePermission(':read')).toBeNull();
        expect(parsePermission('')).toBeNull();
    });
});

describe('hasPermission', () => {
    it('returns allowed: false when not authenticated', () => {
        const ctx: RBACContext = {
            user: null,
            roles: [],
            permissions: [],
            isAuthenticated: false,
        };
        expect(hasPermission(ctx, 'posts:read')).toBe(false);
        expect(evaluatePermission(ctx, 'posts:read').reason).toMatch(/not authenticated/);
    });

    it('returns allowed: true when user has exact permission', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: [],
            permissions: ['posts:read', 'posts:write'],
            isAuthenticated: true,
        };
        expect(hasPermission(ctx, 'posts:read')).toBe(true);
        expect(hasPermission(ctx, 'posts:write')).toBe(true);
    });

    it('returns allowed: false when user lacks permission', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: [],
            permissions: ['posts:read'],
            isAuthenticated: true,
        };
        const result = evaluatePermission(ctx, 'posts:delete');
        expect(result.allowed).toBe(false);
        expect(result.missingPermissions).toEqual(['posts:delete']);
    });

    it('allows with wildcard resource (e.g. *:read)', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: [],
            permissions: ['*:read'],
            isAuthenticated: true,
        };
        expect(hasPermission(ctx, 'posts:read')).toBe(true);
        expect(hasPermission(ctx, 'users:read')).toBe(true);
    });

    it('allows with wildcard action (e.g. posts:*)', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: [],
            permissions: ['posts:*'],
            isAuthenticated: true,
        };
        expect(hasPermission(ctx, 'posts:read')).toBe(true);
        expect(hasPermission(ctx, 'posts:write')).toBe(true);
    });

    it('allows with *:*', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: [],
            permissions: ['*:*'],
            isAuthenticated: true,
        };
        expect(hasPermission(ctx, 'any:action')).toBe(true);
    });

    it('requireAll: requires all permissions when array passed', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: [],
            permissions: ['posts:read', 'posts:write'],
            isAuthenticated: true,
        };
        expect(hasPermission(ctx, ['posts:read', 'posts:write'], { requireAll: true })).toBe(true);
        expect(hasPermission(ctx, ['posts:read', 'posts:delete'], { requireAll: true })).toBe(false);
    });
});

describe('hasRole', () => {
    it('returns allowed: false when not authenticated', () => {
        const ctx: RBACContext = {
            user: null,
            roles: [],
            permissions: [],
            isAuthenticated: false,
        };
        expect(hasRole(ctx, 'admin')).toBe(false);
    });

    it('returns allowed: true when user has role', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: ['admin', 'member'],
            permissions: [],
            isAuthenticated: true,
        };
        expect(hasRole(ctx, 'admin')).toBe(true);
        expect(hasRole(ctx, 'member')).toBe(true);
    });

    it('returns allowed: true when user has one of roles (array, requireAll false)', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: ['member'],
            permissions: [],
            isAuthenticated: true,
        };
        expect(hasRole(ctx, ['admin', 'member'])).toBe(true);
    });

    it('returns allowed: false when user lacks role', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: ['member'],
            permissions: [],
            isAuthenticated: true,
        };
        const result = evaluateRole(ctx, 'admin');
        expect(result.allowed).toBe(false);
        expect(result.missingRoles).toEqual(['admin']);
    });

    it('requireAll: requires all roles', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: ['admin', 'member'],
            permissions: [],
            isAuthenticated: true,
        };
        expect(hasRole(ctx, ['admin', 'member'], { requireAll: true })).toBe(true);
        expect(hasRole(ctx, ['admin', 'owner'], { requireAll: true })).toBe(false);
    });
});

describe('isAdmin (permission-based, NOT role-name based)', () => {
    it('returns true for org:admin permission', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: ['owner'],
            permissions: ['org:admin', '*:read'],
            isAuthenticated: true,
        };
        expect(isAdmin(ctx)).toBe(true);
    });

    it('returns true for platform:admin permission', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: [],
            permissions: ['platform:admin'],
            isAuthenticated: true,
        };
        expect(isAdmin(ctx)).toBe(true);
    });

    it('returns true when user has *:* permission', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: [],
            permissions: ['*:*'],
            isAuthenticated: true,
        };
        expect(isAdmin(ctx)).toBe(true);
    });

    it('returns false for a role merely NAMED admin/owner with no admin permission', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: ['admin', 'owner'],
            permissions: ['posts:read'],
            isAuthenticated: true,
        };
        expect(isAdmin(ctx)).toBe(false);
    });
});

describe('getAllowedActions', () => {
    it('returns actions for resource from permissions', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: [],
            permissions: ['posts:read', 'posts:write'],
            isAuthenticated: true,
        };
        const actions = getAllowedActions(ctx, 'posts');
        expect(actions).toContain('read');
        expect(actions).toContain('write');
    });

    it('expands * to create, read, update, delete, manage', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: [],
            permissions: ['posts:*'],
            isAuthenticated: true,
        };
        const actions = getAllowedActions(ctx, 'posts');
        expect(actions).toContain('create');
        expect(actions).toContain('read');
        expect(actions).toContain('update');
        expect(actions).toContain('delete');
        expect(actions).toContain('manage');
    });

    it('returns empty array for resource with no permissions', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: [],
            permissions: ['users:read'],
            isAuthenticated: true,
        };
        expect(getAllowedActions(ctx, 'posts')).toEqual([]);
    });

    it('ignores malformed permissions when deriving allowed actions', () => {
        const ctx: RBACContext = {
            user: {} as any,
            roles: [],
            permissions: ['posts:read:extra', 'posts:'],
            isAuthenticated: true,
        };

        expect(getAllowedActions(ctx, 'posts')).toEqual([]);
    });
});

describe('createRBACContext', () => {
    it('returns unauthenticated context when user is null', async () => {
        const ctx = await createRBACContext(null);
        expect(ctx.isAuthenticated).toBe(false);
        expect(ctx.roles).toEqual([]);
        expect(ctx.permissions).toEqual([]);
        expect(ctx.user).toBeNull();
    });

    it('accepts organizationId in options for unauthenticated', async () => {
        const ctx = await createRBACContext(null, undefined, { organizationId: 'org-1' });
        expect(ctx.organizationId).toBe('org-1');
    });

    it('when user provided with mocked roles/permissions, returns context', async () => {
        const mockRoles = [{ get: (k: string) => (k === 'name' ? 'member' : null) }];
        const mockUser = {
            get: vi.fn((key: string) => (key === 'id' ? 'user-1' : null)),
            roles: vi.fn().mockResolvedValue(mockRoles),
            getPermissions: vi.fn().mockResolvedValue(['posts:read']),
        } as any;
        const ctx = await createRBACContext(mockUser, undefined, { organizationId: 'org-1' });
        expect(ctx.isAuthenticated).toBe(true);
        expect(ctx.roles).toEqual(['member']);
        expect(ctx.permissions).toEqual(['posts:read']);
        expect(ctx.user).toBe(mockUser);
        expect(mockUser.roles).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1' }));
    });

    it('grants NOTHING to an authenticated user when no organization is given (no cross-org merge)', async () => {
        const mockUser = {
            get: vi.fn((key: string) => (key === 'id' ? 'user-1' : null)),
            roles: vi.fn(),
            getPermissions: vi.fn(),
        } as any;
        const ctx = await createRBACContext(mockUser);
        expect(ctx.isAuthenticated).toBe(true);
        expect(ctx.roles).toEqual([]);
        expect(ctx.permissions).toEqual([]);
        expect(mockUser.roles).not.toHaveBeenCalled();
        expect(mockUser.getPermissions).not.toHaveBeenCalled();
    });
});

describe('hasPermission / hasRole return booleans', () => {
    // A result object is always truthy, so `if (!hasPermission(...))` would never deny.
    it('denies through a negated check', () => {
        const ctx: RBACContext = { user: { id: 'u1' } as any, roles: [], permissions: [], isAuthenticated: true };
        expect(!hasPermission(ctx, 'posts:delete')).toBe(true);
        expect(!hasRole(ctx, 'admin')).toBe(true);
    });
});
