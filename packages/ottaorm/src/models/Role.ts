// ============================================================
// @ottabase/ottaorm - Role Model
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import { rolesTable } from './Role.schema';

export { rolesTable, type NewRoleType, type RoleType } from './Role.schema';

export const PLATFORM_OWNER_ROLE_NAME = 'platform_owner';

/**
 * Permission that marks the holder as a PLATFORM administrator — the SaaS control plane
 * (all users/orgs, RBAC role definitions, infrastructure, app-global appearance/content).
 * Only ever meaningful when granted at SYSTEM scope; guards read it from the system-scoped
 * grant set, never from an org-scoped one (see packages/rbac assertAdmin / session-store
 * `platformAdmin`). `platform_owner`'s '*:*' satisfies it via the wildcard matcher.
 */
export const PLATFORM_ADMIN_PERMISSION = 'platform:admin';

/**
 * Permission that marks the holder as an ORGANIZATION administrator (their own tenant:
 * blog, media, members, org settings). Held org-scoped by the 'owner' and 'admin' roles.
 */
export const ORG_ADMIN_PERMISSION = 'org:admin';

/**
 * Permission to manage the ORGANISATION's AI provider credentials (@ottabase/ottaai).
 *
 * A provider key is a SPENDING INSTRUMENT for the org, and RLS isolates tenants, not
 * members — without a named permission, every member of an org could replace the shared
 * key with one they control and every colleague's prompts would flow through their
 * provider account. Deliberately NOT covered by the `*:create`/`*:update` wildcards an
 * editor holds: `ai:manage` matches only an explicit grant (or platform_owner's '*:*').
 */
export const AI_MANAGE_PERMISSION = 'ai:manage';

/**
 * Scoped permission set for the org-level 'owner' / 'admin' roles.
 *
 * Full CRUD on all resources within the org, plus the `org:admin` capability and
 * feature-specific grants. Deliberately excludes '*:*' — the superadmin wildcard — and
 * app-global grants like `brand:*` (appearance/menus are platform-owned, not tenant data),
 * so the permission system itself enforces the boundary between org-scoped admins and the
 * system-scoped platform owner. Authorization keys on THESE permissions at the right scope,
 * never on the role's name (a role merely named 'owner'/'admin' grants nothing on its own).
 */
export const ORG_OWNER_PERMISSIONS: string[] = [
    '*:read',
    '*:create',
    '*:update',
    '*:delete',
    ORG_ADMIN_PERMISSION,
    'media:*',
    'comments:moderate',
    'audit:read',
    // Editorial capabilities are explicit permissions, never implied by a role name:
    // posts:publish gates the draft→published/scheduled transition; posts:manage waives
    // the own-posts-only RLS dimension (edit anyone's post in the org).
    'posts:publish',
    'posts:manage',
    // The org's AI provider key is a spending instrument; owners/admins manage it.
    AI_MANAGE_PERMISSION,
];

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
        return hasGrantedPermission(this.getPermissions(), permission);
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

        // Get users (wire through ordering options; whereIn doesn't support column selection)
        return User.whereIn('id', userIds, {
            orderBy: options?.orderBy,
            orderDirection: options?.orderDirection,
        });
    }

    /**
     * Find role by name
     */
    static async findByName(name: string) {
        return this.first({ name });
    }

    /**
     * Canonical definitions of the built-in system roles — the single source of truth for
     * ensureDefaultRoles() (runtime seeding + heal).
     *
     * IMPORTANT: `admin` and `owner` are ORG-level roles (no '*:*'). Platform authority comes
     * ONLY from a system-scoped grant carrying `platform:admin` (or '*:*'), which the bootstrap
     * assigns exclusively to `platform_owner`. A role's NAME is never trusted for authorization.
     */
    static readonly DEFAULT_ROLE_DEFINITIONS: ReadonlyArray<{
        name: string;
        description: string;
        permissions: string[];
    }> = [
        {
            name: PLATFORM_OWNER_ROLE_NAME,
            description: 'Platform owner (bootstrapped app owner) with full privileges',
            permissions: ['*:*'],
        },
        {
            name: 'owner',
            description: 'Organization owner — full org-level access (no system-level wildcard)',
            permissions: ORG_OWNER_PERMISSIONS,
        },
        {
            name: 'admin',
            description: 'Organization administrator — full org-level access (no system-level wildcard)',
            permissions: ORG_OWNER_PERMISSIONS,
        },
        {
            name: 'editor',
            description: 'Can create, edit, and publish any post in the organization',
            permissions: ['*:read', '*:create', '*:update', 'posts:publish', 'posts:manage'],
        },
        {
            name: 'author',
            description: 'Can write and edit their own posts; publishing requires an editor or admin',
            permissions: ['*:read', 'posts:create', 'posts:update', 'media:create', 'media:read'],
        },
        {
            name: 'viewer',
            description: 'Read-only access',
            permissions: ['*:read'],
        },
        {
            name: 'member',
            description: 'Default member access',
            permissions: ['*:read'],
        },
    ];

    /**
     * Ensure the built-in system roles exist, and — only when `heal` is set — reconcile existing
     * ones back to {@link DEFAULT_ROLE_DEFINITIONS}.
     *
     * Two modes, deliberately separated:
     *  - default (`heal` false): CREATE-IF-MISSING only. Safe for the signup hot path — it never
     *    rewrites an existing row, so it can't silently revert state or incur an unbounded
     *    session-refresh obligation on every signup.
     *  - `heal: true`: additionally reconcile each existing `isSystem` row's permissions/description
     *    (e.g. heal a legacy `owner = ['*:*']` from before org/platform scoping). This is the
     *    DELIBERATE maintenance path — run it from the bootstrap seed step (`/__bootstrap__/seed`),
     *    which follows the reconcile with an RBAC-cache invalidation + session refresh so the healed
     *    permissions take effect (see reconcileSystemRoleSessions). Do NOT heal from the signup path.
     *
     * TRADEOFF (deliberate): because heal runs only from seed, a legacy `owner = ['*:*']` row
     * survives until an operator runs it. That delay is NOT a privilege-escalation window: platform
     * access is gated on a SYSTEM-scoped grant (not on merged permissions), grant/system tables are
     * default-denied in generic CRUD, and the cross-tenant bypass is gated on the scope-aware
     * `platformAdmin` flag (not the `*:*` string) — so a lingering org-scoped `*:*` grants exactly
     * what a legitimate org admin has, and nothing platform-wide or cross-tenant.
     *
     * System roles are framework-owned; customize by creating NEW roles, never by editing these
     * (the admin API rejects edits to `isSystem` roles, and heal would revert them anyway).
     *
     * @returns the roles that were created or reconciled (empty when everything already matches).
     */
    static async ensureDefaultRoles(options?: { heal?: boolean }) {
        const heal = options?.heal ?? false;
        const changed: InstanceType<typeof Role>[] = [];

        for (const def of this.DEFAULT_ROLE_DEFINITIONS) {
            const existing = await this.findByName(def.name);
            if (!existing) {
                changed.push(
                    await this.create({
                        name: def.name,
                        description: def.description,
                        permissions: JSON.stringify(def.permissions),
                        isSystem: true,
                    }),
                );
                continue;
            }

            // Reconcile only in heal mode, and only framework-owned rows — never clobber operator roles.
            if (!heal || !existing.get('isSystem')) continue;

            const permsDiffer = JSON.stringify(existing.getPermissions()) !== JSON.stringify(def.permissions);
            const descDiffers = existing.get('description') !== def.description;
            if (permsDiffer || descDiffers) {
                const healed = await this.update(existing.get('id') as string, {
                    permissions: JSON.stringify(def.permissions),
                    description: def.description,
                });
                changed.push(healed as InstanceType<typeof Role>);
            }
        }

        return changed;
    }
}
