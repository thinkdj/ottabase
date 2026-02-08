// ============================================================
// @ottabase/ottaorm - RBAC Seed Script
// ============================================================

import { Permission, Role } from '../models';

/**
 * Default system roles
 */
export const DEFAULT_ROLES = [
    {
        id: '00000000-0000-0000-0000-000000000000',
        name: 'owner',
        description: 'System owner with full privileges',
        permissions: ['*:*'],
        isSystem: true,
    },
    {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'admin',
        description: 'Full system access - can perform all actions',
        permissions: ['*:*'],
        isSystem: true,
    },
    {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'editor',
        description: 'Can create and edit content',
        permissions: ['*:read', '*:create', '*:update'],
        isSystem: true,
    },
    {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'viewer',
        description: 'Read-only access to all resources',
        permissions: ['*:read'],
        isSystem: true,
    },
    {
        id: '00000000-0000-0000-0000-000000000004',
        name: 'user',
        description: 'Basic user permissions',
        permissions: ['users:read', 'users:update'],
        isSystem: true,
    },
    {
        id: '00000000-0000-0000-0000-000000000005',
        name: 'member',
        description: 'Default member access',
        permissions: ['*:read'],
        isSystem: true,
    },
];

/**
 * Default permissions
 */
export const DEFAULT_PERMISSIONS = [
    // User permissions
    { name: 'users:read', description: 'Read users', resource: 'users', action: 'read' },
    { name: 'users:create', description: 'Create users', resource: 'users', action: 'create' },
    { name: 'users:update', description: 'Update users', resource: 'users', action: 'update' },
    { name: 'users:delete', description: 'Delete users', resource: 'users', action: 'delete' },
    { name: 'users:*', description: 'All user actions', resource: 'users', action: '*' },

    // Role permissions
    { name: 'roles:read', description: 'Read roles', resource: 'roles', action: 'read' },
    { name: 'roles:create', description: 'Create roles', resource: 'roles', action: 'create' },
    { name: 'roles:update', description: 'Update roles', resource: 'roles', action: 'update' },
    { name: 'roles:delete', description: 'Delete roles', resource: 'roles', action: 'delete' },
    { name: 'roles:*', description: 'All role actions', resource: 'roles', action: '*' },

    // Permission permissions
    { name: 'permissions:read', description: 'Read permissions', resource: 'permissions', action: 'read' },
    { name: 'permissions:create', description: 'Create permissions', resource: 'permissions', action: 'create' },
    { name: 'permissions:update', description: 'Update permissions', resource: 'permissions', action: 'update' },
    { name: 'permissions:delete', description: 'Delete permissions', resource: 'permissions', action: 'delete' },
    { name: 'permissions:*', description: 'All permission actions', resource: 'permissions', action: '*' },

    // Audit log permissions
    { name: 'audit:read', description: 'Read audit logs', resource: 'audit', action: 'read' },
    { name: 'audit:export', description: 'Export audit logs', resource: 'audit', action: 'export' },
    { name: 'audit:delete', description: 'Delete audit logs', resource: 'audit', action: 'delete' },
    { name: 'audit:*', description: 'All audit actions', resource: 'audit', action: '*' },

    // Wildcard permissions
    { name: '*:read', description: 'Read all resources', resource: '*', action: 'read' },
    { name: '*:create', description: 'Create all resources', resource: '*', action: 'create' },
    { name: '*:update', description: 'Update all resources', resource: '*', action: 'update' },
    { name: '*:delete', description: 'Delete all resources', resource: '*', action: 'delete' },
    { name: '*:*', description: 'All permissions on all resources', resource: '*', action: '*' },
];

/**
 * Seed default roles
 */
export async function seedRoles(): Promise<void> {
    console.log('Seeding default roles...');

    for (const roleData of DEFAULT_ROLES) {
        // Check if role already exists
        const existing = await Role.findByName(roleData.name);
        if (existing) {
            console.log(`  - Role '${roleData.name}' already exists, skipping`);
            continue;
        }

        // Create role
        await Role.create({
            id: roleData.id,
            name: roleData.name,
            description: roleData.description,
            permissions: JSON.stringify(roleData.permissions),
            isSystem: roleData.isSystem,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        console.log(`  ✓ Created role: ${roleData.name}`);
    }

    console.log('✓ Roles seeded successfully');
}

/**
 * Seed default permissions
 */
export async function seedPermissions(): Promise<void> {
    console.log('Seeding default permissions...');

    for (const permData of DEFAULT_PERMISSIONS) {
        // Check if permission already exists
        const existing = await Permission.findByName(permData.name);
        if (existing) {
            console.log(`  - Permission '${permData.name}' already exists, skipping`);
            continue;
        }

        // Create permission
        await Permission.create({
            id: crypto.randomUUID(),
            name: permData.name,
            description: permData.description,
            resource: permData.resource,
            action: permData.action,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        console.log(`  ✓ Created permission: ${permData.name}`);
    }

    console.log('✓ Permissions seeded successfully');
}

/**
 * Seed all RBAC data (roles + permissions)
 */
export async function seedRBAC(): Promise<void> {
    console.log('='.repeat(60));
    console.log('RBAC SEED SCRIPT');
    console.log('='.repeat(60));

    try {
        await seedPermissions();
        await seedRoles();

        console.log('='.repeat(60));
        console.log('✓ RBAC seed completed successfully!');
        console.log('='.repeat(60));
    } catch (error) {
        console.error('✗ RBAC seed failed:', error);
        throw error;
    }
}

/**
 * CLI entry point
 */
if (require.main === module) {
    seedRBAC()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
