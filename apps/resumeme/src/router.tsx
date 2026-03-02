import { NotFoundPage } from '@/components/NotFoundPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RouteLoadingFallback } from '@/components/RouteLoadingFallback';
import { ResumeMeLayout } from '@/components/layout/ResumeMeLayout';
import { usePageViewTracking } from '@/hooks/usePageViewTracking';
import { BrandPathSync } from '@ottabase/brand-engine-react';
import { tanstackRouterAdapter } from '@ottabase/brand-engine-react/routers';
import { Toaster } from '@ottabase/ui-shadcn';
import {
    createBrowserHistory,
    lazyRouteComponent,
    Link,
    Outlet,
    RootRoute,
    Route,
    Router,
} from '@tanstack/react-router';

// ── Root Layout — uses the custom ResumeMe header-based layout ──
function RootLayout() {
    const pathname = tanstackRouterAdapter.usePathname();
    usePageViewTracking();
    const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');
    const isMigrationStatusPath = pathname === '/migration-status';
    const isPublicResumePath = pathname.startsWith('/r/');
    const useCenteredAppContainer = isAdminPath || isMigrationStatusPath;

    // Public resume viewer renders its own standalone layout
    if (isPublicResumePath) {
        return (
            <>
                <Toaster />
                <Outlet />
            </>
        );
    }

    return (
        <>
            <Toaster />
            <BrandPathSync pathname={pathname} />
            <ResumeMeLayout>
                {useCenteredAppContainer ? (
                    <div className="mx-auto w-full max-w-4xl px-4 py-8">
                        <Outlet />
                    </div>
                ) : (
                    <Outlet />
                )}
            </ResumeMeLayout>
        </>
    );
}

// ── Home Page ──
function HomePage() {
    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden">
            {/* Background image layer — sits behind content, receives sepia + blur */}
            <div
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: 'url(/resumemehero.png)',
                    backgroundPosition: 'center center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'contain',
                    filter: 'sepia(0.64) blur(0px)',
                    opacity: 0.256,
                }}
            />
            {/* Gooey SVG filter (hidden) — gives inline backgrounds smooth rounded corners */}
            <svg
                style={{ visibility: 'hidden', position: 'absolute' }}
                width="0"
                height="0"
                xmlns="http://www.w3.org/2000/svg"
                version="1.1"
            >
                <defs>
                    <filter id="goo">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
                            result="goo"
                        />
                        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>
                </defs>
            </svg>

            {/* Centered hero content — each element gets its own gooey blob */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10 text-center">
                {/* Title */}
                <h1
                    className="bg-background/90 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50"
                    style={{
                        display: 'inline',
                        boxDecorationBreak: 'clone',
                        WebkitBoxDecorationBreak: 'clone',
                        padding: '0.4rem 0.8rem',
                        lineHeight: 1.5,
                        filter: "url('#goo')",
                    }}
                >
                    ResumeMe
                </h1>

                {/* Description */}
                <p
                    className="bg-background/90 mt-0 max-w-md text-sm text-gray-600 dark:text-gray-300"
                    style={{
                        display: 'inline',
                        boxDecorationBreak: 'clone',
                        WebkitBoxDecorationBreak: 'clone',
                        padding: '1rem 1rem',
                        lineHeight: 1.8,
                        filter: "url('#goo')",
                    }}
                >
                    <strong>Resume your hunt</strong> for the next job with AI-powered resume building. Enter your data
                    once, then generate unlimited resume variations <strong>tailored to each opportunity</strong>. Get
                    past ATS blocks and land more interviews - all for free.
                </p>

                {/* Buttons */}
                <div
                    className="bg-background/90 mt-0 inline-flex gap-3"
                    style={{
                        padding: '1rem 1rem',
                        filter: "url('#goo')",
                    }}
                >
                    <Link
                        to="/builder"
                        search={{ resumeId: undefined, dataSetId: undefined }}
                        className="rounded-md bg-gray-800 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                        Get Started
                    </Link>
                    <Link
                        to="/guest"
                        className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        Try it Free
                    </Link>
                </div>

                {/* Footer text */}
                <p
                    className="bg-background/90 mt-0 text-xs text-gray-500 dark:text-gray-400"
                    style={{
                        display: 'inline',
                        boxDecorationBreak: 'clone',
                        WebkitBoxDecorationBreak: 'clone',
                        padding: '1rem 1rem',
                        lineHeight: 1.6,
                        filter: "url('#goo')",
                    }}
                >
                    No sign-up required —{' '}
                    <Link to="/guest" className="underline hover:text-gray-700 dark:hover:text-gray-200">
                        explore as a guest
                    </Link>
                </p>
            </div>
        </div>
    );
}

function AdminFeatureUnavailablePage({ feature }: { feature: string }) {
    return (
        <div className="mx-auto max-w-3xl px-4 py-10">
            <h1 className="text-2xl font-semibold">{feature}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
                This admin module is not wired in ResumeMe yet. Use the Admin Console for currently available tools.
            </p>
            <div className="mt-4">
                <Link to="/admin" className="text-primary underline">
                    ← Back to Admin Console
                </Link>
            </div>
        </div>
    );
}

// ── Routes ──
const rootRoute = new RootRoute({
    component: RootLayout,
    notFoundComponent: NotFoundPage,
});

const homeRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomePage,
});

const myResumeRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/my-resume',
    component: lazyRouteComponent(() =>
        import('@/pages/resume/ResumeDataPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.ResumeDataPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const myResumesRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/my-resumes',
    component: lazyRouteComponent(() =>
        import('@/pages/resume/MyResumesPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.MyResumesPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminIndexPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.AdminIndexPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminBrandEngineRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/brand-engine',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminBrandKitsListPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.AdminBrandKitsListPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminThemeGeneratorRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/theme-generator',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/ThemeGeneratorRedirect').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.ThemeGeneratorRedirect />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminBrandLayoutsRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/brand-engine/layouts',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminBrandLayoutsPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.AdminBrandLayoutsPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminBrandKitNewRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/brand-engine/kits/new',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminBrandKitDetailPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.AdminBrandKitDetailPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminBrandKitDetailRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/brand-engine/kits/$kitId',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminBrandKitDetailPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.AdminBrandKitDetailPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminMenusRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/menus',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminMenusListPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.AdminMenusListPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminMenuNewRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/menus/new',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminMenuDetailPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.AdminMenuDetailPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminMenuDetailRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/menus/$menuId',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminMenuDetailPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.AdminMenuDetailPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminRbacRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/rbac',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/rbac/RBACAdminPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.RBACAdminPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminRbacRolesRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/rbac/roles',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/rbac/RBACRolesPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.RBACRolesPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminRbacPermissionsRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/rbac/permissions',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/rbac/PermissionsMatrixPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.PermissionsMatrixPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminAuditRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/audit',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/audit/AuditLogViewerPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.AuditLogViewerPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminSecurityRlsRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/security/rls',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/security/RLSSecurityDemoPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.RLSSecurityDemoPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminSecurityKillSwitchesRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/security/kill-switches',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/security/KillSwitchesPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.default />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminUsersRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/users',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/users/UserManagementPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.UserManagementPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminUserRbacRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/users/$userId/rbac',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/users/UserRBACPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.UserRBACPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminDbRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/db',
    validateSearch: (search: Record<string, unknown>) => ({
        table: typeof search.table === 'string' ? search.table : '',
        page: typeof search.page === 'number' ? search.page : Number(search.page) || 1,
        perPage: typeof search.perPage === 'number' ? search.perPage : Number(search.perPage) || 25,
    }),
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminDbPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.AdminDbPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminQueuesRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/queues',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminQueuePage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.AdminQueuePage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminCronRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/cron',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminCronPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.AdminCronPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminNotificationsRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/notifications',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/AdminNotificationsPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.AdminNotificationsPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const adminBlogRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/blog',
    component: () => (
        <ProtectedRoute>
            <AdminFeatureUnavailablePage feature="Blog Management" />
        </ProtectedRoute>
    ),
});

const adminBlogStudioRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/blog/studio',
    component: () => (
        <ProtectedRoute>
            <AdminFeatureUnavailablePage feature="Blog Studio" />
        </ProtectedRoute>
    ),
});

const adminReferralsRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/admin/referrals',
    component: () => (
        <ProtectedRoute>
            <AdminFeatureUnavailablePage feature="Referral Tracking" />
        </ProtectedRoute>
    ),
});

const builderRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/builder',
    validateSearch: (search: Record<string, unknown>) => ({
        resumeId: typeof search.resumeId === 'string' ? search.resumeId : undefined,
        dataSetId: typeof search.dataSetId === 'string' ? search.dataSetId : undefined,
    }),
    component: lazyRouteComponent(() =>
        import('@/pages/resume/ResumeBuilder').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.default />
                </ProtectedRoute>
            ),
        })),
    ),
});

const migrationStatusRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/migration-status',
    component: lazyRouteComponent(() =>
        import('@/pages/admin/MigrationStatusPage').then((m) => ({
            default: m.MigrationStatusPage,
        })),
    ),
});

// ── Public Resume Viewer (standalone layout — no ResumeMeLayout wrapper) ──
const publicResumeRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/r/$code',
    component: lazyRouteComponent(() =>
        import('@/pages/resume/PublicResumePage').then((m) => ({
            default: () => {
                const { code } = publicResumeRoute.useParams();
                return <m.PublicResumePage code={code} />;
            },
        })),
    ),
});

const dossierListRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/dossier',
    component: lazyRouteComponent(() =>
        import('@/pages/dossier/ResumeApplicationDossierPage').then((m) => ({
            default: () => (
                <ProtectedRoute>
                    <m.ResumeApplicationDossierPage />
                </ProtectedRoute>
            ),
        })),
    ),
});

const dossierDetailRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/dossier/$dossierId',
    component: lazyRouteComponent(() =>
        import('@/pages/dossier/ResumeApplicationDossierDetailPage').then((m) => ({
            default: () => {
                const { dossierId } = dossierDetailRoute.useParams();
                return (
                    <ProtectedRoute>
                        <m.ResumeApplicationDossierDetailPage dossierId={dossierId} />
                    </ProtectedRoute>
                );
            },
        })),
    ),
});

const guestRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/guest',
    component: lazyRouteComponent(() =>
        import('@/pages/resume/ResumeBuilder').then((m) => ({
            default: () => <m.default guestMode />,
        })),
    ),
});

// ── Auth Routes ──
const signinRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/auth/signin',
    component: lazyRouteComponent(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage }))),
});

const signupRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/auth/signup',
    component: lazyRouteComponent(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage }))),
});

const verifyEmailRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/auth/verify-email',
    component: lazyRouteComponent(() =>
        import('@/pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })),
    ),
});

const passwordResetRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/auth/password/reset',
    component: lazyRouteComponent(() =>
        import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
    ),
});

// ── User Routes ──
const userProfileRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/user/profile',
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

// ── Route Tree ──
const routeTree = rootRoute.addChildren([
    homeRoute,
    myResumeRoute,
    myResumesRoute,
    dossierListRoute,
    dossierDetailRoute,
    adminRoute,
    adminBrandEngineRoute,
    adminThemeGeneratorRoute,
    adminBrandLayoutsRoute,
    adminBrandKitNewRoute,
    adminBrandKitDetailRoute,
    adminMenusRoute,
    adminMenuNewRoute,
    adminMenuDetailRoute,
    adminRbacRoute,
    adminRbacRolesRoute,
    adminRbacPermissionsRoute,
    adminAuditRoute,
    adminSecurityRlsRoute,
    adminSecurityKillSwitchesRoute,
    adminUsersRoute,
    adminUserRbacRoute,
    adminDbRoute,
    adminQueuesRoute,
    adminCronRoute,
    adminNotificationsRoute,
    adminBlogRoute,
    adminBlogStudioRoute,
    adminReferralsRoute,
    migrationStatusRoute,
    builderRoute,
    publicResumeRoute,
    guestRoute,
    signinRoute,
    signupRoute,
    verifyEmailRoute,
    passwordResetRoute,
    userProfileRoute,
]);

const browserHistory = createBrowserHistory();

export const router = new Router({
    routeTree,
    history: browserHistory,
    defaultPendingComponent: RouteLoadingFallback,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
});

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}
