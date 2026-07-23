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

                // When membership was RESOLVED (Array.isArray — even to an empty set), trust it.
                // An empty set means "no accessible orgs" → deny (null); it must NOT fall back to
                // ownerId. `Organization.ownerId` is stamped at creation and never cleared on
                // removal/demotion, so an ownerId fallback would let a removed ex-owner keep reading
                // (and, since secure-crud lets you update rows you can read, writing) the org they
                // created. Mirrors the enforceOrgMembership Array.isArray guard.
                if (Array.isArray(context.memberOrganizationIds)) {
                    return context.memberOrganizationIds.length > 0 ? { id: context.memberOrganizationIds } : null;
                }

                // Membership UNRESOLVED (undefined — e.g. pre-migration or an internal context that
                // didn't populate it): best-effort filter by ownership.
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

    // RBAC definition/grant tables. Generic CRUD on these is hard-blocked in ottaorm-crud.ts (they
    // grant the roles/permissions the auth layer reads from). These policies are DEFENSE-IN-DEPTH so
    // any other secure-crud path is platform-admin gated too.
    // WARNING: `roles`/`permissions` are ALSO fail-closed today by an accidental RLS-field/column
    // mismatch (they have no `organizationId` column). Do NOT "fix" that mismatch without keeping a
    // real gate — the requirePlatformAdmin below is that gate, so the mismatch no longer matters.
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

    // user_roles is org-scoped (real `organization_id` column), so its tenant RLS FUNCTIONS — the
    // gap was the missing permission gate. requirePlatformAdmin closes it: minting/reading a role
    // grant now requires a system-scoped platform admin, matching how grants are actually issued.
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
                    // THE PLATFORM'S OWN BLOG: rows with organizationId NULL are
                    // platform-owned (org mode serves them at the apex; each tenant's
                    // blog is org-scoped). A PLATFORM ADMIN acting without an active
                    // org manages exactly that scope — create-injection via
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
        policy: { ...RLSPolicies.AppScoped(), requirePlatformAdmin: true },
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

    // Menu slot assignments - app-global brand data (platform-owned). The live write path is
    // /api/brand/menu-slots (direct model calls, system-scoped requireBrandEditAccess); generic CRUD
    // is default-denied. requirePlatformAdmin here is defense-in-depth so this RLS can never be
    // satisfied by an org-scoped session (e.g. a stale pre-heal `*:*`) if ever reached via secure-crud.
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
