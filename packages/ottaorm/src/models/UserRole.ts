// ============================================================
// @ottabase/ottaorm - UserRole Model
// ============================================================

import { BaseModel, IModelConstructorParams, ModelFields, type PackageType } from '../base/BaseModel';
import { userRolesTable, type NewUserRoleType, type UserRoleType } from './UserRole.schema';

export { userRolesTable, type NewUserRoleType, type UserRoleType } from './UserRole.schema';

/**
 * UserRole junction model for many-to-many relationship
 *
 * @example
 * ```typescript
 * import { UserRole } from "@ottabase/ottaorm/models";
 *
 * // Assign role to user
 * await UserRole.create({
 *   userId: "user-id",
 *   roleId: "role-id",
 *   assignedBy: "admin-user-id"
 * });
 *
 * // Get all roles for a user
 * const userRoles = await UserRole.where({ userId: "user-id" });
 * ```
 */
export class UserRole extends BaseModel {
    static entity = 'user_roles';
    static table = userRolesTable;
    static primaryKey = 'userId'; // Composite key, but we need to specify one
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    // UI/Forms metadata
    static displayName = 'User Role';
    static displayNamePlural = 'User Roles';
    static defaultSort = 'assignedAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        assignedAt: 'date' as const,
    };

    protected static fields: ModelFields = {
        userId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'User ID',
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
                    required: 'User ID is required',
                },
            },
        },
        roleId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Role ID',
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
                    required: 'Role ID is required',
                },
            },
        },
        organizationId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Organization ID',
                description: 'Organization/tenant scoping (REQUIRED)',
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
                    required: 'Organization ID is required',
                },
            },
        },
        appId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'App ID',
                description: 'App scoping (optional - null means all apps)',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
            },
        },
        assignedAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Assigned At',
            },
            tableConfig: {
                visible: true,
            },
        },
        assignedBy: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Assigned By',
                description: 'User ID of the person who assigned this role',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
            },
        },
    };

    constructor(data: { [key: string]: any }) {
        const params: IModelConstructorParams = { entity: UserRole.entity, data };
        super(params);
    }

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    /**
     * Get the user (BelongsTo User)
     */
    async user() {
        const { User } = await import('./User');
        return User.find(this.get('userId'));
    }

    /**
     * Get the role (BelongsTo Role)
     */
    async role() {
        const { Role } = await import('./Role');
        return Role.find(this.get('roleId'));
    }

    /**
     * Get the user who assigned this role (BelongsTo User)
     */
    async assigner() {
        const assignedBy = this.get('assignedBy');
        if (!assignedBy) return null;

        const { User } = await import('./User');
        return User.find(assignedBy);
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /**
     * Remove a role from a user
     * @param userId User ID
     * @param roleId Role ID
     * @param organizationId Organization ID (REQUIRED for multi-tenant security)
     * @param appId Optional app ID (null = remove from all apps)
     */
    static async removeRole(userId: string, roleId: string, organizationId?: string | null, appId?: string | null) {
        const where: Record<string, any> = { userId, roleId };
        if (organizationId !== undefined && organizationId !== null) {
            where.organizationId = organizationId;
        }
        if (appId !== undefined) {
            where.appId = appId;
        }

        const userRole = await this.first(where);
        if (userRole) {
            await userRole.destroy();
        }
    }

    /**
     * Check if user has role
     * @param userId User ID
     * @param roleId Role ID
     * @param organizationId Organization ID (REQUIRED for multi-tenant security)
     * @param appId Optional app ID (if not provided, checks across all apps)
     */
    static async hasRole(
        userId: string,
        roleId: string,
        organizationId?: string | null,
        appId?: string | null,
    ): Promise<boolean> {
        const where: Record<string, any> = { userId, roleId };
        if (organizationId !== undefined && organizationId !== null) {
            where.organizationId = organizationId;
        }
        if (appId !== undefined) {
            where.appId = appId;
        }

        const userRole = await this.first(where);
        return !!userRole;
    }

    /**
     * Get all roles for a user in an organization
     * @param userId User ID
     * @param organizationId Organization ID (REQUIRED for multi-tenant security)
     * @param appId Optional app ID filter (if not provided, returns roles from all apps)
     */
    static async getUserRoles(userId: string, organizationId: string, appId?: string | null) {
        const where: Record<string, any> = { userId, organizationId };
        if (appId !== undefined) {
            where.appId = appId;
        }

        return this.where(where);
    }

    /**
     * Get all users with a specific role in an organization
     * @param roleId Role ID
     * @param organizationId Organization ID (REQUIRED for multi-tenant security)
     * @param appId Optional app ID filter
     */
    static async getUsersWithRole(roleId: string, organizationId: string, appId?: string | null) {
        const where: Record<string, any> = { roleId, organizationId };
        if (appId !== undefined) {
            where.appId = appId;
        }

        return this.where(where);
    }
}
