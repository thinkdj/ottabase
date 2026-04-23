// ============================================================
// @ottabase/ottaorm - Default OOB Roles
// ============================================================

/**
 * Single source of truth for the four OOB (out-of-the-box) roles that every
 * Ottabase install ships with. Consumed by:
 *   - Role.ensureDefaults() — seeder, invoked by @ottabase/auth onFirstSignIn
 *     and the bootstrap wizard.
 *   - Organization.createWithOwner() — resolves the owner role id atomically.
 *   - OrganizationMember.syncTenantRBAC() — reassigns the correct tenant role
 *     when a member's role changes.
 *
 * Permission format is `resource:action` with wildcards:
 *   - `*:*`        → full access (system owner only)
 *   - `resource:*` → all actions on a resource
 *   - `*:action`   → one action on all resources
 */

export const DEFAULT_ROLE_NAMES = ['owner', 'admin', 'member', 'viewer'] as const;

export type DefaultRoleName = (typeof DEFAULT_ROLE_NAMES)[number];

export interface DefaultRoleSeed {
    name: DefaultRoleName;
    description: string;
    permissions: string[];
    isSystem: true;
}

export const DEFAULT_ROLES: Record<DefaultRoleName, DefaultRoleSeed> = {
    owner: {
        name: 'owner',
        description: 'Full access to everything. Cannot be demoted if last active owner.',
        permissions: ['*:*'],
        isSystem: true,
    },
    admin: {
        name: 'admin',
        description: 'Manage org content and members. No billing/org-delete.',
        permissions: [
            'users:*',
            'org:*',
            'brand:*',
            'blog:*',
            'media:*',
            'notifications:*',
            '*:read',
            '*:create',
            '*:update',
        ],
        isSystem: true,
    },
    member: {
        name: 'member',
        description: 'Create and edit content. Cannot manage users or org settings.',
        permissions: ['*:read', '*:create', '*:update'],
        isSystem: true,
    },
    viewer: {
        name: 'viewer',
        description: 'Read-only access across the org.',
        permissions: ['*:read'],
        isSystem: true,
    },
};
