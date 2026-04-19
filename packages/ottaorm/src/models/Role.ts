// ============================================================
// @ottabase/ottaorm - Role Model
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { DEFAULT_ROLE_NAMES, DEFAULT_ROLES, type DefaultRoleName } from './DefaultRoles';
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
     * Seed the four OOB roles (owner, admin, member, viewer) from DEFAULT_ROLES.
     *
     * Idempotent and cheap: short-circuits when all four already exist. If a
     * role exists but has drifted (permissions or description changed in the
     * framework), it is reconciled in-place so upgrades are hands-free.
     *
     * Returns a map of {name: Role} for every default role. Safe to call from
     * hot paths (e.g. signin) — the short-circuit avoids row writes.
     */
    static async ensureDefaults(): Promise<Record<DefaultRoleName, Role>> {
        const existing = (await Role.whereIn('name', DEFAULT_ROLE_NAMES as unknown as string[])) as Role[];
        const byName = new Map<string, Role>(existing.map((role) => [role.get('name') as string, role]));

        for (const name of DEFAULT_ROLE_NAMES) {
            const seed = DEFAULT_ROLES[name];
            const serialized = JSON.stringify(seed.permissions);
            const current = byName.get(name);

            if (!current) {
                const created = (await this.create({
                    name: seed.name,
                    description: seed.description,
                    permissions: serialized,
                    isSystem: seed.isSystem,
                })) as Role;
                byName.set(name, created);
                continue;
            }

            const currentPerms = JSON.stringify(current.getPermissions());
            const currentDesc = (current.get('description') as string | null) ?? '';
            if (currentPerms !== serialized || currentDesc !== seed.description) {
                current.set('permissions', serialized);
                current.set('description', seed.description);
                current.set('isSystem', seed.isSystem);
                await current.save();
            }
        }

        return {
            owner: byName.get('owner')!,
            admin: byName.get('admin')!,
            member: byName.get('member')!,
            viewer: byName.get('viewer')!,
        };
    }

    /**
     * @deprecated Use {@link Role.ensureDefaults} — retained as a thin alias
     * only so the bootstrap wizard flow doesn't break during rollout. New code
     * should call `ensureDefaults()` which returns a typed role map.
     */
    static async ensureDefaultRoles() {
        const map = await this.ensureDefaults();
        return Object.values(map);
    }
}
