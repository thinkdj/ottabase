// ============================================================
// RBAC + Audit Logging - Complete End-to-End Demo
// ============================================================

/**
 * This example demonstrates:
 * 1. Setting up roles and permissions
 * 2. Assigning roles to users
 * 3. Checking permissions with caching
 * 4. Logging actions to audit log
 * 5. Querying audit logs
 * 6. Multi-tenant support
 */

import { User, Role, Permission, UserRole, AuditLog } from '../src/models';
import { initRBACCache, createRBACContext } from '@ottabase/rbac';
import { log as auditLog, logCreate, logUpdate, logDelete } from '@ottabase/audit';
import { registerConnection } from '../src/context';

// ============================================================
// STEP 1: Setup (Run once)
// ============================================================

async function setup() {
    console.log('\n📦 STEP 1: Initial Setup\n');

    // In production, this would be your D1 or other database driver
    // For demo purposes, assume connection is already registered
    // registerConnection('default', yourDriver);

    console.log('✓ Database connection registered');
}

// ============================================================
// STEP 2: Create Roles and Permissions
// ============================================================

async function createRolesAndPermissions() {
    console.log('\n🔐 STEP 2: Creating Roles and Permissions\n');

    // Create admin role
    const adminRole = await Role.create({
        id: crypto.randomUUID(),
        name: 'admin',
        description: 'Full system access',
        permissions: JSON.stringify(['*:*']),
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    console.log('✓ Created admin role');

    // Create editor role
    const editorRole = await Role.create({
        id: crypto.randomUUID(),
        name: 'editor',
        description: 'Can create and edit content',
        permissions: JSON.stringify(['*:read', '*:create', '*:update']),
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    console.log('✓ Created editor role');

    // Create permissions
    const permissions = [
        { name: 'users:read', resource: 'users', action: 'read', description: 'Read users' },
        { name: 'users:create', resource: 'users', action: 'create', description: 'Create users' },
        { name: 'users:update', resource: 'users', action: 'update', description: 'Update users' },
        { name: 'users:delete', resource: 'users', action: 'delete', description: 'Delete users' },
    ];

    for (const perm of permissions) {
        await Permission.create({
            id: crypto.randomUUID(),
            name: perm.name,
            description: perm.description,
            resource: perm.resource,
            action: perm.action,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        console.log(`✓ Created permission: ${perm.name}`);
    }

    return { adminRole, editorRole };
}

// ============================================================
// STEP 3: Create Users and Assign Roles
// ============================================================

async function createUsersAndAssignRoles(adminRole: any, editorRole: any) {
    console.log('\n👥 STEP 3: Creating Users and Assigning Roles\n');

    // Create admin user
    const adminUser = await User.create({
        id: crypto.randomUUID(),
        name: 'Admin User',
        email: 'admin@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    console.log('✓ Created admin user');

    // Assign admin role
    await adminUser.assignRole(adminRole.get('id'), undefined, 'org-123');
    console.log('✓ Assigned admin role to admin user (org: org-123)');

    // Create editor user
    const editorUser = await User.create({
        id: crypto.randomUUID(),
        name: 'Editor User',
        email: 'editor@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    console.log('✓ Created editor user');

    // Assign editor role
    await editorUser.assignRole(editorRole.get('id'), adminUser.get('id'), 'org-123');
    console.log('✓ Assigned editor role to editor user (org: org-123)');

    // Log role assignment to audit
    await auditLog(
        adminUser.get('id') as string,
        'role_assign',
        {
            targetUserId: editorUser.get('id'),
            roleName: 'editor',
            organizationId: 'org-123',
        },
        adminUser.get('email') as string
    );
    console.log('✓ Logged role assignment to audit log');

    return { adminUser, editorUser };
}

// ============================================================
// STEP 4: Check Permissions (with caching)
// ============================================================

async function checkPermissionsWithCache(adminUser: any, editorUser: any) {
    console.log('\n🔍 STEP 4: Checking Permissions (with caching)\n');

    // Initialize cache (in production, pass KV namespace)
    const cache = initRBACCache({
        // kv: env.RBAC_KV, // In production
        enabled: false, // Disable for demo (no KV available)
    });

    // Check admin permissions
    console.log('Admin user permissions:');
    const adminHasRead = await adminUser.hasPermission('users:read', {
        cache,
        organizationId: 'org-123',
    });
    console.log(`  - users:read: ${adminHasRead ? '✓' : '✗'}`);

    const adminHasDelete = await adminUser.hasPermission('users:delete', {
        cache,
        organizationId: 'org-123',
    });
    console.log(`  - users:delete: ${adminHasDelete ? '✓' : '✗'}`);

    // Check editor permissions
    console.log('\nEditor user permissions:');
    const editorHasRead = await editorUser.hasPermission('users:read', {
        cache,
        organizationId: 'org-123',
    });
    console.log(`  - users:read: ${editorHasRead ? '✓' : '✗'}`);

    const editorHasDelete = await editorUser.hasPermission('users:delete', {
        cache,
        organizationId: 'org-123',
    });
    console.log(`  - users:delete: ${editorHasDelete ? '✓' : '✗'}`);

    // Get all permissions
    const adminPerms = await adminUser.getPermissions({
        cache,
        organizationId: 'org-123',
    });
    console.log(`\nAdmin has ${adminPerms.length} permission(s): ${adminPerms.join(', ')}`);

    const editorPerms = await editorUser.getPermissions({
        cache,
        organizationId: 'org-123',
    });
    console.log(`Editor has ${editorPerms.length} permission(s): ${editorPerms.join(', ')}`);
}

// ============================================================
// STEP 5: Perform Actions with Audit Logging
// ============================================================

async function performActionsWithAudit(adminUser: any, editorUser: any) {
    console.log('\n📝 STEP 5: Performing Actions with Audit Logging\n');

    // Admin creates a new user
    console.log('Admin creates a new user...');
    const newUser = await User.create({
        id: crypto.randomUUID(),
        name: 'New User',
        email: 'newuser@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    await logCreate(
        'user',
        newUser.get('id') as string,
        { name: 'New User', email: 'newuser@example.com' },
        {
            userId: adminUser.get('id') as string,
            userEmail: adminUser.get('email') as string,
            organizationId: 'org-123',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            url: '/api/users',
            method: 'POST',
        }
    );
    console.log('✓ Created user and logged to audit');

    // Editor updates the user
    console.log('\nEditor updates the user...');
    const oldName = newUser.get('name');
    newUser.set('name', 'Updated User');
    await newUser.save();

    await logUpdate(
        'user',
        newUser.get('id') as string,
        {
            name: { from: oldName, to: 'Updated User' },
        },
        {
            userId: editorUser.get('id') as string,
            userEmail: editorUser.get('email') as string,
            organizationId: 'org-123',
            ipAddress: '192.168.1.2',
            userAgent: 'Mozilla/5.0',
            url: `/api/users/${newUser.get('id')}`,
            method: 'PATCH',
        }
    );
    console.log('✓ Updated user and logged to audit');

    // Admin deletes the user
    console.log('\nAdmin deletes the user...');
    await newUser.destroy();

    await logDelete('user', newUser.get('id') as string, {
        userId: adminUser.get('id') as string,
        userEmail: adminUser.get('email') as string,
        organizationId: 'org-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        url: `/api/users/${newUser.get('id')}`,
        method: 'DELETE',
    });
    console.log('✓ Deleted user and logged to audit');
}

// ============================================================
// STEP 6: Query Audit Logs
// ============================================================

async function queryAuditLogs(adminUser: any, editorUser: any) {
    console.log('\n📊 STEP 6: Querying Audit Logs\n');

    // Get all audit logs for organization
    const orgLogs = await AuditLog.getByOrganization('org-123', 10);
    console.log(`Found ${orgLogs.length} audit log(s) for org-123`);

    // Get audit logs by admin user
    const adminLogs = await AuditLog.getByUserInOrganization(
        adminUser.get('id') as string,
        'org-123',
        10
    );
    console.log(`Found ${adminLogs.length} audit log(s) by admin user`);

    // Get recent audit logs
    const recentLogs = await AuditLog.getRecent(5);
    console.log(`\nRecent audit logs (${recentLogs.length}):`);
    for (const log of recentLogs) {
        console.log(`  - ${log.get('userEmail')} performed ${log.get('action')} on ${log.get('resourceType')}`);
    }

    // Get audit logs by action
    const createLogs = await AuditLog.getByAction('create', 10);
    console.log(`\nFound ${createLogs.length} 'create' action(s)`);

    // Get failed actions
    const failures = await AuditLog.getFailures(10);
    console.log(`Found ${failures.length} failed action(s)`);
}

// ============================================================
// STEP 7: Multi-Tenant Demo
// ============================================================

async function multiTenantDemo(adminUser: any) {
    console.log('\n🏢 STEP 7: Multi-Tenant Demo\n');

    // Assign admin role to same user in different organization
    const adminRole = await Role.findByName('admin');
    await adminUser.assignRole(adminRole!.get('id'), undefined, 'org-456');
    console.log('✓ Assigned admin role to same user in org-456');

    // Check permissions in different organizations
    const hasPermInOrg123 = await adminUser.hasPermission('users:delete', {
        organizationId: 'org-123',
    });
    console.log(`Admin has users:delete in org-123: ${hasPermInOrg123 ? '✓' : '✗'}`);

    const hasPermInOrg456 = await adminUser.hasPermission('users:delete', {
        organizationId: 'org-456',
    });
    console.log(`Admin has users:delete in org-456: ${hasPermInOrg456 ? '✓' : '✗'}`);

    // Get roles in specific organization
    const rolesInOrg123 = await adminUser.roles({ organizationId: 'org-123' });
    console.log(`\nAdmin has ${rolesInOrg123.length} role(s) in org-123:`);
    for (const role of rolesInOrg123) {
        console.log(`  - ${role.get('name')}`);
    }

    const rolesInOrg456 = await adminUser.roles({ organizationId: 'org-456' });
    console.log(`\nAdmin has ${rolesInOrg456.length} role(s) in org-456:`);
    for (const role of rolesInOrg456) {
        console.log(`  - ${role.get('name')}`);
    }
}

// ============================================================
// RUN DEMO
// ============================================================

export async function runDemo() {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║   RBAC + AUDIT LOGGING - END-TO-END DEMO            ║');
    console.log('╚═══════════════════════════════════════════════════════╝');

    try {
        await setup();

        const { adminRole, editorRole } = await createRolesAndPermissions();
        const { adminUser, editorUser } = await createUsersAndAssignRoles(adminRole, editorRole);

        await checkPermissionsWithCache(adminUser, editorUser);
        await performActionsWithAudit(adminUser, editorUser);
        await queryAuditLogs(adminUser, editorUser);
        await multiTenantDemo(adminUser);

        console.log('\n╔═══════════════════════════════════════════════════════╗');
        console.log('║   ✓ DEMO COMPLETED SUCCESSFULLY!                     ║');
        console.log('╚═══════════════════════════════════════════════════════╝\n');
    } catch (error) {
        console.error('\n✗ Demo failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    runDemo()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
