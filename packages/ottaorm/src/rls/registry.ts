/**
 * RLS Model Registry
 *
 * Pre-configured RLS policies for all models in the system
 */

import { globalRLS } from './engine';
import type { ModelRLSConfig } from './types';
import { RLSPolicies } from './types';

/**
 * Sentinel active-org value that denotes the system/global scope. Mirrors
 * `SYSTEM_ORGANIZATION_ID` in `@ottabase/rbac` — duplicated here because the ORM layer must not
 * depend on the higher-level rbac package. A role in this scope is stored with `organizationId = NULL`.
 */
const RLS_SYSTEM_ORG = 'system';

/**
 * Define RLS policies for all models
 */
export const MODEL_POLICIES: ModelRLSConfig[] = [
    // ========================================
    // TENANT-SCOPED MODELS
    // ========================================

    {
        model: 'organizations',
        policy: {
            level: 'custom',
            filter: (context) => {
                // Organizations don't have organizationId - they ARE the organization
                // Users should see organizations they own OR are members of
                if (!context.userId) {
                    return null;
                }

                // When memberOrganizationIds is populated (by the upstream security
                // context builder), use it to return all orgs the user can access.
                // This list already includes both owned and member orgs.
                if (context.memberOrganizationIds && context.memberOrganizationIds.length > 0) {
                    return { id: context.memberOrganizationIds };
                }

                // Fallback: filter by ownerId only (membership info not available)
                return { ownerId: context.userId };
            },
        },
        // Pin ownership on create and block forging someone else's ownerId. The read filter
        // uses ownerId/memberOrganizationIds, so without this a client could create an org
        // owned by another user.
        enforceOnWrite: { ownerId: 'userId' },
        auditEnabled: true,
    },

    {
        model: 'organization_members',
        policy: RLSPolicies.TenantScoped(false), // Must have org context
        auditEnabled: true,
    },

    // User groups: membership-scoped. A user sees the groups they belong to (resolved upstream into
    // SecurityContext.memberGroupIds), falling back to groups they created when that set isn't
    // available — mirroring the organizations policy.
    {
        model: 'user_groups',
        policy: {
            level: 'custom',
            filter: (context) => {
                if (!context.userId) return null;
                if (context.memberGroupIds && context.memberGroupIds.length > 0) {
                    return { id: context.memberGroupIds };
                }
                return { createdBy: context.userId };
            },
        },
        // Pin the creator on create (block forging someone else's createdBy); contextFields keeps it
        // org-isolated on writes.
        enforceOnWrite: { createdBy: 'userId' },
        contextFields: ['organizationId'],
        auditEnabled: true,
    },

    // Group membership rows: a user sees members of the groups they belong to, else only their own
    // rows. Org isolation is enforced on writes; who may add/remove members is the app's call.
    {
        model: 'user_group_members',
        policy: {
            level: 'custom',
            filter: (context) => {
                if (!context.userId) return null;
                if (context.memberGroupIds && context.memberGroupIds.length > 0) {
                    return { groupId: context.memberGroupIds };
                }
                return { userId: context.userId };
            },
        },
        contextFields: ['organizationId'],
        auditEnabled: true,
    },

    // Roles carry an `organizationId` (NULL = system/global role, shared by all tenants; non-null =
    // a tenant's own custom role). Generic CRUD is read-only and org-scoped — role writes go through
    // the dedicated /api/rbac/roles (admin) routes, which merge global + org roles and enforce
    // per-scope ownership. The active org 'system' sentinel maps to the global (NULL) scope.
    {
        model: 'roles',
        policy: {
            level: 'custom',
            readOnly: true,
            filter: (ctx) => {
                if (!ctx.userId) return null;
                const org = ctx.organizationId && ctx.organizationId !== RLS_SYSTEM_ORG ? ctx.organizationId : null;
                return { organizationId: org };
            },
        },
        auditEnabled: true,
    },

    // Permissions are a global, read-only capability catalog (no per-tenant column).
    {
        model: 'permissions',
        policy: RLSPolicies.PublicReadOnly(),
        auditEnabled: true,
    },

    {
        model: 'user_roles',
        policy: RLSPolicies.TenantScoped(false),
        auditEnabled: true,
    },

    {
        model: 'audit_logs',
        policy: {
            ...RLSPolicies.TenantScoped(true),
            readOnly: true, // Audit logs are append-only
        },
        auditEnabled: false, // Don't audit the audit logs
    },

    // ========================================
    // USER-SCOPED MODELS (No tenant isolation)
    // ========================================

    {
        model: 'users',
        policy: RLSPolicies.OwnerOnly('id'), // Users can only see themselves
        auditEnabled: true,
    },

    {
        model: 'accounts',
        policy: RLSPolicies.UserScoped(),
        auditEnabled: true,
    },

    {
        model: 'sessions',
        policy: RLSPolicies.UserScoped(),
        auditEnabled: false, // Too noisy
    },

    {
        model: 'verification_tokens',
        policy: RLSPolicies.PublicReadOnly(), // Token validation needs read access
        auditEnabled: false,
    },

    // ========================================
    // ADMIN-ONLY MODELS
    // ========================================

    {
        model: 'system_config',
        policy: RLSPolicies.AdminOnly(),
        auditEnabled: true,
    },

    // ========================================
    // CUSTOM POLICIES (Examples)
    // ========================================

    // Example: Posts that belong to org AND created by user
    {
        model: 'posts',
        policy: RLSPolicies.Hierarchical(false), // Tenant + User scoped
        contextFields: ['organizationId', 'appId', 'userId'],
        auditEnabled: true,
    },

    // Blog series - app-scoped (no tenant isolation, filtered by appId)
    {
        model: 'series',
        policy: RLSPolicies.AppScoped(), // Filter by appId
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Blog categories - app-scoped
    {
        model: 'categories',
        policy: RLSPolicies.AppScoped(), // Filter by appId
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Tags - app-scoped (core tags model)
    {
        model: 'tags',
        policy: RLSPolicies.AppScoped(), // Filter by appId
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Blog tags - app-scoped
    {
        model: 'post_tags',
        policy: RLSPolicies.AppScoped(), // Filter by appId
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Blog tag links (junction table) — no appId column; security inherits from parent entities
    {
        model: 'post_tag_links',
        policy: { level: 'public' },
        auditEnabled: false,
    },

    // Blog category links (junction table) — no appId column; security inherits from parent entities
    {
        model: 'post_category_links',
        policy: { level: 'public' },
        auditEnabled: false,
    },

    // Blog post versions - app-scoped
    {
        model: 'post_versions',
        policy: RLSPolicies.AppScoped(), // Filter by appId
        contextFields: ['organizationId', 'appId'],
        auditEnabled: true,
    },

    // Blog themes - app-scoped
    {
        model: 'ottablog_themes',
        policy: RLSPolicies.AppScoped(), // Filter by appId
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Blog plugins - app-scoped
    {
        model: 'ottablog_plugins',
        policy: RLSPolicies.AppScoped(), // Filter by appId
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Shortlinks - app-scoped
    {
        model: 'shortlinks',
        policy: RLSPolicies.AppScoped(), // Filter by appId
        auditEnabled: true,
    },

    // Referral tracking - app-scoped
    {
        model: 'referral_tracking',
        policy: RLSPolicies.AppScoped(), // Filter by appId
        auditEnabled: true,
    },

    // Menus – app-scoped (Ottamenu), requires brand:edit (same as Brand Kits). *:* satisfies this.
    {
        model: 'menus',
        policy: {
            ...RLSPolicies.AppScoped(),
            requiredPermissions: ['brand:edit'],
        },
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Menu items – app-scoped, requires brand:edit. *:* or brand:* satisfies.
    {
        model: 'menu_items',
        policy: {
            ...RLSPolicies.AppScoped(),
            requiredPermissions: ['brand:edit'],
        },
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Todos - user-scoped (todos belong to users)
    {
        model: 'todos',
        policy: RLSPolicies.UserScoped(), // Filter by userId
        auditEnabled: true,
    },

    // Authenticators - user-scoped (WebAuthn credentials belong to users)
    {
        model: 'authenticators',
        policy: RLSPolicies.UserScoped(), // Filter by userId
        auditEnabled: true,
    },

    // Scheduled tasks - admin-only (system-level task management)
    {
        model: 'scheduled_tasks',
        policy: RLSPolicies.AdminOnly(),
        auditEnabled: true,
    },

    // Brand kits - app-scoped (brand config per app)
    {
        model: 'brand_kits',
        policy: RLSPolicies.AppScoped(),
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Layout templates - app-scoped
    {
        model: 'layout_templates',
        policy: RLSPolicies.AppScoped(),
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Layout route mappings - app-scoped
    {
        model: 'layout_route_mappings',
        policy: RLSPolicies.AppScoped(),
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Menu slot assignments - app-scoped, requires brand:edit
    {
        model: 'menu_slot_assignments',
        policy: {
            ...RLSPolicies.AppScoped(),
            requiredPermissions: ['brand:edit'],
        },
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Comments: scoped to org on reads; organizationId auto-injected on writes
    {
        model: 'comments',
        policy: RLSPolicies.TenantScoped(false),
        auditEnabled: true,
    },
];

/**
 * Register all model policies with the global RLS engine
 */
export function registerAllPolicies(): void {
    MODEL_POLICIES.forEach((config) => {
        globalRLS.register(config);
    });
}

/**
 * Register a custom policy (for app-specific models)
 */
export function registerPolicy(config: ModelRLSConfig): void {
    globalRLS.register(config);
}

/**
 * Get all registered models
 */
export function getRegisteredModels(): string[] {
    return globalRLS.getRegisteredModels();
}

/**
 * Initialize RLS system (only once)
 */
let rlsInitialized = false;
export function initRLS(): void {
    if (rlsInitialized) {
        return; // Already initialized
    }
    registerAllPolicies();
    rlsInitialized = true;
    console.log(`✅ RLS initialized: ${getRegisteredModels().length} models registered`);
}
