// ============================================================
// @ottabase/ottaorm - UserRole Model
// ============================================================

import type { DbDriver } from '@ottabase/db/drizzle';
import { and, eq } from 'drizzle-orm';
import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { userRolesTable } from './UserRole.schema';

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
 *   organizationId: "org-id", // 'system' for platform grants
 *   assignedBy: "admin-user-id"
 * });
 *
 * // Get a user's roles in one organization
 * const userRoles = await UserRole.getUserRoles("user-id", "org-id");
 * ```
 */
export class UserRole extends BaseModel {
    static entity = 'user_roles';
    static table = userRolesTable;
    // The REAL key is composite (userId + roleId + organizationId). BaseModel needs one column, but
    // every single-key write would hit ALL of a user's grants, so destroy()/save() are overridden to
    // use the full key and the static single-key mutators below are blocked.
    static primaryKey = 'userId';
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
    // COMPOSITE-KEY PERSISTENCE
    // ============================================================

    /** WHERE clause for exactly this grant (userId + roleId + organizationId). */
    private grantKey() {
        const userId = this.get('userId');
        const roleId = this.get('roleId');
        const organizationId = this.get('organizationId');
        if (!userId || !roleId || !organizationId) {
            throw new Error('UserRole: userId, roleId and organizationId are all required to address a grant');
        }
        return and(
            eq(userRolesTable.userId, userId),
            eq(userRolesTable.roleId, roleId),
            eq(userRolesTable.organizationId, organizationId),
        );
    }

    /** Delete exactly this grant: never the user's grants in other roles/orgs. */
    async destroy(driver?: DbDriver): Promise<boolean> {
        const where = this.grantKey();
        await UserRole.getDriver(driver).getDb().delete(userRolesTable).where(where);
        return true;
    }

    /**
     * Update this grant's mutable fields (appId, assignedBy) by its full key, or insert it when it
     * does not exist yet. The key columns themselves are immutable: revoke + re-grant instead.
     */
    async save(driver?: DbDriver): Promise<this> {
        const updated = await UserRole.getDriver(driver)
            .getDb()
            .update(userRolesTable)
            .set({ appId: this.get('appId') ?? null, assignedBy: this.get('assignedBy') ?? null })
            .where(this.grantKey())
            .returning();
        if (updated.length > 0) {
            this.fill(updated[0]);
            return this;
        }
        const created = await UserRole.create(this.attributes, driver);
        this.fill(created.attributes);
        return this;
    }

    /**
     * Single-key static mutators address rows by `userId` alone, i.e. EVERY grant the user holds.
     * Blocked: use an instance's destroy()/save(), removeRole(), or revokeAllForOrganization().
     */
    static async update(..._args: unknown[]): Promise<never> {
        throw new Error('UserRole.update(id) is blocked: user_roles has a composite key; use instance save()');
    }

    static async updateConstrained(..._args: unknown[]): Promise<never> {
        throw new Error('UserRole.updateConstrained(id) is blocked: user_roles has a composite key');
    }

    static async delete(..._args: unknown[]): Promise<never> {
        throw new Error('UserRole.delete(id) is blocked: user_roles has a composite key; use removeRole()');
    }

    static async deleteConstrained(..._args: unknown[]): Promise<never> {
        throw new Error('UserRole.deleteConstrained(id) is blocked: user_roles has a composite key');
    }

    static async forceDelete(..._args: unknown[]): Promise<never> {
        throw new Error('UserRole.forceDelete(id) is blocked: user_roles has a composite key; use removeRole()');
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /**
     * Remove a role from a user in one organization
     * @param userId User ID
     * @param roleId Role ID
     * @param organizationId Organization ID (REQUIRED, 'system' for platform grants)
     * @param appId Optional app ID (null = remove from all apps)
     */
    static async removeRole(userId: string, roleId: string, organizationId: string, appId?: string | null) {
        if (!organizationId) throw new Error('UserRole.removeRole: organizationId is required');
        const where: Record<string, any> = { userId, roleId, organizationId };
        if (appId !== undefined) {
            where.appId = appId;
        }

        const userRole = await this.first(where);
        if (userRole) {
            await userRole.destroy();
        }
    }

    /**
     * Revoke EVERY org-scoped role grant a user holds in one organization.
     *
     * Membership (`organization_members.role`) and authorization (`user_roles`) are separate
     * sources: provisioning an org owner writes BOTH, but roster demotion/removal only rewrites the
     * membership row. Without this, a demoted or removed member keeps the org-scoped grant that
     * still carries their old permissions (media:*, comments:moderate, audit:read, org:admin, ...),
     * and re-adding a removed user silently reactivates it. Revoking is the fail-safe direction:
     * elevation must be an explicit, separate grant, never an implicit side effect of a roster edit.
     *
     * THROWS if any grant survives. Callers gate a privilege downgrade on this, so a partial
     * delete (some rows removed, one failing mid-loop) must NOT look like success, the caller
     * needs "all grants are gone" to be a guarantee, not a best effort.
     *
     * @returns the number of grants revoked
     * @throws if the revocation could not be completed for every grant
     */
    static async revokeAllForOrganization(userId: string, organizationId: string): Promise<number> {
        const grants = await this.where({ userId, organizationId });
        for (const grant of grants) {
            await grant.destroy();
        }

        // Re-read: confirm none survived (a mid-loop failure, or a row the delete silently missed).
        const remaining = await this.where({ userId, organizationId });
        if (remaining.length > 0) {
            throw new Error(
                `Failed to revoke all org-scoped role grants for user ${userId} in organization ` +
                    `${organizationId}: ${remaining.length} grant(s) still present`,
            );
        }

        return grants.length;
    }

    /**
     * Check if user has role in one organization
     * @param userId User ID
     * @param roleId Role ID
     * @param organizationId Organization ID (REQUIRED, 'system' for platform grants)
     * @param appId Optional app ID (if not provided, checks across all apps)
     */
    static async hasRole(
        userId: string,
        roleId: string,
        organizationId: string,
        appId?: string | null,
    ): Promise<boolean> {
        if (!organizationId) throw new Error('UserRole.hasRole: organizationId is required');
        const where: Record<string, any> = { userId, roleId, organizationId };
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
