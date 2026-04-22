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
 * // Find a system role
 * const adminRole = await Role.findByName("admin");
 *
 * // Create a custom role scoped to an organization
 * const role = await Role.create({
 *   name: "moderator",
 *   organizationId: "org-123",
 *   description: "Can moderate content",
 *   permissions: JSON.stringify(["posts:read", "posts:update", "comments:delete"])
 * });
 *
 * // List all roles visible to an organization (system + org-custom)
 * const roles = await Role.findByOrg("org-123");
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
            uiConfig: {
                label: 'Name',
                description: 'Role name (e.g., editor, reviewer). Must be unique within the organization.',
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
                    required: 'Role name is required',
                },
            },
        },
        organizationId: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Organization',
                description: 'Null for system roles; set to the owning org for custom roles.',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: false,
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
                description: 'Array of permission strings',
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
                description: 'System roles cannot be modified or deleted',
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

        const userRoles = await UserRole.where({ roleId: this.get('id') });
        const userIds = userRoles.map((ur) => ur.get('userId'));

        if (userIds.length === 0) return [];

        return User.whereIn('id', userIds);
    }

    // ============================================================
    // ORG-SCOPED LOOKUP
    // ============================================================

    /**
     * Find a role by name, with optional org scoping.
     *
     * Lookup order:
     *  1. If `organizationId` is provided, check for an org-specific role first.
     *  2. Fall back to a system role (isSystem=true) with that name.
     *
     * This means org-custom roles can shadow system role names within their own
     * tenant while system roles remain the global fallback.
     */
    static async findByName(name: string, organizationId?: string | null): Promise<Role | null> {
        if (organizationId) {
            const orgRole = (await this.first({ name, organizationId })) as Role | null;
            if (orgRole) return orgRole;
        }
        // System roles are identified by isSystem flag; find one matching the name.
        const systemRoles = (await this.where({ name, isSystem: true })) as Role[];
        return systemRoles[0] ?? null;
    }

    /**
     * Return all roles visible to an organization: system roles (organizationId=null)
     * plus the org's own custom roles.
     *
     * Callers use this to populate the "assign role" dropdown — users can only be
     * assigned to roles their org owns or to shared system roles.
     */
    static async findByOrg(organizationId: string): Promise<Role[]> {
        const [systemRoles, customRoles] = await Promise.all([
            this.where({ isSystem: true }) as Promise<Role[]>,
            this.where({ organizationId, isSystem: false }) as Promise<Role[]>,
        ]);
        // Sort: system roles first (by name), then custom (by name)
        const byName = (a: Role, b: Role) => String(a.get('name')).localeCompare(String(b.get('name')));
        return [...systemRoles.sort(byName), ...customRoles.sort(byName)];
    }

    /**
     * Return only the custom (non-system) roles that belong to a specific org.
     */
    static async findCustomByOrg(organizationId: string): Promise<Role[]> {
        return (await this.where({ organizationId, isSystem: false })) as Role[];
    }

    // ============================================================
    // DEFAULT ROLE SEEDING
    // ============================================================

    /**
     * Seed the four OOB roles (owner, admin, member, viewer) from DEFAULT_ROLES.
     *
     * These are system roles (organizationId = NULL) shared across all tenants.
     * Idempotent and cheap: short-circuits when all four already exist. If a role
     * exists but has drifted (permissions or description changed in the framework)
     * it is reconciled in-place so upgrades are hands-free.
     *
     * Returns a map of {name: Role} for every default role.
     */
    static async ensureDefaults(): Promise<Record<DefaultRoleName, Role>> {
        // Query by isSystem=true to avoid confusing org-custom roles that happen
        // to share a name with a system role.
        const allSystem = (await this.where({ isSystem: true })) as Role[];
        const byName = new Map<string, Role>(
            allSystem
                .filter((r) => DEFAULT_ROLE_NAMES.includes(r.get('name') as DefaultRoleName))
                .map((r) => [r.get('name') as string, r]),
        );

        for (const name of DEFAULT_ROLE_NAMES) {
            const seed = DEFAULT_ROLES[name];
            const serialized = JSON.stringify(seed.permissions);
            const current = byName.get(name);

            if (!current) {
                const created = (await this.create({
                    name: seed.name,
                    organizationId: null,
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

}
