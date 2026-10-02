// ============================================================
// @ottabase/ottaorm - User Model
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import { usersTable } from './User.schema';

export { usersTable, type NewUserType, type UserType } from './User.schema';

/**
 * Role grants are org-scoped (`user_roles.organization_id` is NOT NULL; platform grants use the
 * 'system' org). An omitted org must throw rather than silently widen a query to every tenant.
 */
function requireOrganizationId(organizationId: string | undefined | null, method: string): string {
    if (!organizationId) {
        throw new Error(`${method}: organizationId is required (use 'system' for platform-scoped grants)`);
    }
    return organizationId;
}

/** Bump the org's RBAC cache version after a grant change. Cache failures never fail the write. */
async function invalidateOrgCache(cache: any, organizationId: string): Promise<void> {
    if (!cache) return;
    try {
        await cache.invalidateOrganization(organizationId);
    } catch {
        // Cache is an optimization only; its version expires naturally.
    }
}

/**
 * User model - Simple fat model example
 *
 * @example
 * ```typescript
 * import { User } from "@ottabase/ottaorm/models";
 *
 * // Find user
 * const user = await User.first({ email: "user@example.com" });
 *
 * // Create user
 * const newUser = await User.create({
 *   name: "John Doe",
 *   email: "john@example.com"
 * });
 *
 * // Get user's accounts
 * const accounts = await user.accounts();
 * ```
 */
export class User extends BaseModel {
    static entity = 'users';
    static table = usersTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';
    static hidden = ['passwordHash'];

    // UI/Forms metadata
    static displayName = 'User';
    static displayNamePlural = 'Users';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
        emailVerified: 'date' as const,
    };

    static writable = {
        create: ['name', 'email', 'image', 'referralUsername', 'timezone'],
        update: ['name', 'image', 'timezone'],
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
            },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Name',
                description: 'User name',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required',
                messages: {
                    required: 'Name is required',
                },
            },
        },
        email: {
            type: 'string',
            editable: true,
            searchable: true,
            unique: true,
            uiConfig: {
                label: 'Email',
                description: 'User email',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required|email|unique:users,email',
                messages: {
                    required: 'Email is required',
                    email: 'Must be a valid email',
                    unique: 'Email already exists',
                },
            },
        },
        emailVerified: {
            type: 'datetime',
            editable: false,
            uiConfig: {
                label: 'Email Verified',
                description: 'Timestamp when the email was verified',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: false,
            },
        },
        image: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Profile Image',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: false,
            },
        },
        passwordHash: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Password Hash',
                description: 'Hashed password (never exposed in UI)',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: false,
            },
        },
        referralUsername: {
            type: 'string',
            editable: true,
            unique: true,
            uiConfig: {
                label: 'Referral Username',
                description: 'Your unique referral identifier (3-20 chars, letters/numbers/underscore)',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
            },
        },
        referredById: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Referred By',
                description: 'ID of the user who referred this user',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: false,
            },
        },
    };

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    /**
     * Get authentication accounts for this user (HasMany Account)
     */
    async accounts(options?: { select?: string[]; orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        // Dynamic import
        const { Account } = await import('./Account');

        return this.hasMany(Account, 'userId', options);
    }

    /**
     * Get user's roles IN ONE ORGANIZATION (ManyToMany through UserRole).
     * `organizationId` is REQUIRED: grants are org-scoped, and an org-less read would merge the
     * user's roles from every tenant into one set. Pass `SYSTEM_ORGANIZATION_ID` ('system') for
     * platform-level grants.
     */
    async roles(options: {
        select?: string[];
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
        cache?: any;
        organizationId: string;
    }) {
        const userId = this.get('id') as string;
        const organizationId = requireOrganizationId(options?.organizationId, 'User.roles');
        const { UserRole } = await import('./UserRole');
        const { Role } = await import('./Role');

        // Try cache first if provided
        if (options?.cache) {
            try {
                const cachedRoleNames = await options.cache.getUserRoles(userId, organizationId);
                if (cachedRoleNames && cachedRoleNames.length > 0) {
                    // Get Role objects by names from cache
                    const roles = [];
                    for (const roleName of cachedRoleNames) {
                        const role = await Role.findByName(roleName);
                        if (role) roles.push(role);
                    }
                    return roles;
                }
            } catch (error) {
                // Ignore cache errors, fallback to DB
            }
        }

        const userRoles = await UserRole.where({ userId, organizationId });
        const roleIds = userRoles.map((ur) => ur.get('roleId'));

        if (roleIds.length === 0) {
            // Cache empty result
            if (options?.cache) {
                try {
                    await options.cache.setUserRoles(userId, [], organizationId);
                } catch (error) {
                    // Ignore cache errors
                }
            }
            return [];
        }

        // Single query to get all roles
        const roles = await Role.whereIn('id', roleIds);

        // Cache the role names
        if (options?.cache && roles.length > 0) {
            try {
                const roleNames = roles.map((r: InstanceType<typeof Role>) => r.get('name') as string);
                await options.cache.setUserRoles(userId, roleNames, organizationId);
            } catch (error) {
                // Ignore cache errors
            }
        }

        return roles;
    }

    /**
     * Get user's audit logs (HasMany AuditLog)
     */
    async auditLogs(options?: { select?: string[]; orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        const { AuditLog } = await import('./AuditLog');
        return this.hasMany(AuditLog, 'userId', options);
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /**
     * Find user by email
     */
    static async findByEmail(email: string) {
        return this.first({ email });
    }

    /**
     * Get user's display name
     */
    getDisplayName(): string {
        return this.get('name') || this.get('email');
    }

    /**
     * Get the user who referred this user (BelongsTo User)
     */
    async referrer() {
        const referredById = this.get('referredById');
        if (!referredById) return null;

        return User.find(referredById);
    }

    /**
     * Get users referred by this user (HasMany User)
     */
    async referrals(options?: {
        select?: string[];
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
        limit?: number;
    }) {
        return this.hasMany(User, 'referredById', options);
    }

    /**
     * Find user by referral username
     */
    static async findByReferralUsername(username: string) {
        return this.first({ referralUsername: username });
    }

    // ============================================================
    // RBAC METHODS
    // ============================================================

    /**
     * Assign a role to the user in one organization (idempotent on the full grant key).
     * `organizationId` is REQUIRED — use `SYSTEM_ORGANIZATION_ID` ('system') for platform grants.
     * Bumps the org's RBAC cache version when a cache is provided.
     */
    async assignRole(
        roleId: string,
        assignedBy: string | undefined,
        organizationId: string,
        options?: { cache?: any },
    ): Promise<void> {
        requireOrganizationId(organizationId, 'User.assignRole');
        const { UserRole } = await import('./UserRole');
        const userId = this.get('id') as string;

        // Full composite key: a grant of the same role in ANOTHER org must not count as "assigned".
        const existing = await UserRole.first({ userId, roleId, organizationId });

        if (!existing) {
            await UserRole.create({
                userId,
                roleId,
                assignedBy,
                organizationId,
            });
            await invalidateOrgCache(options?.cache, organizationId);
        }
    }

    /**
     * Remove a role from the user in one organization. `organizationId` is REQUIRED.
     * Bumps the org's RBAC cache version when a cache is provided.
     */
    async removeRole(roleId: string, organizationId: string, options?: { cache?: any }): Promise<void> {
        const { UserRole } = await import('./UserRole');
        const userId = this.get('id') as string;

        await UserRole.removeRole(userId, roleId, organizationId);
        await invalidateOrgCache(options?.cache, organizationId);
    }

    /**
     * Check if user has a specific role in one organization. `organizationId` is REQUIRED.
     */
    async hasRole(roleName: string, organizationId: string): Promise<boolean> {
        requireOrganizationId(organizationId, 'User.hasRole');
        const { Role } = await import('./Role');
        const role = await Role.findByName(roleName);
        if (!role) return false;

        const { UserRole } = await import('./UserRole');
        return UserRole.hasRole(this.get('id'), role.get('id'), organizationId);
    }

    /**
     * Check if user has any of the specified roles
     */
    async hasAnyRole(roleNames: string[], organizationId: string): Promise<boolean> {
        for (const roleName of roleNames) {
            if (await this.hasRole(roleName, organizationId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if user has all of the specified roles
     */
    async hasAllRoles(roleNames: string[], organizationId: string): Promise<boolean> {
        for (const roleName of roleNames) {
            if (!(await this.hasRole(roleName, organizationId))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get all permissions the user holds in one organization (from its roles there).
     * `organizationId` is REQUIRED — see `roles()`.
     */
    async getPermissions(options: { cache?: any; organizationId: string }): Promise<string[]> {
        const userId = this.get('id') as string;
        const organizationId = requireOrganizationId(options?.organizationId, 'User.getPermissions');

        // Try cache first if provided
        if (options?.cache) {
            try {
                const cached = await options.cache.getUserPermissions(userId, organizationId);
                if (cached) return cached;
            } catch (error) {
                // Ignore cache errors, fallback to DB
            }
        }

        // Get roles and collect permissions (optimized single query per role type, with org filter)
        const roles = await this.roles({ cache: options?.cache, organizationId });
        const permissions = new Set<string>();

        for (const role of roles) {
            const rolePermissions = role.getPermissions();
            rolePermissions.forEach((p: string) => permissions.add(p));
        }

        const permissionsArray = Array.from(permissions);

        // Cache the result if cache is provided
        if (options?.cache) {
            try {
                await options.cache.setUserPermissions(userId, permissionsArray, organizationId);
            } catch (error) {
                // Ignore cache errors
            }
        }

        return permissionsArray;
    }

    /**
     * Check if user has a specific permission
     * Supports wildcard matching: users:* matches users:read, users:create, etc.
     * Optimized with optional caching support and organization scoping
     */
    async hasPermission(permission: string, options: { cache?: any; organizationId: string }): Promise<boolean> {
        const permissions = await this.getPermissions(options);
        return hasGrantedPermission(permissions, permission);
    }

    /**
     * Check if user has any of the specified permissions in one organization
     */
    async hasAnyPermission(permissions: string[], options: { cache?: any; organizationId: string }): Promise<boolean> {
        for (const permission of permissions) {
            if (await this.hasPermission(permission, options)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if user has all of the specified permissions in one organization
     */
    async hasAllPermissions(permissions: string[], options: { cache?: any; organizationId: string }): Promise<boolean> {
        for (const permission of permissions) {
            if (!(await this.hasPermission(permission, options))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if the user is an admin WITHIN a specific organization — PERMISSION-based, never
     * role-NAME based. True when their grants in `organizationId` carry `org:admin` or
     * `platform:admin` (or the `*:*` wildcard). Pass the system org id to test platform-admin.
     *
     * `organizationId` is REQUIRED by design. There is deliberately no org-less "admin somewhere"
     * mode: since every self-registered user is `org:admin` of their own personal org, an aggregate
     * check returns true for nearly everyone — reproducing the role-name-trust bug in a new form.
     * For the platform-vs-org boundary on a request, prefer the guards in @ottabase/rbac
     * (assertAdmin / the session `platformAdmin` flag), which read SYSTEM-scoped grants.
     */
    async isAdmin(organizationId: string, options?: { cache?: any }): Promise<boolean> {
        const scoped = { ...options, organizationId };
        const [isPlatform, isOrg] = await Promise.all([
            this.hasPermission('platform:admin', scoped),
            this.hasPermission('org:admin', scoped),
        ]);
        return isPlatform || isOrg;
    }
}
