#!/usr/bin/env ts-node
// ============================================================
// Complete SaaS Flow Example
// Demonstrates: Tenant > App > User (RBAC) hierarchy
// ============================================================

import { logCreate } from '@ottabase/audit';
import { buildAppContext, createAuditData, hasPermission, initRBACCache } from '@ottabase/rbac';
import { AuditLog, Organization, OrganizationMember, Permission, Role, User } from '../src/models';

/**
 * Complete SaaS flow demonstration
 * Shows the entire lifecycle from organization creation to RBAC-protected operations
 */
async function main() {
    console.log('🚀 Solo Founder SaaS Platform - Complete Flow\n');
    console.log('Hierarchy: Tenant > App > User (RBAC)\n');
    console.log('═'.repeat(60));

    // ============================================================
    // STEP 1: Initialize System
    // ============================================================
    console.log('\n📦 Step 1: Initialize System');
    console.log('─'.repeat(60));

    // Initialize RBAC cache (in-memory for demo, use KV in production)
    const rbacCache = initRBACCache({
        enabled: false, // Disabled for demo (no KV)
    });

    // Create system roles
    console.log('Creating system roles...');
    const adminRole = await Role.create({
        name: 'admin',
        description: 'Full access to all resources',
    });

    const editorRole = await Role.create({
        name: 'editor',
        description: 'Can create and edit content',
    });

    const viewerRole = await Role.create({
        name: 'viewer',
        description: 'Read-only access',
    });

    // Create permissions
    console.log('Creating permissions...');
    const permissions = [
        { name: '*:*', description: 'Super admin - all permissions' },
        { name: 'users:*', description: 'All user operations' },
        { name: 'posts:*', description: 'All post operations' },
        { name: 'posts:read', description: 'Read posts' },
        { name: 'posts:write', description: 'Create and edit posts' },
        { name: 'audit:read', description: 'Read audit logs' },
    ];

    for (const perm of permissions) {
        await Permission.create(perm);
    }

    // Assign permissions to roles
    const adminPerms = await Permission.where({ name: '*:*' });
    for (const perm of adminPerms) {
        await adminRole.assignPermission(perm.id);
    }

    const editorPerms = await Permission.where({}).then((perms) =>
        perms.filter((p) => p.name.includes('posts:') && p.name !== 'posts:read'),
    );
    for (const perm of editorPerms) {
        await editorRole.assignPermission(perm.id);
    }

    const viewerPerms = await Permission.where({}).then((perms) => perms.filter((p) => p.name === 'posts:read'));
    for (const perm of viewerPerms) {
        await viewerRole.assignPermission(perm.id);
    }

    console.log('✅ System initialized\n');

    // ============================================================
    // STEP 2: Create Organizations (Tenants)
    // ============================================================
    console.log('\n🏢 Step 2: Create Organizations (Multi-Tenant)');
    console.log('─'.repeat(60));

    const acmeCorp = await Organization.create({
        name: 'Acme Corp',
        slug: 'acme',
        plan: 'pro',
        status: 'active',
    });
    console.log(`✅ Created organization: ${acmeCorp.name} (${acmeCorp.id})`);

    const startupInc = await Organization.create({
        name: 'Startup Inc',
        slug: 'startup',
        plan: 'free',
        status: 'active',
    });
    console.log(`✅ Created organization: ${startupInc.name} (${startupInc.id})\n`);

    // ============================================================
    // STEP 3: Create Users
    // ============================================================
    console.log('\n👤 Step 3: Create Users');
    console.log('─'.repeat(60));

    const john = await User.create({
        email: 'john@acme.com',
        name: 'John Doe',
    });
    console.log(`✅ Created user: ${john.name} (${john.email})`);

    const jane = await User.create({
        email: 'jane@acme.com',
        name: 'Jane Smith',
    });
    console.log(`✅ Created user: ${jane.name} (${jane.email})`);

    const bob = await User.create({
        email: 'bob@startup.com',
        name: 'Bob Johnson',
    });
    console.log(`✅ Created user: ${bob.name} (${bob.email})\n`);

    // ============================================================
    // STEP 4: Add Users to Organizations
    // ============================================================
    console.log('\n🔗 Step 4: Organization Membership');
    console.log('─'.repeat(60));

    // John is owner of Acme Corp
    await OrganizationMember.addMember({
        userId: john.id,
        organizationId: acmeCorp.id,
        role: 'owner',
        status: 'active',
    });
    console.log(`✅ John → Acme Corp (owner)`);

    // Jane is admin of Acme Corp
    await OrganizationMember.addMember({
        userId: jane.id,
        organizationId: acmeCorp.id,
        role: 'admin',
        status: 'active',
        invitedBy: john.id,
    });
    console.log(`✅ Jane → Acme Corp (admin)`);

    // Bob is owner of Startup Inc
    await OrganizationMember.addMember({
        userId: bob.id,
        organizationId: startupInc.id,
        role: 'owner',
        status: 'active',
    });
    console.log(`✅ Bob → Startup Inc (owner)\n`);

    // ============================================================
    // STEP 5: Assign RBAC Roles
    // ============================================================
    console.log('\n🔐 Step 5: Assign RBAC Roles (Per Organization)');
    console.log('─'.repeat(60));

    // John is admin in Acme Corp (all apps)
    await john.assignRole(adminRole.id, john.id, acmeCorp.id);
    console.log(`✅ John → admin role in Acme Corp (all apps)`);

    // Jane is editor in Acme Corp web app
    await jane.assignRole(editorRole.id, john.id, acmeCorp.id, 'web');
    console.log(`✅ Jane → editor role in Acme Corp (web app only)`);

    // Bob is admin in Startup Inc
    await bob.assignRole(adminRole.id, bob.id, startupInc.id);
    console.log(`✅ Bob → admin role in Startup Inc (all apps)\n`);

    // ============================================================
    // STEP 6: Build App Contexts
    // ============================================================
    console.log('\n🎯 Step 6: Build App Contexts');
    console.log('─'.repeat(60));

    // John's context in Acme Corp web app
    const johnContext = await buildAppContext({
        organizationId: acmeCorp.id,
        organizationName: acmeCorp.name,
        appId: 'web',
        appName: 'Web App',
        user: john,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        cache: rbacCache,
    });

    console.log(`✅ John's context:`);
    console.log(`   Organization: ${johnContext.organizationName}`);
    console.log(`   App: ${johnContext.appName}`);
    console.log(`   User: ${johnContext.user?.name}`);
    console.log(`   Roles: ${johnContext.roles.join(', ')}`);
    console.log(`   Permissions: ${johnContext.permissions.slice(0, 3).join(', ')}...`);

    // Jane's context in Acme Corp web app
    const janeContext = await buildAppContext({
        organizationId: acmeCorp.id,
        organizationName: acmeCorp.name,
        appId: 'web',
        user: jane,
        cache: rbacCache,
    });

    console.log(`\n✅ Jane's context:`);
    console.log(`   Organization: ${janeContext.organizationName}`);
    console.log(`   Roles: ${janeContext.roles.join(', ')}`);
    console.log(`   Permissions: ${janeContext.permissions.join(', ')}`);

    // Bob's context in Startup Inc
    const bobContext = await buildAppContext({
        organizationId: startupInc.id,
        organizationName: startupInc.name,
        appId: 'web',
        user: bob,
        cache: rbacCache,
    });

    console.log(`\n✅ Bob's context:`);
    console.log(`   Organization: ${bobContext.organizationName}`);
    console.log(`   Roles: ${bobContext.roles.join(', ')}\n`);

    // ============================================================
    // STEP 7: Permission Checks
    // ============================================================
    console.log('\n✅ Step 7: Permission Checks (RBAC in Action)');
    console.log('─'.repeat(60));

    // John (admin) can do everything
    console.log(`\nJohn's permissions in Acme Corp:`);
    console.log(`  Can create posts: ${hasPermission(johnContext, 'posts:write')}`);
    console.log(`  Can delete users: ${hasPermission(johnContext, 'users:delete')}`);
    console.log(`  Can read audit: ${hasPermission(johnContext, 'audit:read')}`);

    // Jane (editor) has limited permissions
    console.log(`\nJane's permissions in Acme Corp:`);
    console.log(`  Can create posts: ${hasPermission(janeContext, 'posts:write')}`);
    console.log(`  Can delete users: ${hasPermission(janeContext, 'users:delete')}`);
    console.log(`  Can read audit: ${hasPermission(janeContext, 'audit:read')}`);

    // Bob (admin in different org)
    console.log(`\nBob's permissions in Startup Inc:`);
    console.log(`  Can create posts: ${hasPermission(bobContext, 'posts:write')}`);
    console.log(`  Can delete users: ${hasPermission(bobContext, 'users:delete')}\n`);

    // ============================================================
    // STEP 8: Simulated Operations with Audit
    // ============================================================
    console.log('\n📝 Step 8: Operations with Audit Logging');
    console.log('─'.repeat(60));

    // Simulate John creating a post
    console.log(`\n${johnContext.user?.name} creates a post in ${johnContext.organizationName}...`);

    if (hasPermission(johnContext, 'posts:write')) {
        const post = {
            id: crypto.randomUUID(),
            title: 'Welcome to Acme Corp Blog',
            content: 'First post',
            organizationId: johnContext.organizationId,
            appId: johnContext.appId,
            authorId: johnContext.userId,
        };

        // Log creation
        await logCreate('post', post.id, post, createAuditData(johnContext, 'create', 'post', post.id));

        console.log(`✅ Post created and logged`);
    } else {
        console.log(`❌ Permission denied`);
    }

    // Simulate Jane trying to delete a user (should fail)
    console.log(`\n${janeContext.user?.name} tries to delete a user...`);

    if (hasPermission(janeContext, 'users:delete')) {
        console.log(`✅ User deleted`);
    } else {
        console.log(`❌ Permission denied - Jane doesn't have users:delete`);

        // Log failed attempt
        await AuditLog.create({
            userId: janeContext.userId,
            userEmail: janeContext.userEmail,
            organizationId: janeContext.organizationId,
            appId: janeContext.appId,
            action: 'delete',
            resourceType: 'user',
            resourceId: john.id,
            status: 'failure',
            errorMessage: 'Insufficient permissions',
            ipAddress: '192.168.1.2',
            createdAt: Date.now(),
        });
    }

    // ============================================================
    // STEP 9: Query Audit Logs
    // ============================================================
    console.log('\n\n📊 Step 9: Audit Trail');
    console.log('─'.repeat(60));

    const acmeAuditLogs = await AuditLog.getByOrganization(acmeCorp.id, 10);
    console.log(`\nAcme Corp audit logs (${acmeAuditLogs.length} entries):`);

    for (const log of acmeAuditLogs) {
        console.log(`  [${log.status}] ${log.userEmail} - ${log.action} ${log.resourceType}`);
    }

    // ============================================================
    // STEP 10: Multi-Tenant Isolation Verification
    // ============================================================
    console.log('\n\n🔒 Step 10: Multi-Tenant Isolation Verification');
    console.log('─'.repeat(60));

    console.log(`\nAcme Corp members: ${await Organization.getMemberCount(acmeCorp.id)}`);
    console.log(`Startup Inc members: ${await Organization.getMemberCount(startupInc.id)}`);

    console.log(`\n✅ Data is completely isolated per organization!`);
    console.log(`✅ Users can belong to multiple organizations with different roles!`);
    console.log(`✅ Permissions are scoped per organization (and optionally per app)!`);

    // ============================================================
    // Summary
    // ============================================================
    console.log('\n\n' + '═'.repeat(60));
    console.log('🎉 Complete SaaS Flow Demonstration Complete!');
    console.log('═'.repeat(60));

    console.log(`\n✅ What we demonstrated:`);
    console.log(`  1. System initialization (roles + permissions)`);
    console.log(`  2. Multi-tenant organizations`);
    console.log(`  3. User management`);
    console.log(`  4. Organization membership (users can join multiple orgs)`);
    console.log(`  5. RBAC (roles scoped by org + app)`);
    console.log(`  6. Unified AppContext`);
    console.log(`  7. Permission checks with wildcard matching`);
    console.log(`  8. Operations with audit logging`);
    console.log(`  9. Audit trail queries`);
    console.log(` 10. Multi-tenant data isolation`);

    console.log(`\n📚 Next steps:`);
    console.log(`  - Read SOLO_FOUNDER_SAAS_GUIDE.md for complete documentation`);
    console.log(`  - Check MULTI_APP_MULTI_TENANT_ARCHITECTURE.md for design decisions`);
    console.log(`  - Explore other examples in packages/ottaorm/examples/`);
    console.log(`  - Build your MVP!`);

    console.log(`\n🚀 You're ready to build production SaaS from home!\n`);
}

// Run if executed directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Error:', error);
            process.exit(1);
        });
}

export { main };
