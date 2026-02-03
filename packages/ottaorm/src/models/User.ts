// ============================================================
// @ottabase/ottaorm - User Model
// ============================================================

import { BaseModel, IModelConstructorParams, ModelFields, type PackageType } from '../base/BaseModel';
import { usersTable, type NewUserType, type UserType } from './User.schema';

export { usersTable, type NewUserType, type UserType } from './User.schema';

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

    // UI/Forms metadata
    static displayName = 'User';
    static displayNamePlural = 'Users';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
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

    protected static validationRules = {
        name: {
            rules: 'required',
            fieldName: 'Name',
            messages: {
                required: 'Name is required',
            },
        },
        email: {
            rules: 'required|email|unique:users,email',
            fieldName: 'Email',
            messages: {
                required: 'Email is required',
                email: 'Must be a valid email',
                unique: 'Email already exists',
            },
        },
    };

    constructor(data: { [key: string]: any }) {
        const params: IModelConstructorParams = { entity: User.entity, data };
        super(params);
    }

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
     * Get user's roles (ManyToMany through UserRole)
     * Optimized with optional caching support and organization scoping
     */
    async roles(options?: {
        select?: string[];
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
        cache?: any;
        organizationId?: string;
    }) {
        const userId = this.get('id') as string;
        const organizationId = options?.organizationId;
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

        // Optimized query: Get UserRole records for this user (with org filter if provided)
        const whereClause: any = { userId };
        if (organizationId) {
            whereClause.organizationId = organizationId;
        }
        const userRoles = await UserRole.where(whereClause);
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
     * Assign a role to the user
     * Automatically invalidates cache if provided
     */
    async assignRole(
        roleId: string,
        assignedBy?: string,
        organizationId?: string,
        options?: { cache?: any },
    ): Promise<void> {
        const { UserRole } = await import('./UserRole');
        const userId = this.get('id') as string;

        // Check if already assigned
        const existing = await UserRole.first({
            userId,
            roleId,
            ...(organizationId ? { organizationId } : {}),
        });

        if (!existing) {
            await UserRole.create({
                userId,
                roleId,
                assignedBy,
                organizationId,
            });

            // Invalidate cache
            if (options?.cache) {
                try {
                    await options.cache.invalidateUser(userId);
                } catch (error) {
                    // Ignore cache errors
                }
            }
        }
    }

    /**
     * Remove a role from the user
     * Automatically invalidates cache if provided
     */
    async removeRole(roleId: string, organizationId?: string, options?: { cache?: any }): Promise<void> {
        const { UserRole } = await import('./UserRole');
        const userId = this.get('id') as string;

        await UserRole.removeRole(userId, roleId, organizationId);

        // Invalidate cache
        if (options?.cache) {
            try {
                await options.cache.invalidateUser(userId);
            } catch (error) {
                // Ignore cache errors
            }
        }
    }

    /**
     * Check if user has a specific role
     */
    async hasRole(roleName: string, organizationId?: string): Promise<boolean> {
        const { Role } = await import('./Role');
        const role = await Role.findByName(roleName);
        if (!role) return false;

        const { UserRole } = await import('./UserRole');
        return UserRole.hasRole(this.get('id'), role.get('id'), organizationId);
    }

    /**
     * Check if user has any of the specified roles
     */
    async hasAnyRole(roleNames: string[], organizationId?: string): Promise<boolean> {
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
    async hasAllRoles(roleNames: string[], organizationId?: string): Promise<boolean> {
        for (const roleName of roleNames) {
            if (!(await this.hasRole(roleName, organizationId))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get all permissions for the user (from all roles)
     * Optimized with optional caching support and organization scoping
     */
    async getPermissions(options?: { cache?: any; organizationId?: string }): Promise<string[]> {
        const userId = this.get('id') as string;
        const organizationId = options?.organizationId;

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
    async hasPermission(permission: string, options?: { cache?: any; organizationId?: string }): Promise<boolean> {
        const permissions = await this.getPermissions(options);

        // Check for exact match first
        if (permissions.includes(permission)) {
            return true;
        }

        // Check for wildcard matches
        const [reqResource, reqAction] = permission.split(':');
        for (const perm of permissions) {
            const [permResource, permAction] = perm.split(':');

            // *:* grants all permissions
            if (permResource === '*' && permAction === '*') {
                return true;
            }

            // Check resource and action with wildcards
            const resourceMatches = permResource === '*' || permResource === reqResource;
            const actionMatches = permAction === '*' || permAction === reqAction;

            if (resourceMatches && actionMatches) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if user has any of the specified permissions
     */
    async hasAnyPermission(permissions: string[]): Promise<boolean> {
        for (const permission of permissions) {
            if (await this.hasPermission(permission)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if user has all of the specified permissions
     */
    async hasAllPermissions(permissions: string[]): Promise<boolean> {
        for (const permission of permissions) {
            if (!(await this.hasPermission(permission))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if user is an admin
     */
    async isAdmin(): Promise<boolean> {
        return this.hasRole('admin');
    }
}
