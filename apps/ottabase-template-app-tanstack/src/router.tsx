import { useState } from "react";
import {
    Outlet,
    RootRoute,
    Route,
    Router,
    Link,
    createBrowserHistory,
    lazyRouteComponent,
    useNavigate,
} from "@tanstack/react-router";
import { APP_META } from "@/ottabase/config/app.config";
import { DarkModeToggle } from "@ottabase/ui-components/dark-mode-toggle";
import { Button, Avatar, AvatarFallback, AvatarImage } from "@ottabase/ui-shadcn";
import { api, isApiError } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { LogIn, LogOut } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";


function RootLayout() {
    const { isAuthenticated, user, logout } = useSession();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate({ to: "/" });
    };

    const userInitials =
        user?.name && user.name.trim().length > 0
            ? user.name
                  .split(" ")
                  .filter((n) => n.length > 0)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
            : user?.email && user.email.length > 0
              ? user.email[0].toUpperCase()
              : "?";

    return (
        <div className="min-h-screen bg-background font-sans">
            <header className="border-b">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Link to="/" className="font-semibold">
                            {APP_META.appName}
                        </Link>
                        <span className="text-xs text-muted-foreground">TanStack</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button asChild variant="ghost" size="sm">
                            <Link to="/">Home</Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                            <Link to="/demo">Demo</Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                            <Link to="/shortlinks">Links</Link>
                        </Button>

                        {isAuthenticated && (
                            <Button asChild variant="ghost" size="sm">
                                <Link to="/dashboard">Dashboard</Link>
                            </Button>
                        )}

                        <DarkModeToggle type="button" title="Toggle dark/light mode" />

                        {isAuthenticated ? (
                            <div className="flex items-center gap-2 ml-2 pl-2 border-l">
                                <Button asChild variant="ghost" size="sm">
                                    <Link to="/dashboard" className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            {user?.image && <AvatarImage src={user.image} />}
                                            <AvatarFallback className="text-xs">
                                                {userInitials}
                                            </AvatarFallback>
                                        </Avatar>
                                        {user?.name || user?.email}
                                    </Link>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLogout}
                                    title="Logout"
                                >
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 ml-2">
                                <Button asChild variant="ghost" size="sm">
                                    <Link to="/register">
                                        Sign up
                                    </Link>
                                </Button>
                                <Button asChild variant="default" size="sm">
                                    <Link to="/login" className="flex items-center gap-2">
                                        <LogIn className="h-4 w-4" />
                                        Login
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-4 py-10">
                <Outlet />
            </main>
        </div>
    );
}

function HomeRouteComponent() {
    const [result, setResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const checkHealth = async () => {
        setLoading(true);
        setResult(null);
        try {
            const data = await api("/api/health");
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
                <strong> TanStack Query</strong>. Deploys to <strong>Cloudflare
                    Workers</strong> (assets served by the Worker).
            </p>

            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                        <Link to="/demo">Go to Demo</Link>
                    </Button>
                    <Button
                        variant="outline"
                        onClick={checkHealth}
                        disabled={loading}
                    >
                        {loading ? "Checking..." : "/api/health"}
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
    path: "/",
    component: HomeRouteComponent,
});

const demoRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo",
    component: lazyRouteComponent(() => import("@/pages/demo/DemoIndexPage").then((m) => ({ default: m.DemoIndexPage }))),
});

const demoMantineRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/mantine",
    component: lazyRouteComponent(() => import("@/pages/demo/mantine/MantineDemoRoute").then((m) => ({ default: m.MantineDemoRoute }))),
});

const demoShadcnRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/shadcn",
    component: lazyRouteComponent(() => import("@/pages/demo/shadcn/ShadcnDemoPage").then((m) => ({ default: m.ShadcnDemoPage }))),
});

const demoOttaEditorRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/ottaeditor",
    component: lazyRouteComponent(() => import("@/pages/demo/ottaeditor/OttaEditorDemoPage").then((m) => ({ default: m.OttaEditorDemoPage }))),
});

const demoOttaOrmRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/ottaorm",
    component: lazyRouteComponent(() => import("@/pages/demo/ottaorm/OttaORMDemoPage").then((m) => ({ default: m.OttaORMDemoPage }))),
});

const demoOttaFormsRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/ottaforms",
    component: lazyRouteComponent(() => import("@/pages/demo/ottaforms/OttaFormsDemoPage").then((m) => ({ default: m.OttaFormsDemoPage }))),
});

const demoTimezoneRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/timezone",
    component: lazyRouteComponent(() => import("@/pages/demo/timezone/TimezoneDemoPage").then((m) => ({ default: m.TimezoneDemoPage }))),
});

const demoCloudflareRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare",
    component: lazyRouteComponent(() => import("@/pages/demo/cloudflare/CloudflareDemoIndexPage").then((m) => ({ default: m.CloudflareDemoIndexPage }))),
});

const demoCloudflareD1Route = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/d1",
    component: lazyRouteComponent(() => import("@/pages/demo/cloudflare/CloudflareD1DemoPage").then((m) => ({ default: m.CloudflareD1DemoPage }))),
});

const demoCloudflareKVRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/kv",
    component: lazyRouteComponent(() => import("@/pages/demo/cloudflare/CloudflareKVDemoPage").then((m) => ({ default: m.CloudflareKVDemoPage }))),
});

const demoCloudflareR2Route = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/r2",
    component: lazyRouteComponent(() => import("@/pages/demo/cloudflare/CloudflareR2DemoPage").then((m) => ({ default: m.CloudflareR2DemoPage }))),
});

const demoCloudflareImagesRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/images",
    component: lazyRouteComponent(() => import("@/pages/demo/cloudflare/CloudflareImagesDemoPage").then((m) => ({ default: m.CloudflareImagesDemoPage }))),
});

const demoCloudflareHyperdriveRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/hyperdrive",
    component: lazyRouteComponent(() => import("@/pages/demo/cloudflare/CloudflareHyperdriveDemoPage").then((m) => ({ default: m.CloudflareHyperdriveDemoPage }))),
});

const demoCloudflareQueuesRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/queues",
    component: lazyRouteComponent(() => import("@/pages/demo/cloudflare/CloudflareQueuesDemoPage").then((m) => ({ default: m.CloudflareQueuesDemoPage }))),
});

const demoCloudflareRateLimitingRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/rate-limiting",
    component: lazyRouteComponent(() => import("@/pages/demo/cloudflare/CloudflareRateLimitingDemoPage").then((m) => ({ default: m.CloudflareRateLimitingDemoPage }))),
});

const demoCloudflareRealtimeRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/realtime",
    component: lazyRouteComponent(() => import("@/pages/demo/cloudflare/CloudflareRealtimeDemoPage").then((m) => ({ default: m.CloudflareRealtimeDemoPage }))),
});

const demoApiRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/api",
    component: lazyRouteComponent(() => import("@/pages/demo/api/ApiDemoPage").then((m) => ({ default: m.ApiDemoPage }))),
});

const demoThemingRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/theming",
    component: lazyRouteComponent(() => import("@/pages/demo/theming/ThemingDemoPage").then((m) => ({ default: m.ThemingDemoPage }))),
});

const demoRendererRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/renderer",
    component: lazyRouteComponent(() => import("@/pages/demo/renderer/RendererDemoPage").then((m) => ({ default: m.RendererDemoPage }))),
});

// Auth routes
const loginRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/login",
    component: lazyRouteComponent(() => import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage }))),
});

const registerRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/register",
    component: lazyRouteComponent(() => import("@/pages/auth/RegisterPage").then((m) => ({ default: m.RegisterPage }))),
});


const dashboardRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: lazyRouteComponent(() => import("@/pages/auth/DashboardPage").then((m) => ({
        default: () => (
            <ProtectedRoute>
                <m.DashboardPage />
            </ProtectedRoute>
        )
    }))),
});

// Shortlinks route
const shortlinksRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/shortlinks",
    component: lazyRouteComponent(() => import("@/pages/shortlinks/ShortlinksPage").then((m) => ({ default: m.ShortlinksPage }))),
});

const routeTree = rootRoute.addChildren([
    indexRoute,
    demoRoute,
    demoMantineRoute,
    demoShadcnRoute,
    demoOttaEditorRoute,
    demoOttaOrmRoute,
    demoOttaFormsRoute,
    demoTimezoneRoute,
    demoCloudflareRoute,
    demoCloudflareD1Route,
    demoCloudflareKVRoute,
    demoCloudflareR2Route,
    demoCloudflareImagesRoute,
    demoCloudflareHyperdriveRoute,
    demoCloudflareQueuesRoute,
    demoCloudflareRateLimitingRoute,
    demoCloudflareRealtimeRoute,
    demoApiRoute,
    demoThemingRoute,
    demoRendererRoute,
    loginRoute,
    registerRoute,
    dashboardRoute,
    shortlinksRoute,
]);

const browserHistory = createBrowserHistory();

export const router = new Router({
    routeTree,
    history: browserHistory,
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}
