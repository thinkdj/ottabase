import { AdminLayout } from '@/components/admin/AdminLayout';
import { NotFoundPage } from '@/components/NotFoundPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RouteLoadingFallback } from '@/components/RouteLoadingFallback';
import { usePageViewTracking } from '@/hooks/usePageViewTracking';
import { ConfigurableLayout } from '@/ottabase/components/ConfigurableLayout';
import { MEDIA_LIBRARY_ENABLED, PACKAGES_ENABLED } from '@/ottabase/config';
import { BrandPathSync, LayoutResolver } from '@ottabase/brand-engine-react';
import { tanstackRouterAdapter } from '@ottabase/brand-engine-react/routers';
import { Toaster } from '@ottabase/ui-shadcn';
import {
    createBrowserHistory,
    lazyRouteComponent,
    Navigate,
    Outlet,
    RootRoute,
    Route,
    Router,
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
            <Toaster />
            <BrandPathSync pathname={pathname} />
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

/** Public lazy route under rootRoute. */
function publicRoute(
    path: string,
    loader: ComponentLoader,
    options: Partial<{ validateSearch: (s: Record<string, unknown>) => unknown }> = {},
) {
    return new Route({
        getParentRoute: () => rootRoute,
        path,
        component: lazyRouteComponent(loader),
        ...options,
    });
}

/** Auth-protected lazy route under rootRoute. */
function protectedRoute(path: string, loader: () => Promise<Record<string, ComponentType>>, exportName: string) {
    return new Route({
        getParentRoute: () => rootRoute,
        path,
        component: lazyRouteComponent(() =>
            loader().then((m) => {
                const Comp = m[exportName]!;
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
function makeAdminRoute(
    path: string,
    loader: () => Promise<Record<string, ComponentType>>,
    exportName: string,
    options: Partial<{ validateSearch: (s: Record<string, unknown>) => unknown; scope: AdminRouteScope }> = {},
) {
    const { scope = 'platform', validateSearch } = options;
    return new Route({
        getParentRoute: () => rootRoute,
        path,
        component: lazyRouteComponent(() =>
            loader().then((m) => {
                const Comp = m[exportName]!;
                return { default: () => renderAdminRoute(scope, <Comp />) };
            }),
        ),
        ...(validateSearch ? { validateSearch } : {}),
    });
}

/**
 * Studio route: the writing-first editorial surface at /studio. Gated by CONTENT
 * permissions (posts:update — held by author/editor roles, org admins via *:update,
 * and the platform owner via *:*), never by org:admin or platform admin. Reuses the
 * blog admin pages inside the StudioShell chrome; the pages resolve their internal
 * links against the active surface (see blogAdminPaths.ts).
 */
function makeStudioRoute(
    path: string,
    loader: () => Promise<Record<string, ComponentType>>,
    exportName: string,
    options: Partial<{ validateSearch: (s: Record<string, unknown>) => unknown }> = {},
) {
    return new Route({
        getParentRoute: () => rootRoute,
        path,
        component: lazyRouteComponent(() =>
            Promise.all([loader(), import('@/pages/studio/StudioShell')]).then(([m, shell]) => {
                const Comp = m[exportName]!;
                const { StudioShell } = shell;
                return {
                    default: () => (
                        <ProtectedRoute requiredPermissions={['posts:update']} fallback={<AdminPrivilegeFallback />}>
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

// ─── Marketing / app surface ─────────────────────────────────────────────────

const indexRoute = publicRoute('/', () => import('@/pages/home/HomePage').then((m) => ({ default: m.HomePage })));

const docsRoute = publicRoute('/docs/$', () => import('@/pages/docs/DocsPage').then((m) => ({ default: m.DocsPage })));

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

const dashboardRoute = protectedRoute('/dashboard', () => import('@/pages/auth/DashboardPage'), 'DashboardPage');
const userProfileRoute = protectedRoute('/profile', () => import('@/pages/user/UserProfilePage'), 'UserProfilePage');
const userMediaLibraryRoute = protectedRoute(
    '/media-library',
    () => import('@/pages/user/UserMediaLibraryPage'),
    'UserMediaLibraryPage',
);

const analyticsRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/analytics',
    validateSearch: (search: Record<string, unknown>) => ({
        tab:
            (search.tab as string) === 'referrals'
                ? 'referrals'
                : (search.tab as string) === 'shortlinks'
                  ? 'shortlinks'
                  : 'core',
    }),
    component: lazyRouteComponent(() =>
        import('@/pages/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
    ),
});

const shortlinksRoute = publicRoute('/shortlinks', () =>
    import('@/pages/shortlinks/ShortlinksPage').then((m) => ({ default: m.ShortlinksPage })),
);
const referralsRoute = publicRoute('/referrals', () =>
    import('@/pages/referrals/ReferralsPage').then((m) => ({ default: m.ReferralsPage })),
);

// ─── Public content (blog, changelog) ────────────────────────────────────────

const blogListRoute = publicRoute('/blog', () =>
    import('@/pages/blog/BlogListPage').then((m) => ({ default: m.BlogListPage })),
);
const blogDetailRoute = publicRoute('/blog/$slug', () =>
    import('@/pages/blog/BlogDetailPage').then((m) => ({ default: m.BlogDetailPage })),
);
const blogTagArchiveRoute = publicRoute('/blog/tag/$slug', () =>
    import('@/pages/blog/BlogTagArchivePage').then((m) => ({ default: m.BlogTagArchivePage })),
);
const blogCategoryArchiveRoute = publicRoute('/blog/category/$slug', () =>
    import('@/pages/blog/BlogCategoryArchivePage').then((m) => ({ default: m.BlogCategoryArchivePage })),
);
const blogSeriesArchiveRoute = publicRoute('/blog/series/$slug', () =>
    import('@/pages/blog/BlogSeriesArchivePage').then((m) => ({ default: m.BlogSeriesArchivePage })),
);
const changelogListRoute = publicRoute('/changelog', () =>
    import('@/pages/changelog/ChangelogListPage').then((m) => ({ default: m.ChangelogListPage })),
);
const changelogDetailRoute = publicRoute('/changelog/$slug', () =>
    import('@/pages/changelog/ChangelogDetailPage').then((m) => ({ default: m.ChangelogDetailPage })),
);

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
const adminMenuDetailRoute = makeAdminRoute(
    '/admin/appearance/menus/$menuId',
    () => import('@/pages/admin/appearance/MenuDetailPage'),
    'AdminMenuDetailPage',
);
const adminThemeGeneratorRoute = makeAdminRoute(
    '/admin/appearance/theme-generator',
    () => import('@/pages/admin/appearance/ThemeGeneratorRedirect'),
    'ThemeGeneratorRedirect',
);

// ─── /admin/content ──────────────────────────────────────────────────────────

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
// Blog Studio manages APP-GLOBAL theme + renderer plugins → platform scope (default).
const adminBlogStudioRoute = makeAdminRoute(
    '/admin/content/blog/studio',
    () => import('@/pages/admin/content/blog/AdminBlogStudioPage'),
    'AdminBlogStudioPage',
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
const studioThemesRoute = makeStudioRoute(
    '/studio/themes',
    () => import('@/pages/admin/content/blog/AdminBlogStudioPage'),
    'AdminBlogStudioPage',
);

const adminChangelogRoute = makeAdminRoute(
    '/admin/content/changelog',
    () => import('@/pages/admin/content/changelog/AdminChangelogListPage'),
    'AdminChangelogListPage',
    { scope: 'org' },
);
// Changelog new/edit redirect to blog editor with contentType=changelog.
// Cast Navigate target: routes built via makeAdminRoute don't expose path as a
// string literal in the inferred route tree, so the Register types here are
// incomplete. The runtime path is correct.
const adminChangelogNewRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/content/changelog/new',
    component: () => (
        <Navigate to={'/admin/content/blog/new' as never} search={{ contentType: 'changelog' } as never} />
    ),
});
const adminChangelogEditRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/content/changelog/$entryId/edit',
    component: () => {
        const params = window.location.pathname.match(/\/admin\/content\/changelog\/([^/]+)\/edit/);
        const entryId = params?.[1] ?? '';
        return <Navigate to={'/admin/content/blog/$postId/edit' as never} params={{ postId: entryId } as never} />;
    },
});
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

// ─── /admin/growth ───────────────────────────────────────────────────────────

// Referrals dashboard shows the viewer's OWN referral stats (user-scoped), so any admin may open it.
const adminReferralsRoute = makeAdminRoute(
    '/admin/growth/referrals',
    () => import('@/pages/admin/growth/ReferralsPage'),
    'AdminReferralsPage',
    { scope: 'org' },
);

// ─── /demo gallery ───────────────────────────────────────────────────────────

const demoLayoutRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/demo',
    component: lazyRouteComponent(() => import('@/pages/demo/DemoLayout').then((m) => ({ default: m.DemoLayout }))),
});

/** Compact helper for the (very repetitive) /demo child routes. */
function demoChild(path: string, loader: () => Promise<Record<string, ComponentType>>, exportName: string) {
    return new Route({
        getParentRoute: () => demoLayoutRoute,
        path,
        component: lazyRouteComponent(() => loader().then((m) => ({ default: m[exportName]! }))),
    });
}

const demoChildren = [
    demoChild('/', () => import('@/pages/demo/DemoIndexPage'), 'DemoIndexPage'),
    demoChild('mantine', () => import('@/pages/demo/mantine/MantineDemoRoute'), 'MantineDemoRoute'),
    demoChild('shadcn', () => import('@/pages/demo/shadcn/ShadcnDemoPage'), 'ShadcnDemoPage'),
    demoChild('ottaeditor', () => import('@/pages/demo/ottaeditor/OttaEditorDemoPage'), 'OttaEditorDemoPage'),
    demoChild('ottaorm', () => import('@/pages/demo/ottaorm/OttaORMDemoPage'), 'OttaORMDemoPage'),
    demoChild('ottaforms', () => import('@/pages/demo/ottaforms/OttaFormsDemoPage'), 'OttaFormsDemoPage'),
    demoChild('ottaselect', () => import('@/pages/demo/ottaselect/OttaSelectDemoPage'), 'OttaSelectDemoPage'),
    demoChild('ui-datatable', () => import('@/pages/demo/ui-datatable/DataTableDemoPage'), 'DataTableDemoPage'),
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
    demoChild('auth', () => import('@/pages/demo/auth/AuthDemoPage'), 'AuthDemoPage'),
    demoChild('brand-engine', () => import('@/pages/demo/brand-engine/BrandEngineDemoPage'), 'BrandEngineDemoPage'),
    demoChild('layout', () => import('@/pages/demo/layout/LayoutDemoPage'), 'LayoutDemoPage'),
    demoChild('comments', () => import('@/pages/demo/comments/CommentsDemoPage'), 'CommentsDemoPage'),
    demoChild('cron', () => import('@/pages/demo/cron/CronDemoPage'), 'CronDemoPage'),
    demoChild('ui-tailwind', () => import('@/pages/demo/ui-tailwind/UiTailwindDemoPage'), 'UiTailwindDemoPage'),
    demoChild('ui-components', () => import('@/pages/demo/ui-components/UiComponentsDemoPage'), 'UiComponentsDemoPage'),
    demoChild('ui-base', () => import('@/pages/demo/ui-base/UiBaseDemoPage'), 'UiBaseDemoPage'),
    demoChild('scripts', () => import('@/pages/demo/scripts/ScriptsDemoPage'), 'ScriptsDemoPage'),
    demoChild('config', () => import('@/pages/demo/config/ConfigDemoPage'), 'ConfigDemoPage'),
];
demoLayoutRoute.addChildren(demoChildren);

// ─── Route assembly ──────────────────────────────────────────────────────────

// Always-on routes (core platform). Note: brandEngine and ottamenu are core packages.
const coreRoutes = [
    indexRoute,
    docsRoute,
    demoLayoutRoute,
    changelogListRoute,
    changelogDetailRoute,
    loginRoute,
    registerRoute,
    verifyEmailRoute,
    resetPasswordRoute,
    dashboardRoute,
    userProfileRoute,
    analyticsRoute,
    // Admin
    adminRoute,
    adminBrandKitsRoute,
    adminBrandKitNewRoute,
    adminBrandKitDetailRoute,
    adminBrandLayoutsRoute,
    adminMenusRoute,
    adminMenuDetailRoute,
    adminThemeGeneratorRoute,
    adminChangelogRoute,
    adminChangelogNewRoute,
    adminChangelogEditRoute,
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
    adminMigrationsRoute,
    adminQueuesRoute,
    adminCronRoute,
    adminDevMailRoute,
    adminEmailRoute,
];

// Routes that depend on optional packages.
const packageRoutes = [
    { route: shortlinksRoute, pkg: 'shortlinks' as const },
    { route: referralsRoute, pkg: 'referrals' as const },
    { route: blogListRoute, pkg: 'ottablog' as const },
    { route: blogDetailRoute, pkg: 'ottablog' as const },
    { route: blogTagArchiveRoute, pkg: 'ottablog' as const },
    { route: blogCategoryArchiveRoute, pkg: 'ottablog' as const },
    { route: blogSeriesArchiveRoute, pkg: 'ottablog' as const },
    { route: adminBlogRoute, pkg: 'ottablog' as const },
    { route: adminBlogNewRoute, pkg: 'ottablog' as const },
    { route: adminBlogEditRoute, pkg: 'ottablog' as const },
    { route: adminBlogStudioRoute, pkg: 'ottablog' as const },
    { route: adminBlogTagsRoute, pkg: 'ottablog' as const },
    { route: adminBlogCategoriesRoute, pkg: 'ottablog' as const },
    { route: adminBlogSeriesRoute, pkg: 'ottablog' as const },
    { route: studioRoute, pkg: 'ottablog' as const },
    { route: studioNewRoute, pkg: 'ottablog' as const },
    { route: studioEditRoute, pkg: 'ottablog' as const },
    { route: studioTagsRoute, pkg: 'ottablog' as const },
    { route: studioCategoriesRoute, pkg: 'ottablog' as const },
    { route: studioSeriesRoute, pkg: 'ottablog' as const },
    { route: studioThemesRoute, pkg: 'ottablog' as const },
    { route: adminReferralsRoute, pkg: 'referrals' as const },
];

const routeTree = rootRoute.addChildren([
    ...coreRoutes,
    ...packageRoutes.filter((r) => PACKAGES_ENABLED[r.pkg]).map((r) => r.route),
    ...(MEDIA_LIBRARY_ENABLED ? [userMediaLibraryRoute, adminMediaLibraryRoute] : []),
]);

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
