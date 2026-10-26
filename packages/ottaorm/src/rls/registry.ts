/**
 * RLS Model Registry
 *
 * Pre-configured RLS policies for all models in the system
 */

import { hasGrantedPermission } from '@ottabase/utils/permissions';
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
                // Organizations don't have organizationId — they ARE the organization. A user sees
                // the orgs they are an ACTIVE member of (owners always have an active owner
                // membership, so this covers them too).
                if (!context.userId) {
                    return null;
                }

                // Platform admins are the SaaS control plane and administer EVERY tenant (rename,
                // suspend, change plan), so they are not membership-scoped. Gated on the scope-aware
                // `platformAdmin` flag — derived from a SYSTEM-scoped grant, never a role name — the
                // same signal enforceOrgMembership uses for its cross-tenant bypass. Without this an
                // org-mutation route that allows platform admins would still 404 on the
                // read-before-write for any org they don't personally belong to.
                if (context.platformAdmin) {
                    return {};
                }

                // Membership is the ONLY evidence. Unresolved (undefined) and empty both deny:
                // there is no ownerId fallback because `Organization.ownerId` is stamped at creation
                // and never cleared on removal/demotion, so it would let a removed ex-owner keep
                // reading (and, since secure-crud lets you update rows you can read, writing) the
                // org they created. Mirrors enforceOrgMembership: a context builder that forgot to
                // resolve membership fails loudly instead of running a weaker filter.
                const memberships = context.memberOrganizationIds;
                return Array.isArray(memberships) && memberships.length > 0 ? { id: memberships } : null;
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

    // RBAC definition/grant tables. Generic CRUD on these is hard-blocked in ottaorm-crud.ts (they
    // grant the roles/permissions the auth layer reads from). These policies are DEFENSE-IN-DEPTH so
    // any other secure-crud path is platform-admin gated too.
    // WARNING: `roles`/`permissions` are ALSO fail-closed today by an accidental RLS-field/column
    // mismatch (they have no `organizationId` column). Do NOT "fix" that mismatch without keeping a
    // real gate — the requirePlatformAdmin below is that gate, so nothing relies on the mismatch.
    {
        model: 'roles',
        policy: { level: 'custom', requirePlatformAdmin: true },
        auditEnabled: true,
    },

    {
        model: 'permissions',
        policy: { level: 'custom', requirePlatformAdmin: true },
        auditEnabled: true,
    },

    // user_roles is org-scoped (real `organization_id` column), so its tenant RLS FUNCTIONS; on top
    // of that, requirePlatformAdmin is the permission gate: minting/reading a role grant requires a
    // system-scoped platform admin, matching how grants are actually issued.
    {
        model: 'user_roles',
        policy: { ...RLSPolicies.TenantScoped(false), requirePlatformAdmin: true },
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
        // Never public: with no auth gate on the generic CRUD route, a public policy would let anyone
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

    // Posts: tenant + app scoped for everyone; the USER dimension is editorial.
    // Authors (no manage grant) are confined to their own posts; a caller whose merged
    // permissions carry posts:manage / posts:* / org:admin / *:* — or a platform admin —
    // operates on every post in the org. Permission + scope, never role names.
    {
        model: 'posts',
        policy: {
            level: 'custom',
            allowNullTenant: false,
            filter: (context) => {
                if (!context.userId) return null; // fail closed without a user
                if (context.organizationId === undefined || context.organizationId === null) {
                    // THE SITE BLOG: rows with organizationId NULL are platform-owned
                    // (each organization's own blog is org-scoped). A PLATFORM ADMIN
                    // acting without an active org manages exactly that scope — create-injection via
                    // contextFields stamps the null org, so their posts stay
                    // platform-owned. Everyone else still fails closed.
                    if (context.platformAdmin === true) {
                        const filter: Record<string, any> = { organizationId: null };
                        if (context.appId) filter.appId = context.appId;
                        return filter;
                    }
                    return null; // tenant required (single-founder mode uses allowNullTenant paths)
                }
                const filter: Record<string, any> = { organizationId: context.organizationId };
                if (context.appId) filter.appId = context.appId;

                const permissions = context.permissions ?? [];
                const canManageAll =
                    context.platformAdmin === true ||
                    hasGrantedPermission(permissions, 'posts:manage') ||
                    hasGrantedPermission(permissions, 'org:admin');
                if (!canManageAll) filter.userId = context.userId;
                return filter;
            },
        },
        contextFields: ['organizationId', 'appId', 'userId'],
        // Only a platform admin creates site blog posts; everyone else creates in their own blog.
        createWithinReadScope: true,
        auditEnabled: true,
    },

    // Tags - app-scoped (core tags model)
    {
        model: 'tags',
        policy: RLSPolicies.AppScoped(), // Filter by appId
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Blog taxonomy, themes, plugins, settings and translations are blog-scoped: their policies
    // ship with @ottabase/ottablog (blogScopedPolicies), which owns those tables.

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
    // App scope alone (appId only) would let any caller read every organization's draft /
    // version history through the generic CRUD route. organizationId is already injected on write
    // via contextFields, so reads are scoped to the caller's organization (and app) as well. Including
    // organizationId in the read filter also activates the engine's enforceOrgMembership check.
    {
        model: 'post_versions',
        policy: {
            level: 'custom',
            filter: (context) => {
                // Mirrors `posts`: version history is editor data. An anonymous caller (or a signed-in
                // user with no active org) must not land on the site blog's NULL-org partition: that
                // would expose its draft history to anyone. Only a platform admin acting without an
                // org manages that scope.
                if (!context.userId) return null;
                if (context.organizationId == null && context.platformAdmin !== true) return null;
                const filter: Record<string, any> = { organizationId: context.organizationId ?? null };
                if (context.appId) filter.appId = context.appId;
                return filter;
            },
        },
        contextFields: ['organizationId', 'appId'],
        auditEnabled: true,
    },

    // Shortlinks - app-scoped, admin/owner only (unauthenticated CRUD here would let anyone mint
    // redirects under the app's own domain — the generic /api/ottaorm/shortlinks route has no other
    // auth check of its own, unlike users/menus/organization_members which are blocked outright).
    {
        model: 'shortlinks',
        policy: { ...RLSPolicies.AppScoped(), requirePlatformAdmin: true },
        auditEnabled: true,
    },

    // Referral tracking - owner-scoped.
    // App scope alone (appId only) would expose, and allow forgery of, every user's referral
    // rows (IP, user-agent, referrer graph) through the generic CRUD route. Reads are scoped to
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

    // Menu slot assignments - app-global brand data (platform-owned). The live write path is
    // /api/brand/menu-slots (direct model calls, system-scoped requireBrandEditAccess); generic CRUD
    // is default-denied. requirePlatformAdmin here is defense-in-depth so this RLS can never be
    // satisfied by an org-scoped session (even one holding `*:*`) if ever reached via secure-crud.
    {
        model: 'menu_slot_assignments',
        policy: {
            ...RLSPolicies.AppScoped(),
            requiredPermissions: ['brand:edit'],
            requirePlatformAdmin: true,
        },
        contextFields: ['appId'],
        auditEnabled: true,
    },

    // Comments: scoped to their target's organization, which the host derives from the target
    // (a comment on a post takes the post's org). Null is a real scope: comments on site-level
    // content such as the site blog, which belongs to no organization. An unresolved
    // (undefined) organization is never one: deny rather than read unscoped.
    {
        model: 'comments',
        policy: {
            level: 'custom',
            filter: (context) =>
                context.organizationId === undefined ? null : { organizationId: context.organizationId },
        },
        contextFields: ['organizationId'],
        createWithinReadScope: true,
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
