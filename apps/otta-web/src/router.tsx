import { AdminLayout } from '@/components/admin/AdminLayout';
import { DemoBanner } from '@/components/DemoBanner'; // otta:only demo
import { NotFoundPage } from '@/components/NotFoundPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RouteLoadingFallback } from '@/components/RouteLoadingFallback';
import { UrlNotices } from '@/components/UrlNotices';
import { usePageViewTracking } from '@/hooks/usePageViewTracking';
import { ConfigurableLayout } from '@/ottabase/components/ConfigurableLayout';
import { MEDIA_LIBRARY_ENABLED } from '@/ottabase/config';
import { PACKAGE_ADMIN_PAGES, PACKAGE_ROUTES, PACKAGES_ENABLED } from '@/ottabase/config/packages';
import { DEMO_ACCOUNT_GATES } from '@/pages/demo/demoAccountGates'; // otta:only demo
import { BrandPathSync, LayoutResolver } from '@ottabase/brand-engine-react';
import { tanstackRouterAdapter } from '@ottabase/brand-engine-react/routers';
import { BrandScope } from '@ottabase/ui'; // otta:only ottablog
import {
    createBrowserHistory,
    lazyRouteComponent,
    Outlet,
    RootRoute,
    Route,
    Router,
    type AnyRoute,
} from '@tanstack/react-router';

import { type ComponentType, type ReactNode } from 'react';

/**
 * Admin page scope. `platform` = SaaS control plane (system-scoped platform admin only);
 * `org` = own-tenant administration (org:admin, which a platform owner also satisfies). Gates
 * are permission + scope based — a role merely NAMED 'owner'/'admin' grants nothing on its own.
 */
type AdminRouteScope = 'platform' | 'org';

function RootLayout() {
    const pathname = tanstackRouterAdapter.usePathname();

    // Track page views automatically
    usePageViewTracking();

    return (
        <>
            <BrandPathSync pathname={pathname} />
            <UrlNotices />
            {/* otta:begin demo */}
            <DemoBanner />
            {/* otta:end demo */}
            <LayoutResolver router={tanstackRouterAdapter} layoutComponent={ConfigurableLayout}>
                <Outlet />
            </LayoutResolver>
        </>
    );
}

function AdminPrivilegeFallback() {
    return (
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
            Missing privilege: admin
        </div>
    );
}

// otta:begin ottablog
/** Distinct from AdminPrivilegeFallback: /studio is gated by a CONTENT permission, never admin. */
function StudioPrivilegeFallback() {
    return (
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
            Missing privilege: content editing
        </div>
    );
}
// otta:end ottablog

/** Wraps an admin page in: ProtectedRoute(scope) → AdminLayout(sidebar) → page. */
function renderAdminRoute(scope: AdminRouteScope, children: ReactNode) {
    // Platform pages require a system-scoped platform admin; org pages require org:admin (a platform
    // owner also satisfies org:admin via '*:*'). The worker APIs enforce the same boundary — this
    // client gate only avoids showing an org owner a page whose data would 403.
    const guarded =
        scope === 'platform' ? (
            <ProtectedRoute requirePlatformAdmin fallback={<AdminPrivilegeFallback />}>
                <AdminLayout>{children}</AdminLayout>
            </ProtectedRoute>
        ) : (
            <ProtectedRoute requiredPermissions={['org:admin']} fallback={<AdminPrivilegeFallback />}>
                <AdminLayout>{children}</AdminLayout>
            </ProtectedRoute>
        );
    return guarded;
}

const rootRoute = new RootRoute({
    component: RootLayout,
    loader: () => undefined, // Triggers pending state so pendingComponent shows during lazy route load
    notFoundComponent: NotFoundPage,
});

// ─── Helpers to drastically reduce route-declaration boilerplate ─────────────

type ComponentLoader = () => Promise<{ default: ComponentType<unknown> }>;
type PageModule = Record<string, unknown>;

function pageComponent(module: PageModule, exportName: string): ComponentType {
    const component = module[exportName];
    if (!component) {
        throw new Error(`Route module does not export ${exportName}`);
    }
    return component as ComponentType;
}

/** Public lazy route under rootRoute. */
function publicRoute<const TPath extends string, TSearch = Record<string, unknown>>(
    path: TPath,
    loader: ComponentLoader,
    options: Partial<{ validateSearch: (s: Record<string, unknown>) => TSearch }> = {},
) {
    return new Route({
        getParentRoute: () => rootRoute,
        path,
        component: lazyRouteComponent(loader),
        ...options,
    });
}

/** Auth-protected lazy route under rootRoute. */
function protectedRoute<const TPath extends string>(
    path: TPath,
    loader: () => Promise<PageModule>,
    exportName: string,
) {
    return new Route({
        getParentRoute: () => rootRoute,
        path,
        component: lazyRouteComponent(() =>
            loader().then((m) => {
                const Comp = pageComponent(m, exportName);
                return {
                    default: () => (
                        <ProtectedRoute>
                            <Comp />
                        </ProtectedRoute>
                    ),
                };
            }),
        ),
    });
}

/**
 * Admin-protected lazy route — wraps page in AdminLayout sidebar.
 * `scope` defaults to 'platform' (most restrictive): a page must OPT IN to org-level access, so a
 * forgotten scope fails safe (platform-only) rather than exposing a control-plane page to org admins.
 */
function makeAdminRoute<const TPath extends string, TSearch = Record<string, unknown>>(
    path: TPath,
    loader: () => Promise<PageModule>,
    exportName: string,
    options: Partial<{ validateSearch: (s: Record<string, unknown>) => TSearch; scope: AdminRouteScope }> = {},
) {
    const { scope = 'platform', validateSearch } = options;
    return new Route({
        getParentRoute: () => rootRoute,
        path,
        component: lazyRouteComponent(() =>
            loader().then((m) => {
                const Comp = pageComponent(m, exportName);
                return { default: () => renderAdminRoute(scope, <Comp />) };
            }),
        ),
        ...(validateSearch ? { validateSearch } : {}),
    });
}

// otta:begin ottablog
/**
 * Studio route: the writing-first editorial surface at /studio. Gated by CONTENT
 * permissions (posts:update — held by author/editor roles, org admins via *:update,
 * and the platform owner via *:*), never by org:admin or platform admin (unless a
 * sub-route opts into `extraPermissions`, e.g. theme/plugin management, whose
 * mutations require studio admin server-side — see requireStudioAdminForScope).
 * Reuses the blog admin pages inside the StudioShell chrome; the pages resolve
 * their internal links against the active surface (see blogAdminPaths.ts).
 */
function makeStudioRoute<const TPath extends string, TSearch = Record<string, unknown>>(
    path: TPath,
    loader: () => Promise<PageModule>,
    exportName: string,
    options: Partial<{
        validateSearch: (s: Record<string, unknown>) => TSearch;
        /** ANDed with posts:update for sub-routes whose server-side actions require more (org:admin). */
        extraPermissions: string[];
    }> = {},
) {
    const requiredPermissions = ['posts:update', ...(options.extraPermissions ?? [])];
    return new Route({
        getParentRoute: () => rootRoute,
        path,
        component: lazyRouteComponent(() =>
            Promise.all([loader(), import('@/pages/studio/StudioShell')]).then(([m, shell]) => {
                const Comp = pageComponent(m, exportName);
                const { StudioShell } = shell;
                return {
                    default: () => (
                        <ProtectedRoute
                            requiredPermissions={requiredPermissions}
                            fallback={<StudioPrivilegeFallback />}
                        >
                            <StudioShell>
                                <Comp />
                            </StudioShell>
                        </ProtectedRoute>
                    ),
                };
            }),
        ),
        ...(options.validateSearch ? { validateSearch: options.validateSearch } : {}),
    });
}
// otta:end ottablog

// ─── Marketing / app surface ─────────────────────────────────────────────────

const indexRoute = publicRoute('/', () => import('@/pages/home/HomePage').then((m) => ({ default: m.HomePage })));

// otta:begin demo
const docsRoute = publicRoute('/docs/$', () => import('@/pages/docs/DocsPage').then((m) => ({ default: m.DocsPage })));
// otta:end demo
// otta:begin legal
// Legal pages (@ottabase/legal): /legal is the index, /legal/terms, /legal/privacy, ... each document, all from
// ottabase/legal.config.ts. The Worker serves the same documents as JSON and Markdown at /api/legal.
const legalRoute = publicRoute('/legal/$', () =>
    import('@/pages/legal/LegalPage').then((m) => ({ default: m.LegalPage })),
);
// otta:end legal

// otta:begin demo
// Outside the /demo wrapper on purpose: each preview swaps the whole app shell (see LayoutPreviewPage).
const layoutPreviewRoute = publicRoute('/layout-preview/$preset', () =>
    import('@/pages/demo/layout/LayoutPreviewPage').then((m) => ({ default: m.LayoutPreviewPage })),
);
// otta:end demo

// ─── Auth ────────────────────────────────────────────────────────────────────

const loginRoute = publicRoute('/login', () =>
    import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const registerRoute = publicRoute('/register', () =>
    import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const verifyEmailRoute = publicRoute('/verify-email', () =>
    import('@/pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })),
);
const resetPasswordRoute = publicRoute('/reset-password', () =>
    import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);

// ─── User app surface ────────────────────────────────────────────────────────

const userProfileRoute = protectedRoute('/profile', () => import('@/pages/user/UserProfilePage'), 'UserProfilePage');
const userSessionsRoute = protectedRoute('/sessions', () => import('@/pages/user/SessionsPage'), 'SessionsPage');
const userMediaLibraryRoute = protectedRoute(
    '/media-library',
    () => import('@/pages/user/UserMediaLibraryPage'),
    'UserMediaLibraryPage',
);

// ─── Public content (blog, changelog) ────────────────────────────────────────

// otta:begin ottablog
/**
 * Public blog page inside the blog token "room": wraps the component in
 * `<BrandScope name="blog">` so the active blog theme's CSS-variable overrides
 * ([data-brand-scope="blog"], edge-injected and client-applied) re-bind the
 * semantic brand vars for blog subtrees only — never the app shell.
 */
function blogPublicRoute<const TPath extends string>(path: TPath, loader: () => Promise<{ default: ComponentType }>) {
    return publicRoute(path, () =>
        loader().then((m) => {
            const Comp = m.default;
            return {
                default: () => (
                    <BrandScope name="blog">
                        <Comp />
                    </BrandScope>
                ),
            };
        }),
    );
}

const blogListRoute = blogPublicRoute('/blog', () =>
    import('@/pages/blog/BlogListPage').then((m) => ({ default: m.BlogListPage })),
);
const blogDetailRoute = blogPublicRoute('/blog/$slug', () =>
    import('@/pages/blog/BlogDetailPage').then((m) => ({ default: m.BlogDetailPage })),
);
const blogTagArchiveRoute = blogPublicRoute('/blog/tag/$slug', () =>
    import('@/pages/blog/BlogTagArchivePage').then((m) => ({ default: m.BlogTagArchivePage })),
);
const blogCategoryArchiveRoute = blogPublicRoute('/blog/category/$slug', () =>
    import('@/pages/blog/BlogCategoryArchivePage').then((m) => ({ default: m.BlogCategoryArchivePage })),
);
const blogAuthorArchiveRoute = blogPublicRoute('/blog/author/$authorId', () =>
    import('@/pages/blog/BlogAuthorArchivePage').then((m) => ({ default: m.BlogAuthorArchivePage })),
);
const blogSeriesArchiveRoute = blogPublicRoute('/blog/series/$slug', () =>
    import('@/pages/blog/BlogSeriesArchivePage').then((m) => ({ default: m.BlogSeriesArchivePage })),
);
const blogDateArchiveYearRoute = blogPublicRoute('/blog/archive/$year', () =>
    import('@/pages/blog/BlogDateArchivePage').then((m) => ({ default: m.BlogDateArchivePage })),
);
const blogDateArchiveMonthRoute = blogPublicRoute('/blog/archive/$year/$month', () =>
    import('@/pages/blog/BlogDateArchivePage').then((m) => ({ default: m.BlogDateArchivePage })),
);
const changelogListRoute = publicRoute('/changelog', () =>
    import('@/pages/changelog/ChangelogListPage').then((m) => ({ default: m.ChangelogListPage })),
);
const changelogDetailRoute = publicRoute('/changelog/$slug', () =>
    import('@/pages/changelog/ChangelogDetailPage').then((m) => ({ default: m.ChangelogDetailPage })),
);
// otta:end ottablog

// ─── /admin overview ─────────────────────────────────────────────────────────

const adminRoute = makeAdminRoute('/admin', () => import('@/pages/admin/AdminIndexPage'), 'AdminIndexPage', {
    scope: 'org',
});

// ─── /admin/appearance ───────────────────────────────────────────────────────

const adminBrandKitsRoute = makeAdminRoute(
    '/admin/appearance/brand-kits',
    () => import('@/pages/admin/appearance/BrandKitsListPage'),
    'AdminBrandKitsListPage',
);
const adminBrandKitNewRoute = makeAdminRoute(
    '/admin/appearance/brand-kits/new',
    () => import('@/pages/admin/appearance/BrandKitDetailPage'),
    'AdminBrandKitDetailPage',
);
const adminBrandKitDetailRoute = makeAdminRoute(
    '/admin/appearance/brand-kits/$kitId',
    () => import('@/pages/admin/appearance/BrandKitDetailPage'),
    'AdminBrandKitDetailPage',
);
const adminBrandLayoutsRoute = makeAdminRoute(
    '/admin/appearance/layouts',
    () => import('@/pages/admin/appearance/BrandLayoutsPage'),
    'AdminBrandLayoutsPage',
);
const adminMenusRoute = makeAdminRoute(
    '/admin/appearance/menus',
    () => import('@/pages/admin/appearance/MenusListPage'),
    'AdminMenusListPage',
);
const adminMenuNewRoute = makeAdminRoute(
    '/admin/appearance/menus/new',
    () => import('@/pages/admin/appearance/MenuDetailPage'),
    'AdminMenuDetailPage',
);
const adminMenuDetailRoute = makeAdminRoute(
    '/admin/appearance/menus/$menuId',
    () => import('@/pages/admin/appearance/MenuDetailPage'),
    'AdminMenuDetailPage',
);

// ─── /admin/content ──────────────────────────────────────────────────────────

// otta:begin ottablog
const adminBlogRoute = makeAdminRoute(
    '/admin/content/blog',
    () => import('@/pages/admin/content/blog/AdminBlogListPage'),
    'AdminBlogListPage',
    { scope: 'org' },
);
const adminBlogNewRoute = makeAdminRoute(
    '/admin/content/blog/new',
    () => import('@/pages/admin/content/blog/AdminBlogEditorPage'),
    'AdminBlogEditorPage',
    {
        scope: 'org',
        validateSearch: (search: Record<string, unknown>) => ({
            contentType: typeof search.contentType === 'string' ? search.contentType : undefined,
        }),
    },
);
const adminBlogEditRoute = makeAdminRoute(
    '/admin/content/blog/$postId/edit',
    () => import('@/pages/admin/content/blog/AdminBlogEditorPage'),
    'AdminBlogEditorPage',
    { scope: 'org' },
);
// otta:end ottablog
// otta:begin ottalanding
// Landing site content is APP-GLOBAL (platform-owned, like brand) → platform scope (default).
const adminLandingRoute = makeAdminRoute(
    '/admin/content/landing',
    () => import('@/pages/admin/content/landing/AdminLandingSitePage'),
    'AdminLandingSitePage',
);
const adminLandingLeadsRoute = makeAdminRoute(
    '/admin/content/landing/leads',
    () => import('@/pages/admin/content/landing/AdminLandingLeadsPage'),
    'AdminLandingLeadsPage',
);
const adminLandingPageRoute = makeAdminRoute(
    '/admin/content/landing/$pageId',
    () => import('@/pages/admin/content/landing/AdminLandingPageEditorPage'),
    'AdminLandingPageEditorPage',
);
// otta:end ottalanding
// otta:begin ottablog
// Content settings manage APP-GLOBAL theme + renderer plugins → platform scope (default).
const adminBlogSettingsRoute = makeAdminRoute(
    '/admin/content/blog/settings',
    () => import('@/pages/admin/content/blog/AdminBlogSettingsPage'),
    'AdminBlogSettingsPage',
);
const adminBlogTagsRoute = makeAdminRoute(
    '/admin/content/blog/tags',
    () => import('@/pages/admin/content/blog/AdminBlogTagsPage'),
    'AdminBlogTagsPage',
    { scope: 'org' },
);
const adminBlogCategoriesRoute = makeAdminRoute(
    '/admin/content/blog/categories',
    () => import('@/pages/admin/content/blog/AdminBlogCategoriesPage'),
    'AdminBlogCategoriesPage',
    { scope: 'org' },
);
const adminBlogSeriesRoute = makeAdminRoute(
    '/admin/content/blog/series',
    () => import('@/pages/admin/content/blog/AdminBlogSeriesPage'),
    'AdminBlogSeriesPage',
    { scope: 'org' },
);
// ─── /studio — writing-first editorial surface (content-permission gated) ────

const studioRoute = makeStudioRoute(
    '/studio',
    () => import('@/pages/admin/content/blog/AdminBlogListPage'),
    'AdminBlogListPage',
);
const studioNewRoute = makeStudioRoute(
    '/studio/new',
    () => import('@/pages/admin/content/blog/AdminBlogEditorPage'),
    'AdminBlogEditorPage',
    {
        validateSearch: (search: Record<string, unknown>) => ({
            contentType: typeof search.contentType === 'string' ? search.contentType : undefined,
        }),
    },
);
const studioEditRoute = makeStudioRoute(
    '/studio/$postId/edit',
    () => import('@/pages/admin/content/blog/AdminBlogEditorPage'),
    'AdminBlogEditorPage',
);
const studioTagsRoute = makeStudioRoute(
    '/studio/tags',
    () => import('@/pages/admin/content/blog/AdminBlogTagsPage'),
    'AdminBlogTagsPage',
);
const studioCategoriesRoute = makeStudioRoute(
    '/studio/categories',
    () => import('@/pages/admin/content/blog/AdminBlogCategoriesPage'),
    'AdminBlogCategoriesPage',
);
const studioSeriesRoute = makeStudioRoute(
    '/studio/series',
    () => import('@/pages/admin/content/blog/AdminBlogSeriesPage'),
    'AdminBlogSeriesPage',
);
const studioSettingsRoute = makeStudioRoute(
    '/studio/settings',
    () => import('@/pages/admin/content/blog/AdminBlogSettingsPage'),
    'AdminBlogSettingsPage',
    // Theme/plugin management is studio-ADMIN only server-side (requireStudioAdminForScope:
    // platform admin, or org:admin of the target org) — a plain author/editor otherwise gets a
    // page that silently degrades to a read-only skeleton and 403s on every action.
    { extraPermissions: ['org:admin'] },
);

const adminChangelogRoute = makeAdminRoute(
    '/admin/content/changelog',
    () => import('@/pages/admin/content/changelog/AdminChangelogListPage'),
    'AdminChangelogListPage',
    { scope: 'org' },
);
// otta:end ottablog
const adminMediaLibraryRoute = makeAdminRoute(
    '/admin/content/media',
    () => import('@/pages/admin/content/MediaLibraryPage'),
    'AdminMediaLibraryPage',
    { scope: 'org' },
);

// ─── /admin/access ───────────────────────────────────────────────────────────

const adminUsersRoute = makeAdminRoute(
    '/admin/access/users',
    () => import('@/pages/admin/access/users/UserManagementPage'),
    'UserManagementPage',
);
const adminUserRBACRoute = makeAdminRoute(
    '/admin/access/users/$userId/rbac',
    () => import('@/pages/admin/access/users/UserRBACPage'),
    'UserRBACPage',
);
// Organizations pages are org-scoped: reads are RLS-filtered to the caller's memberships (a platform
// owner sees all via '*:*'); a plain org admin manages only their own org.
const adminOrganizationsRoute = makeAdminRoute(
    '/admin/access/organizations',
    () => import('@/pages/admin/access/organizations/OrganizationsPage'),
    'OrganizationsPage',
    { scope: 'org' },
);
const adminOrganizationNewRoute = makeAdminRoute(
    '/admin/access/organizations/new',
    () => import('@/pages/admin/access/organizations/OrganizationRegistrationPage'),
    'OrganizationRegistrationPage',
    { scope: 'org' },
);
const adminOrganizationMembersRoute = makeAdminRoute(
    '/admin/access/organizations/$organizationId/members',
    () => import('@/pages/admin/access/organizations/OrganizationMembersPage'),
    'OrganizationMembersPage',
    { scope: 'org' },
);
const adminOrganizationSettingsRoute = makeAdminRoute(
    '/admin/access/organizations/$organizationId/settings',
    () => import('@/pages/admin/access/organizations/OrganizationSettingsPage'),
    'OrganizationSettingsPage',
    { scope: 'org' },
);
const adminRBACRoute = makeAdminRoute(
    '/admin/access/rbac',
    () => import('@/pages/admin/access/rbac/RBACAdminPage'),
    'RBACAdminPage',
);
const adminRBACRolesRoute = makeAdminRoute(
    '/admin/access/rbac/roles',
    () => import('@/pages/admin/access/rbac/RBACRolesPage'),
    'RBACRolesPage',
);
const adminRBACPermissionsRoute = makeAdminRoute(
    '/admin/access/rbac/permissions',
    () => import('@/pages/admin/access/rbac/PermissionsMatrixPage'),
    'PermissionsMatrixPage',
);

// ─── /admin/security ─────────────────────────────────────────────────────────

// Audit log reads are derived from the caller's actual memberships (worker/routes/audit.ts), so
// org admins see their own org's rows; a platform owner sees across orgs.
const adminAuditRoute = makeAdminRoute(
    '/admin/security/audit',
    () => import('@/pages/admin/security/audit/AuditLogViewerPage'),
    'AuditLogViewerPage',
    { scope: 'org' },
);
const adminSecurityRLSRoute = makeAdminRoute(
    '/admin/security/rls',
    () => import('@/pages/admin/security/RLSInspectorPage'),
    'RLSInspectorPage',
);
const adminKillSwitchesRoute = makeAdminRoute(
    '/admin/security/kill-switches',
    () => import('@/pages/admin/security/KillSwitchesPage'),
    'default',
);

// ─── /admin/infrastructure ───────────────────────────────────────────────────

const adminDatabaseRoute = makeAdminRoute(
    '/admin/infrastructure/database',
    () => import('@/pages/admin/infrastructure/DatabasePage'),
    'AdminDbPage',
    {
        validateSearch: (search: Record<string, unknown>) => ({
            table: (search.table as string) || '',
            page: Number(search.page) || 1,
            perPage: Number(search.perPage) || 25,
        }),
    },
);
// CrudHub: generic admin data screens. Org admins reach the directory and their org-scoped
// models; the worker filters system-scoped models out for them (scope 'org' here, server decides).
const crudHubLoader = () => import('@/pages/admin/infrastructure/crudhub/CrudHubPages');
const adminCrudHubRoute = makeAdminRoute('/admin/crudhub', crudHubLoader, 'CrudHubDirectoryPage', { scope: 'org' });
const adminCrudHubListRoute = makeAdminRoute('/admin/crudhub/$model', crudHubLoader, 'CrudHubListPage', {
    scope: 'org',
    validateSearch: (search: Record<string, unknown>) => {
        const perPage = Number(search.perPage);
        const sort = typeof search.sort === 'string' && search.sort ? search.sort : undefined;
        return {
            page: Math.max(1, Number(search.page) || 1),
            q: typeof search.q === 'string' ? search.q : '',
            sort,
            dir: sort ? (search.dir === 'desc' ? ('desc' as const) : ('asc' as const)) : undefined,
            perPage: Number.isInteger(perPage) && perPage > 0 ? Math.min(perPage, 100) : undefined,
        };
    },
});
const adminCrudHubNewRoute = makeAdminRoute('/admin/crudhub/$model/new', crudHubLoader, 'CrudHubFormPage', {
    scope: 'org',
});
const adminCrudHubDetailRoute = makeAdminRoute('/admin/crudhub/$model/$id', crudHubLoader, 'CrudHubDetailPage', {
    scope: 'org',
});
const adminCrudHubEditRoute = makeAdminRoute('/admin/crudhub/$model/$id/edit', crudHubLoader, 'CrudHubFormPage', {
    scope: 'org',
});
const adminMigrationsRoute = makeAdminRoute(
    '/admin/infrastructure/migrations',
    () => import('@/pages/admin/infrastructure/MigrationsPage'),
    'MigrationStatusPage',
);
const adminQueuesRoute = makeAdminRoute(
    '/admin/infrastructure/queues',
    () => import('@/pages/admin/infrastructure/QueuesPage'),
    'AdminQueuePage',
);
const adminCronRoute = makeAdminRoute(
    '/admin/infrastructure/cron',
    () => import('@/pages/admin/infrastructure/CronPage'),
    'AdminCronPage',
);
const adminDevMailRoute = makeAdminRoute(
    '/admin/infrastructure/dev-mail',
    () => import('@/pages/admin/infrastructure/DevMailPage'),
    'AdminDevMailPage',
);
const adminEmailRoute = makeAdminRoute(
    '/admin/infrastructure/email',
    () => import('@/pages/admin/infrastructure/EmailPage'),
    'AdminEmailPage',
);
// otta:begin ottaai
const adminAiGatewayRoute = makeAdminRoute(
    '/admin/infrastructure/ai',
    () => import('@/pages/admin/infrastructure/AiPage'),
    'AdminAiPage',
);
// otta:end ottaai

// ─── /admin/growth ───────────────────────────────────────────────────────────

// Analytics Engine totals are platform-wide (no org), so the worker APIs are system-admin only.
const adminAnalyticsRoute = makeAdminRoute(
    '/admin/growth/analytics',
    () => import('@/pages/analytics/AnalyticsPage'),
    'AnalyticsPage',
    {
        validateSearch: (search: Record<string, unknown>) => ({
            tab:
                (search.tab as string) === 'referrals'
                    ? 'referrals'
                    : (search.tab as string) === 'shortlinks'
                      ? 'shortlinks'
                      : 'core',
        }),
    },
);

// otta:begin shortlinks
// Shortlink management: the CRUD APIs are system-admin only (requireAdminAccess, system scope).
const adminShortlinksRoute = makeAdminRoute(
    '/admin/growth/shortlinks',
    () => import('@/pages/shortlinks/ShortlinksPage'),
    'ShortlinksPage',
);
// otta:end shortlinks

// otta:begin ottaai
// AI providers: an ORG admin manages the workspace key, and any admin manages their own.
// The server re-checks ` ai:manage ` on every org-scoped mutation, so this scope is a UX
// affordance only — a route gate is not an authorization boundary.
const adminAiProvidersRoute = makeAdminRoute(
    '/admin/growth/ai-providers',
    () => import('@/pages/admin/growth/AiProvidersPage'),
    'AiProvidersPage',
    { scope: 'org' },
);
// otta:end ottaai

// Premium Packages (@ottabase/premium). The control plane is core — an operator handed a
// license key needs somewhere to put it even before anything is installed.
const adminPremiumRoute = makeAdminRoute(
    '/admin/growth/premium',
    () => import('@/pages/admin/growth/PremiumPackagesPage'),
    'PremiumPackagesPage',
);

// ─── /demo gallery ───────────────────────────────────────────────────────────

// otta:begin demo
const demoLayoutRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/demo',
    component: lazyRouteComponent(() => import('@/pages/demo/DemoLayout').then((m) => ({ default: m.DemoLayout }))),
});

/**
 * Compact helper for the (very repetitive) /demo child routes. A demo listed in
 * DEMO_ACCOUNT_GATES renders behind DemoAccountGate: the page when signed in, a sign-up teaser
 * otherwise.
 */
function demoChild<const TPath extends string>(path: TPath, loader: () => Promise<PageModule>, exportName: string) {
    const gate = DEMO_ACCOUNT_GATES[path === '/' ? '/demo' : `/demo/${path}`];
    return new Route({
        getParentRoute: () => demoLayoutRoute,
        path,
        component: lazyRouteComponent(async () => {
            if (!gate) return { default: pageComponent(await loader(), exportName) };
            const [m, { DemoAccountGate }] = await Promise.all([loader(), import('@/pages/demo/DemoAccountGate')]);
            const Page = pageComponent(m, exportName);
            return {
                default: () => (
                    <DemoAccountGate gate={gate}>
                        <Page />
                    </DemoAccountGate>
                ),
            };
        }),
    });
}

const demoChildren = [
    demoChild('/', () => import('@/pages/demo/DemoIndexPage'), 'DemoIndexPage'),
    demoChild('pro', () => import('@/pages/demo/pro/ProDemoPage'), 'ProDemoPage'),
    demoChild('mantine', () => import('@/pages/demo/mantine/MantineDemoRoute'), 'MantineDemoRoute'),
    demoChild('ui', () => import('@/pages/demo/ui/UiDemoPage'), 'UiDemoPage'),
    demoChild('ottaeditor', () => import('@/pages/demo/ottaeditor/OttaEditorDemoPage'), 'OttaEditorDemoPage'),
    demoChild('ottaorm', () => import('@/pages/demo/ottaorm/OttaORMDemoPage'), 'OttaORMDemoPage'),
    demoChild('ottaforms', () => import('@/pages/demo/ottaforms/OttaFormsDemoPage'), 'OttaFormsDemoPage'),
    demoChild('ottaselect', () => import('@/pages/demo/ottaselect/OttaSelectDemoPage'), 'OttaSelectDemoPage'),
    demoChild('ui-datatable', () => import('@/pages/demo/ui-datatable/DataTableDemoPage'), 'DataTableDemoPage'),
    demoChild('charts', () => import('@/pages/demo/charts/ChartsDemoPage'), 'ChartsDemoPage'),
    demoChild('split-pane', () => import('@/pages/demo/split-pane/SplitPaneDemoPage'), 'SplitPaneDemoPage'),
    demoChild('ui-cropper', () => import('@/pages/demo/ui-cropper/CropperDemoPage'), 'CropperDemoPage'),
    demoChild('logger', () => import('@/pages/demo/logger/LoggerDemoPage'), 'LoggerDemoPage'),
    demoChild('i18n', () => import('@/pages/demo/i18n/I18nDemoPage'), 'I18nDemoPage'),
    demoChild('breadcrumbs', () => import('@/pages/demo/breadcrumbs/BreadcrumbsDemoPage'), 'BreadcrumbsDemoPage'),
    demoChild('timezone', () => import('@/pages/demo/timezone/TimezoneDemoPage'), 'TimezoneDemoPage'),
    demoChild('cloudflare', () => import('@/pages/demo/cloudflare/CloudflareDemoIndexPage'), 'CloudflareDemoIndexPage'),
    demoChild('cloudflare/d1', () => import('@/pages/demo/cloudflare/CloudflareD1DemoPage'), 'CloudflareD1DemoPage'),
    demoChild('cloudflare/kv', () => import('@/pages/demo/cloudflare/CloudflareKVDemoPage'), 'CloudflareKVDemoPage'),
    demoChild('cloudflare/r2', () => import('@/pages/demo/cloudflare/CloudflareR2DemoPage'), 'CloudflareR2DemoPage'),
    demoChild(
        'cloudflare/file-upload',
        () => import('@/pages/demo/cloudflare/CloudflareFileUploadDemoPage'),
        'CloudflareFileUploadDemoPage',
    ),
    demoChild(
        'cloudflare/images',
        () => import('@/pages/demo/cloudflare/CloudflareImagesDemoPage'),
        'CloudflareImagesDemoPage',
    ),
    demoChild(
        'cloudflare/hyperdrive',
        () => import('@/pages/demo/cloudflare/CloudflareHyperdriveDemoPage'),
        'CloudflareHyperdriveDemoPage',
    ),
    demoChild(
        'cloudflare/queues',
        () => import('@/pages/demo/cloudflare/CloudflareQueuesDemoPage'),
        'CloudflareQueuesDemoPage',
    ),
    demoChild(
        'cloudflare/rate-limiting',
        () => import('@/pages/demo/cloudflare/CloudflareRateLimitingDemoPage'),
        'CloudflareRateLimitingDemoPage',
    ),
    demoChild(
        'cloudflare/realtime',
        () => import('@/pages/demo/cloudflare/CloudflareRealtimeDemoPage'),
        'CloudflareRealtimeDemoPage',
    ),
    demoChild('cloudflare/ai', () => import('@/pages/demo/cloudflare/CloudflareAIDemoPage'), 'CloudflareAIDemoPage'),
    demoChild('cloudflare/pdf', () => import('@/pages/demo/cloudflare/CloudflarePdfDemoPage'), 'CloudflarePdfDemoPage'),
    demoChild(
        'cloudflare/pdf/playground',
        () => import('@/pages/demo/cloudflare/CloudflarePdfPackageDemoPage'),
        'CloudflarePdfPackageDemoPage',
    ),
    demoChild(
        'cloudflare/screenshot',
        () => import('@/pages/demo/cloudflare/CloudflareScreenshotDemoPage'),
        'CloudflareScreenshotDemoPage',
    ),
    demoChild('api', () => import('@/pages/demo/api/ApiDemoPage'), 'ApiDemoPage'),
    demoChild('theming', () => import('@/pages/demo/theming/ThemingDemoPage'), 'ThemingDemoPage'),
    demoChild('state', () => import('@/pages/demo/state/StateDemoPage'), 'StateDemoPage'),
    demoChild('renderer', () => import('@/pages/demo/renderer/RendererDemoPage'), 'RendererDemoPage'),
    demoChild('email', () => import('@/pages/demo/email/EmailDemoPage'), 'EmailDemoPage'),
    demoChild('codeblock', () => import('@/pages/demo/CodeBlockDemoPage'), 'CodeBlockDemoPage'),
    demoChild(
        'notifications',
        () => import('@/pages/demo/notifications/DemoNotificationsPage'),
        'DemoNotificationsPage',
    ),
    demoChild('ottadate', () => import('@/pages/demo/ottadate/OttaDateDemoPage'), 'OttaDateDemoPage'),
    demoChild('spotlight', () => import('@/pages/demo/spotlight/SpotlightDemoPage'), 'SpotlightDemoPage'),
    demoChild('menus', () => import('@/pages/demo/menus/MenusDemoPage'), 'MenusDemoPage'),
    demoChild('medialibrary', () => import('@/pages/demo/medialibrary/MediaLibraryDemoPage'), 'MediaLibraryDemoPage'),
    demoChild('analytics', () => import('@/pages/demo/analytics/AnalyticsDemoPage'), 'AnalyticsDemoPage'),
    demoChild('apikeys', () => import('@/pages/demo/apikeys/ApiKeysDemoPage'), 'ApiKeysDemoPage'),
    demoChild('legal', () => import('@/pages/demo/legal/LegalDemoPage'), 'LegalDemoPage'),
    demoChild('auth', () => import('@/pages/demo/auth/AuthDemoPage'), 'AuthDemoPage'),
    demoChild('brand-engine', () => import('@/pages/demo/brand-engine/BrandEngineDemoPage'), 'BrandEngineDemoPage'),
    demoChild('layout', () => import('@/pages/demo/layout/LayoutDemoPage'), 'LayoutDemoPage'),
    demoChild('comments', () => import('@/pages/demo/comments/CommentsDemoPage'), 'CommentsDemoPage'),
    demoChild('cron', () => import('@/pages/demo/cron/CronDemoPage'), 'CronDemoPage'),
    demoChild('ui-tailwind', () => import('@/pages/demo/ui-tailwind/UiTailwindDemoPage'), 'UiTailwindDemoPage'),
    demoChild('scripts', () => import('@/pages/demo/scripts/ScriptsDemoPage'), 'ScriptsDemoPage'),
    demoChild('config', () => import('@/pages/demo/config/ConfigDemoPage'), 'ConfigDemoPage'),
];
demoLayoutRoute.addChildren(demoChildren);
// otta:end demo

// ─── Route assembly ──────────────────────────────────────────────────────────

// Always-on routes (core platform). Note: brandEngine and ottamenu are core packages.
const coreRoutes = [
    indexRoute,
    docsRoute, // otta:only demo
    legalRoute, // otta:only legal
    layoutPreviewRoute, // otta:only demo
    demoLayoutRoute, // otta:only demo
    changelogListRoute, // otta:only ottablog
    changelogDetailRoute, // otta:only ottablog
    loginRoute,
    registerRoute,
    verifyEmailRoute,
    resetPasswordRoute,
    userProfileRoute,
    userSessionsRoute,
    // Admin
    adminRoute,
    adminAnalyticsRoute,
    adminBrandKitsRoute,
    adminBrandKitNewRoute,
    adminBrandKitDetailRoute,
    adminBrandLayoutsRoute,
    adminMenusRoute,
    adminMenuNewRoute,
    adminMenuDetailRoute,
    adminChangelogRoute, // otta:only ottablog
    adminUsersRoute,
    adminUserRBACRoute,
    adminOrganizationsRoute,
    adminOrganizationNewRoute,
    adminOrganizationMembersRoute,
    adminOrganizationSettingsRoute,
    adminRBACRoute,
    adminRBACRolesRoute,
    adminRBACPermissionsRoute,
    adminAuditRoute,
    adminSecurityRLSRoute,
    adminKillSwitchesRoute,
    adminDatabaseRoute,
    adminCrudHubRoute,
    adminCrudHubListRoute,
    adminCrudHubNewRoute,
    adminCrudHubDetailRoute,
    adminCrudHubEditRoute,
    adminMigrationsRoute,
    adminQueuesRoute,
    adminCronRoute,
    adminDevMailRoute,
    adminEmailRoute,
    adminPremiumRoute,
];

// Admin pages that PACKAGES contribute, from their client descriptors
// (src/ottabase/config/packages.ts): registering a package's page touches that file only.
// A Premium Package's page is gated on being INSTALLED, never on being LICENSED: an
// unlicensed page still renders, with its upsell, because a bookmarked link that 404s the day
// a license lapses explains nothing and the operator needs a route to the screen that fixes
// it. The server refuses the underlying data either way.
const packageAdminRoutes = PACKAGE_ADMIN_PAGES.map((page) =>
    makeAdminRoute(page.path, page.load, page.exportName, { scope: page.scope }),
);

// The other pages packages contribute (`/billing`, `/status`), from the same descriptors.
const packagePageRoutes = PACKAGE_ROUTES.map((page) =>
    page.access === 'public'
        ? publicRoute(page.path, () =>
              page.load().then((m) => ({ default: pageComponent(m, page.exportName) as ComponentType<unknown> })),
          )
        : protectedRoute(page.path, page.load, page.exportName),
);

// Routes that depend on optional packages. Each line is marked for `otta strip <pkg>`; the type
// annotation keeps the list well-typed when it is stripped empty.
const packageRoutes: { route: AnyRoute; pkg: string }[] = [
    // otta:begin shortlinks
    { route: adminShortlinksRoute, pkg: 'shortlinks' },
    // otta:end shortlinks
    // otta:begin ottablog
    { route: blogListRoute, pkg: 'ottablog' },
    { route: blogDetailRoute, pkg: 'ottablog' },
    { route: blogTagArchiveRoute, pkg: 'ottablog' },
    { route: blogCategoryArchiveRoute, pkg: 'ottablog' },
    { route: blogSeriesArchiveRoute, pkg: 'ottablog' },
    { route: blogAuthorArchiveRoute, pkg: 'ottablog' },
    { route: blogDateArchiveYearRoute, pkg: 'ottablog' },
    { route: blogDateArchiveMonthRoute, pkg: 'ottablog' },
    { route: adminBlogRoute, pkg: 'ottablog' },
    { route: adminBlogNewRoute, pkg: 'ottablog' },
    { route: adminBlogEditRoute, pkg: 'ottablog' },
    { route: adminBlogSettingsRoute, pkg: 'ottablog' },
    { route: adminBlogTagsRoute, pkg: 'ottablog' },
    { route: adminBlogCategoriesRoute, pkg: 'ottablog' },
    { route: adminBlogSeriesRoute, pkg: 'ottablog' },
    { route: studioRoute, pkg: 'ottablog' },
    { route: studioNewRoute, pkg: 'ottablog' },
    { route: studioEditRoute, pkg: 'ottablog' },
    { route: studioTagsRoute, pkg: 'ottablog' },
    { route: studioCategoriesRoute, pkg: 'ottablog' },
    { route: studioSeriesRoute, pkg: 'ottablog' },
    { route: studioSettingsRoute, pkg: 'ottablog' },
    // otta:end ottablog
    // otta:begin ottalanding
    { route: adminLandingRoute, pkg: 'ottalanding' },
    { route: adminLandingLeadsRoute, pkg: 'ottalanding' },
    { route: adminLandingPageRoute, pkg: 'ottalanding' },
    // otta:end ottalanding
    // otta:begin ottaai
    { route: adminAiProvidersRoute, pkg: 'ottaai' },
    { route: adminAiGatewayRoute, pkg: 'ottaai' },
    // otta:end ottaai
];

const routes = [
    ...coreRoutes,
    ...packageRoutes.filter((r) => PACKAGES_ENABLED[r.pkg]).map((r) => r.route),
    ...packageAdminRoutes,
    ...packagePageRoutes,
    ...(MEDIA_LIBRARY_ENABLED ? [userMediaLibraryRoute, adminMediaLibraryRoute] : []),
];

// A package page at a path the app already routes would be shadowed without a word: refuse at boot.
const routedPaths = new Set<string>();
for (const route of routes) {
    const { path } = route.options as { path: string };
    if (routedPaths.has(path))
        throw new Error(`[router] Two pages route ${path}; a package and the app cannot share it.`);
    routedPaths.add(path);
}

const routeTree = rootRoute.addChildren(routes);

export const router = new Router({
    routeTree,
    history: createBrowserHistory(),
    defaultPendingComponent: RouteLoadingFallback,
    defaultPendingMs: 0,
});

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}
