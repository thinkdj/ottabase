// ============================================================
// @ottabase/ottaorm - Role Model
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { rolesTable } from './Role.schema';

export { rolesTable, type NewRoleType, type RoleType } from './Role.schema';

/**
 * Role model for RBAC
 *
 * @example
 * ```typescript
 * import { Role } from "@ottabase/ottaorm/models";
 *
 * // Find role
 * const adminRole = await Role.first({ name: "admin" });
 *
 * // Create custom role
 * const role = await Role.create({
 *   name: "moderator",
 *   description: "Can moderate content",
 *   permissions: JSON.stringify(["posts:read", "posts:update", "comments:delete"])
 * });
 *
 * // Get role permissions
 * const permissions = role.getPermissions();
 * ```
 */
export class Role extends BaseModel {
    static entity = 'roles';
    static table = rolesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    // UI/Forms metadata
    static displayName = 'Role';
    static displayNamePlural = 'Roles';
    static defaultSort = 'name';
    static defaultSortDirection = 'asc' as const;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
        isSystem: 'boolean' as const,
        permissions: 'json' as const,
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
            unique: true,
            uiConfig: {
                label: 'Name',
                description: 'Role name (e.g., admin, editor, viewer)',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required|unique:roles,name',
                messages: {
                    required: 'Role name is required',
                    unique: 'Role name already exists',
                },
            },
        },
        description: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Description',
                description: 'What this role can do',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: true,
            },
        },
        permissions: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Permissions',
                description: 'Array of permission names',
            },
            formConfig: {
                visible: true,
                fieldType: 'json',
            },
            tableConfig: {
                visible: false,
            },
        },
        isSystem: {
            type: 'boolean',
            editable: false,
            uiConfig: {
                label: 'System Role',
                description: 'System roles cannot be deleted',
            },
            formConfig: {
                visible: true,
                fieldType: 'boolean',
            },
            tableConfig: {
                visible: true,
            },
        },
    };

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /**
     * Get permissions as array
     */
    getPermissions(): string[] {
        const permissions = this.get('permissions');
        if (typeof permissions === 'string') {
            try {
                return JSON.parse(permissions);
            } catch {
                return [];
            }
        }
        return Array.isArray(permissions) ? permissions : [];
    }

    /**
     * Check if role has a specific permission
     */
    hasPermission(permission: string): boolean {
        const permissions = this.getPermissions();
        return permissions.includes(permission);
    }

    /**
     * Add permission to role
     */
    async addPermission(permission: string): Promise<void> {
        const permissions = this.getPermissions();
        if (!permissions.includes(permission)) {
            permissions.push(permission);
            this.set('permissions', JSON.stringify(permissions));
            await this.save();
        }
    }

    /**
     * Remove permission from role
     */
    async removePermission(permission: string): Promise<void> {
        const permissions = this.getPermissions();
        const filtered = permissions.filter((p) => p !== permission);
        this.set('permissions', JSON.stringify(filtered));
        await this.save();
    }

    /**
     * Get users with this role
     */
    async users(options?: { select?: string[]; orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        const { User } = await import('./User');
        const { UserRole } = await import('./UserRole');

        // Get user IDs through junction table
        const userRoles = await UserRole.where({ roleId: this.get('id') });
        const userIds = userRoles.map((ur) => ur.get('userId'));

        if (userIds.length === 0) return [];

        // Get users
        return User.whereIn('id', userIds);
    }

    /**
     * Find role by name
     */
    static async findByName(name: string) {
        return this.first({ name });
    }

    /**
     * Get or create default roles
     */
    static async ensureDefaultRoles() {
        const defaultRoles = [
            {
                name: 'admin',
                description: 'Full system access',
                permissions: JSON.stringify(['*:*']),
                isSystem: true,
            },
            {
                name: 'editor',
                description: 'Can create and edit content',
                permissions: JSON.stringify(['*:read', '*:create', '*:update']),
                isSystem: true,
            },
            {
                name: 'viewer',
                description: 'Read-only access',
                permissions: JSON.stringify(['*:read']),
                isSystem: true,
            },
            {
                name: 'member',
                description: 'Default member access',
                permissions: JSON.stringify(['*:read']),
                isSystem: true,
            },
        ];

        const created = [];
        for (const roleData of defaultRoles) {
            const existing = await this.findByName(roleData.name);
            if (!existing) {
                created.push(await this.create(roleData));
            }
        }

        return created;
    }
}
