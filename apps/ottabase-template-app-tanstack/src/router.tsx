import { ProtectedRoute } from '@/components/ProtectedRoute';
import { api, isApiError } from '@/lib/api';
import { APP_META } from '@/ottabase/config/app.config';
import { Button, Toaster } from '@ottabase/ui-shadcn';
import { LayoutResolver } from '@ottabase/brand-engine-react';
import { tanstackRouterAdapter } from '@ottabase/brand-engine-react/routers';
import {
    Link,
    Outlet,
    RootRoute,
    Route,
    Router,
    createBrowserHistory,
    lazyRouteComponent,
} from '@tanstack/react-router';
import { useState } from 'react';

function RootLayout() {
    return (
        <>
            <Toaster />
            <LayoutResolver router={tanstackRouterAdapter}>
                <Outlet />
            </LayoutResolver>
        </>
    );
}

function HomeRouteComponent() {
    const [result, setResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const checkHealth = async () => {
        setLoading(true);
        setResult(null);
        try {
            const data = await api('/api/health');
            setResult(JSON.stringify(data, null, 2));
        } catch (err) {
            if (isApiError(err)) {
                setResult(`Error ${err.status}: ${err.message}`);
            } else {
                setResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-4xl font-bold">{APP_META.appName}</h1>
            <p className="text-muted-foreground">{APP_META.description}</p>

            <p className="text-sm text-muted-foreground">
                Built with <strong>Vite</strong>, <strong>TanStack Router</strong>, and
                <strong> TanStack Query</strong>. Deploys to <strong>Cloudflare Workers</strong> (assets served by the
                Worker).
            </p>

            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                        <Link to="/demo">Go to Demo</Link>
                    </Button>
                    <Button variant="outline" onClick={checkHealth} disabled={loading}>
                        {loading ? 'Checking...' : '/api/health'}
                    </Button>
                </div>

                {result && (
                    <pre className="mt-2 rounded-lg bg-muted p-4 text-xs overflow-auto max-h-48 border animate-in fade-in slide-in-from-top-2 duration-300">
                        {result}
                    </pre>
                )}
            </div>
        </div>
    );
}

const rootRoute = new RootRoute({
    component: RootLayout,
    notFoundComponent: () => (
        <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">Not found</h2>
            <Button asChild variant="outline">
                <Link to="/">Back home</Link>
            </Button>
        </div>
    ),
});

const indexRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomeRouteComponent,
});

const demoLayoutRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/demo',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/DemoLayout').then((m) => ({
            default: m.DemoLayout,
        })),
    ),
});

const demoIndexRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: '/',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/DemoIndexPage').then((m) => ({
            default: m.DemoIndexPage,
        })),
    ),
});

const demoMantineRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'mantine',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/mantine/MantineDemoRoute').then((m) => ({
            default: m.MantineDemoRoute,
        })),
    ),
});

const demoShadcnRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'shadcn',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/shadcn/ShadcnDemoPage').then((m) => ({
            default: m.ShadcnDemoPage,
        })),
    ),
});

const demoOttaEditorRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'ottaeditor',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/ottaeditor/OttaEditorDemoPage').then((m) => ({
            default: m.OttaEditorDemoPage,
        })),
    ),
});

const demoOttaOrmRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'ottaorm',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/ottaorm/OttaORMDemoPage').then((m) => ({
            default: m.OttaORMDemoPage,
        })),
    ),
});

const demoOttaFormsRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'ottaforms',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/ottaforms/OttaFormsDemoPage').then((m) => ({
            default: m.OttaFormsDemoPage,
        })),
    ),
});

const demoOttaSelectRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'ottaselect',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/ottaselect/OttaSelectDemoPage').then((m) => ({
            default: m.OttaSelectDemoPage,
        })),
    ),
});

const demoTimezoneRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'timezone',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/timezone/TimezoneDemoPage').then((m) => ({
            default: m.TimezoneDemoPage,
        })),
    ),
});

const demoCloudflareRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'cloudflare',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/cloudflare/CloudflareDemoIndexPage').then((m) => ({
            default: m.CloudflareDemoIndexPage,
        })),
    ),
});

const demoCloudflareD1Route = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'cloudflare/d1',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/cloudflare/CloudflareD1DemoPage').then((m) => ({
            default: m.CloudflareD1DemoPage,
        })),
    ),
});

const demoCloudflareKVRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'cloudflare/kv',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/cloudflare/CloudflareKVDemoPage').then((m) => ({
            default: m.CloudflareKVDemoPage,
        })),
    ),
});

const demoCloudflareR2Route = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'cloudflare/r2',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/cloudflare/CloudflareR2DemoPage').then((m) => ({
            default: m.CloudflareR2DemoPage,
        })),
    ),
});

const demoCloudflareFileUploadRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'cloudflare/file-upload',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/cloudflare/CloudflareFileUploadDemoPage').then((m) => ({
            default: m.CloudflareFileUploadDemoPage,
        })),
    ),
});

const demoCloudflareImagesRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'cloudflare/images',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/cloudflare/CloudflareImagesDemoPage').then((m) => ({
            default: m.CloudflareImagesDemoPage,
        })),
    ),
});

const demoCloudflareHyperdriveRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'cloudflare/hyperdrive',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/cloudflare/CloudflareHyperdriveDemoPage').then((m) => ({
            default: m.CloudflareHyperdriveDemoPage,
        })),
    ),
});

const demoCloudflareQueuesRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'cloudflare/queues',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/cloudflare/CloudflareQueuesDemoPage').then((m) => ({
            default: m.CloudflareQueuesDemoPage,
        })),
    ),
});

const demoCloudflareRateLimitingRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'cloudflare/rate-limiting',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/cloudflare/CloudflareRateLimitingDemoPage').then((m) => ({
            default: m.CloudflareRateLimitingDemoPage,
        })),
    ),
});

const demoCloudflareRealtimeRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'cloudflare/realtime',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/cloudflare/CloudflareRealtimeDemoPage').then((m) => ({
            default: m.CloudflareRealtimeDemoPage,
        })),
    ),
});

const demoApiRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'api',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/api/ApiDemoPage').then((m) => ({
            default: m.ApiDemoPage,
        })),
    ),
});

const demoThemingRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'theming',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/theming/ThemingDemoPage').then((m) => ({
            default: m.ThemingDemoPage,
        })),
    ),
});

const demoStateRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'state',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/state/StateDemoPage').then((m) => ({
            default: m.StateDemoPage,
        })),
    ),
});

const demoRendererRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'renderer',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/renderer/RendererDemoPage').then((m) => ({
            default: m.RendererDemoPage,
        })),
    ),
});

const demoEmailRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'email',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/email/EmailDemoPage').then((m) => ({
            default: m.EmailDemoPage,
        })),
    ),
});

const demoNotificationsRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'notifications',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/notifications/DemoNotificationsPage').then((m) => ({
            default: m.DemoNotificationsPage,
        })),
    ),
});

const demoLoggerRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'logger',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/logger/LoggerDemoPage').then((m) => ({
            default: m.LoggerDemoPage,
        })),
    ),
});

const demoI18nRoute = new Route({
    getParentRoute: () => demoLayoutRoute,
    path: 'i18n',
    component: lazyRouteComponent(() =>
        import('@/pages/demo/i18n/I18nDemoPage').then((m) => ({
            default: m.I18nDemoPage,
        })),
    ),
});

// Auth routes
const loginRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: lazyRouteComponent(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage }))),
});

const registerRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/register',
    component: lazyRouteComponent(() =>
        import('@/pages/auth/RegisterPage').then((m) => ({
            default: m.RegisterPage,
        })),
    ),
});

const verifyEmailRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/verify-email',
    component: lazyRouteComponent(() =>
        import('@/pages/auth/VerifyEmailPage').then((m) => ({
            default: m.VerifyEmailPage,
        })),
    ),
});

const resetPasswordRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/reset-password',
    component: lazyRouteComponent(() =>
        import('@/pages/auth/ResetPasswordPage').then((m) => ({
            default: m.ResetPasswordPage,
        })),
    ),
});

const dashboardRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/dashboard',
    component: lazyRouteComponent(() =>
        import('@/pages/auth/DashboardPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.DashboardPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

// Shortlinks route
const shortlinksRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/shortlinks',
    component: lazyRouteComponent(() =>
        import('@/pages/shortlinks/ShortlinksPage').then((m) => ({
            default: m.ShortlinksPage,
        })),
    ),
});

const migrationStatusRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/migration-status',
    component: lazyRouteComponent(() =>
        import('@/pages/MigrationStatusPage').then((m) => ({
            default: m.MigrationStatusPage,
        })),
    ),
});

// Referrals route
const referralsRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/referrals',
    component: lazyRouteComponent(() =>
        import('@/pages/referrals/ReferralsPage').then((m) => ({
            default: m.ReferralsPage,
        })),
    ),
});

// Admin route
const adminRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminIndexPage').then((m) => ({
            default: m.AdminIndexPage,
        })),
    ),
});

// Admin BrandEngine route
const adminBrandEngineRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/brand-engine',
    validateSearch: (s: Record<string, unknown>) => ({
        tab: (s.tab as string) || 'settings',
    }),
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminBrandEnginePage').then((m) => ({
            default: m.AdminBrandEnginePage,
        })),
    ),
});

const adminThemeGeneratorRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/theme-generator',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/ThemeGeneratorRedirect').then((m) => ({
            default: m.ThemeGeneratorRedirect,
        })),
    ),
});

// Admin Referrals route
const adminReferralsRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/referrals',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminReferralsPage').then((m) => ({
            default: m.AdminReferralsPage,
        })),
    ),
});

// Admin Queue Management route
const adminQueueRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/queues',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminQueuePage').then((m) => ({
            default: m.AdminQueuePage,
        })),
    ),
});

// Admin Cron/Scheduled Tasks route
const adminCronRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/cron',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminCronPage').then((m) => ({
            default: m.AdminCronPage,
        })),
    ),
});

// Admin Notifications route
const adminNotificationsRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/notifications',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminNotificationsPage').then((m) => ({
            default: m.AdminNotificationsPage,
        })),
    ),
});

// Admin Blog routes
const adminBlogRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/blog',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/blog/AdminBlogListPage').then((m) => ({
            default: () => (
                <ProtectedRoute requiredPermissions={['posts:*']}>
                    <m.AdminBlogListPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminBlogNewRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/blog/new',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/blog/AdminBlogEditorPage').then((m) => ({
            default: () => (
                <ProtectedRoute requiredPermissions={['posts:*']}>
                    <m.AdminBlogEditorPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminBlogEditRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/blog/$postId/edit',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/blog/AdminBlogEditorPage').then((m) => ({
            default: () => (
                <ProtectedRoute requiredPermissions={['posts:*']}>
                    <m.AdminBlogEditorPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminBlogStudioRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/blog/studio',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/blog/AdminBlogStudioPage').then((m) => ({
            default: () => (
                <ProtectedRoute requiredPermissions={['posts:*']}>
                    <m.AdminBlogStudioPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

// Public Blog routes
const blogListRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/blog',
    component: lazyRouteComponent(() =>
        import('@/pages/blog/BlogListPage').then((m) => ({
            default: m.BlogListPage,
        })),
    ),
});

const adminDbRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/db',
    validateSearch: (search: Record<string, unknown>) => {
        return {
            table: (search.table as string) || '',
            page: Number(search.page) || 1,
            perPage: Number(search.perPage) || 25,
        };
    },
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminDbPage').then((m) => ({
            default: m.AdminDbPage,
        })),
    ),
});

const blogDetailRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/blog/$slug',
    component: lazyRouteComponent(() =>
        import('@/pages/blog/BlogDetailPage').then((m) => ({
            default: m.BlogDetailPage,
        })),
    ),
});

// Organizations routes
const organizationsRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/organizations',
    component: lazyRouteComponent(() =>
        import('@/pages/organizations/OrganizationsPage').then((m) => ({
            default: m.OrganizationsPage,
        })),
    ),
});

const organizationMembersRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/organizations/$organizationId/members',
    component: lazyRouteComponent(() =>
        import('@/pages/organizations/OrganizationMembersPage').then((m) => ({
            default: m.OrganizationMembersPage,
        })),
    ),
});

const organizationRegistrationRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/organizations/new',
    component: lazyRouteComponent(() =>
        import('@/pages/organizations/OrganizationRegistrationPage').then((m) => ({
            default: m.OrganizationRegistrationPage,
        })),
    ),
});

const organizationSettingsRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/organizations/$organizationId/settings',
    component: lazyRouteComponent(() =>
        import('@/pages/organizations/OrganizationSettingsPage').then((m) => ({
            default: m.OrganizationSettingsPage,
        })),
    ),
});

// User routes
const userProfileRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/profile',
    component: lazyRouteComponent(() =>
        import('@/pages/user/UserProfilePage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.UserProfilePage />
                </ProtectedRoute>
            ),
        })),
    ),
});

// Admin user routes
const adminUsersRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/users',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/users/UserManagementPage').then((m) => ({
            default: m.UserManagementPage,
        })),
    ),
});

const adminUserRBACRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/users/$userId/rbac',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/users/UserRBACPage').then((m) => ({
            default: m.UserRBACPage,
        })),
    ),
});

// Admin RBAC routes
const adminRBACRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/rbac',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/rbac/RBACAdminPage').then((m) => ({
            default: m.RBACAdminPage,
        })),
    ),
});

const adminRBACRolesRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/rbac/roles',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/rbac/RBACRolesPage').then((m) => ({
            default: m.RBACRolesPage,
        })),
    ),
});

const adminRBACPermissionsRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/rbac/permissions',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/rbac/PermissionsMatrixPage').then((m) => ({
            default: m.PermissionsMatrixPage,
        })),
    ),
});

const adminAuditRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/audit',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/audit/AuditLogViewerPage').then((m) => ({
            default: m.AuditLogViewerPage,
        })),
    ),
});

const adminSecurityRLSRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/security/rls',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/security/RLSSecurityDemoPage').then((m) => ({
            default: m.RLSSecurityDemoPage,
        })),
    ),
});

const adminKillSwitchesRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/security/kill-switches',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/security/KillSwitchesPage').then((m) => ({
            default: m.default,
        })),
    ),
});

demoLayoutRoute.addChildren([
    demoIndexRoute,
    demoMantineRoute,
    demoShadcnRoute,
    demoOttaEditorRoute,
    demoOttaOrmRoute,
    demoOttaFormsRoute,
    demoOttaSelectRoute,
    demoLoggerRoute,
    demoI18nRoute,
    demoTimezoneRoute,
    demoCloudflareRoute,
    demoCloudflareD1Route,
    demoCloudflareKVRoute,
    demoCloudflareR2Route,
    demoCloudflareFileUploadRoute,
    demoCloudflareImagesRoute,
    demoCloudflareHyperdriveRoute,
    demoCloudflareQueuesRoute,
    demoCloudflareRateLimitingRoute,
    demoCloudflareRealtimeRoute,
    demoApiRoute,
    demoThemingRoute,
    demoStateRoute,
    demoRendererRoute,
    demoEmailRoute,
    demoNotificationsRoute,
]);

const routeTree = rootRoute.addChildren([
    indexRoute,
    demoLayoutRoute,
    loginRoute,
    registerRoute,
    verifyEmailRoute,
    resetPasswordRoute,
    dashboardRoute,
    shortlinksRoute,
    migrationStatusRoute,
    referralsRoute,
    adminRoute,
    adminBrandEngineRoute,
    adminReferralsRoute,
    adminQueueRoute,
    adminCronRoute,
    adminNotificationsRoute,
    adminBlogRoute,
    adminBlogNewRoute,
    adminBlogEditRoute,
    adminBlogStudioRoute,
    adminDbRoute,
    adminThemeGeneratorRoute,
    adminRBACRoute,
    adminRBACRolesRoute,
    adminRBACPermissionsRoute,
    adminAuditRoute,
    adminSecurityRLSRoute,
    adminKillSwitchesRoute,
    adminUsersRoute,
    adminUserRBACRoute,
    blogListRoute,
    blogDetailRoute,
    organizationsRoute,
    organizationMembersRoute,
    organizationRegistrationRoute,
    organizationSettingsRoute,
    userProfileRoute,
]);

const browserHistory = createBrowserHistory();

export const router = new Router({
    routeTree,
    history: browserHistory,
});

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}
