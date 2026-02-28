import { NotFoundPage } from '@/components/NotFoundPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RouteLoadingFallback } from '@/components/RouteLoadingFallback';
import { usePageViewTracking } from '@/hooks/usePageViewTracking';
import { ConfigurableLayout } from '@/ottabase/components/ConfigurableLayout';
import { BrandPathSync, LayoutResolver } from '@ottabase/brand-engine-react';
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

// ── Root Layout ──
function RootLayout() {
    const pathname = tanstackRouterAdapter.usePathname();
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

// ── Home Page ──
function HomePage() {
    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50">ResumeMe</h1>
            <p className="mt-3 max-w-md text-center text-lg text-gray-500 dark:text-gray-400">
                Create professional resumes in minutes. Choose from templates, customise colours, and export to PDF.
            </p>
            <div className="mt-6 flex gap-3">
                <Link
                    to="/builder"
                    className="rounded-md bg-gray-800 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                >
                    Get Started
                </Link>
                <Link
                    to="/guest"
                    className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                    Try it Free
                </Link>
            </div>
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                No sign-up required —{' '}
                <Link to="/guest" className="underline hover:text-gray-600 dark:hover:text-gray-300">
                    explore all features as a guest
                </Link>
            </p>
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

const builderRoute = new Route({
    getParentRoute: () => rootRoute,
    path: '/builder',
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
    builderRoute,
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
