/**
 * RLS Model Registry
 *
 * Pre-configured RLS policies for all models in the system
 */

import { globalRLS } from './engine';
import type { ModelRLSConfig } from './types';
import { RLSPolicies } from './types';

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

    {
        model: 'roles',
        policy: RLSPolicies.TenantScoped(true), // System roles have null orgId
        auditEnabled: true,
    },

    {
        model: 'permissions',
        policy: RLSPolicies.TenantScoped(true), // System permissions have null orgId
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
        // Previously PublicReadOnly, which — with no auth gate on the generic CRUD route — let anyone
        // read every email-verification / password-reset / magic-link token row. The auth flows read
        // and consume these via direct model calls (VerificationToken.consumeByIdentifierAndToken,
        // etc.) that bypass RLS, so nothing legitimate needs RLS/CRUD access: deny reads (custom
        // filter returns null) and keep writes blocked (readOnly). Also hard-blocked in
        // ottaorm-crud.ts as the primary gate.
        model: 'verification_tokens',
        policy: { level: 'custom', readOnly: true, filter: () => null },
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

    // Blog post versions - tenant + app scoped.
    // Previously AppScoped (appId only), which let any caller read every organization's draft /
    // version history through the generic CRUD route. organizationId is already injected on write
    // via contextFields, so scope reads to the caller's organization (and app) as well. Including
    // organizationId in the read filter also activates the engine's enforceOrgMembership check.
    {
        model: 'post_versions',
        policy: {
            level: 'custom',
            filter: (context) => {
                const filter: Record<string, any> = { organizationId: context.organizationId ?? null };
                if (context.appId) filter.appId = context.appId;
                return filter;
            },
        },
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

    // Shortlinks - app-scoped, admin/owner only (unauthenticated CRUD here would let anyone mint
    // redirects under the app's own domain — the generic /api/ottaorm/shortlinks route has no other
    // auth check of its own, unlike users/menus/organization_members which are blocked outright).
    {
        model: 'shortlinks',
        policy: { ...RLSPolicies.AppScoped(), requiredRoles: RLSPolicies.AdminOnly().requiredRoles },
        auditEnabled: true,
    },

    // Referral tracking - owner-scoped.
    // Previously AppScoped (appId only), which exposed and allowed forgery of every user's referral
    // rows (IP, user-agent, referrer graph) through the generic CRUD route. Reads are now scoped to
    // the owning referrer (fails closed when unauthenticated), and writes pin userId. These rows are
    // written server-side (bypassing RLS), so this only constrains the RLS/CRUD path — which is
    // additionally hard-blocked in ottaorm-crud.ts as the primary gate.
    {
        model: 'referral_tracking',
        policy: RLSPolicies.OwnerOnly('userId'),
        enforceOnWrite: { userId: 'userId' },
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
