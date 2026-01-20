import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ReferralTracker } from "@/components/ReferralTracker";
import { api, isApiError } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { ThemeSwitcher } from "@/ottabase/components/ThemeSwitcher";
import { APP_META } from "@/ottabase/config/app.config";
import { DarkModeToggle } from "@ottabase/ui-components/dark-mode-toggle";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Toaster,
} from "@ottabase/ui-shadcn";
import {
  Link,
  Outlet,
  RootRoute,
  Route,
  Router,
  createBrowserHistory,
  lazyRouteComponent,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { LogIn, LogOut } from "lucide-react";
import { useState } from "react";

function RootLayout() {
  const { isAuthenticated, user, logout } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

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

  // Check if we should use the wide layout
  const isWideLayout = location.pathname.startsWith("/demo");
  const containerClass = isWideLayout ? "max-w-[1400px]" : "max-w-5xl";

  return (
    <div className="min-h-screen bg-background font-sans">
      <Toaster />
      <ReferralTracker />
      <header className="border-b">
        <div
          className={`mx-auto flex items-center justify-between px-4 py-3 ${containerClass}`}
        >
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
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">Admin Pages</Link>
            </Button>

            {isAuthenticated && (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/referrals">Referrals</Link>
                </Button>
              </>
            )}

            <ThemeSwitcher />
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
                  <Link to="/register">Sign up</Link>
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

      <main className={`mx-auto px-4 py-10 ${containerClass}`}>
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
        <strong> TanStack Query</strong>. Deploys to{" "}
        <strong>Cloudflare Workers</strong> (assets served by the Worker).
      </p>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/demo">Go to Demo</Link>
          </Button>
          <Button variant="outline" onClick={checkHealth} disabled={loading}>
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

const demoLayoutRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/demo",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/DemoLayout").then((m) => ({
      default: m.DemoLayout,
    })),
  ),
});

const demoIndexRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "/",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/DemoIndexPage").then((m) => ({
      default: m.DemoIndexPage,
    })),
  ),
});

const demoMantineRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "mantine",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/mantine/MantineDemoRoute").then((m) => ({
      default: m.MantineDemoRoute,
    })),
  ),
});

const demoShadcnRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "shadcn",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/shadcn/ShadcnDemoPage").then((m) => ({
      default: m.ShadcnDemoPage,
    })),
  ),
});

const demoOttaEditorRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "ottaeditor",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/ottaeditor/OttaEditorDemoPage").then((m) => ({
      default: m.OttaEditorDemoPage,
    })),
  ),
});

const demoOttaOrmRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "ottaorm",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/ottaorm/OttaORMDemoPage").then((m) => ({
      default: m.OttaORMDemoPage,
    })),
  ),
});

const demoOttaFormsRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "ottaforms",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/ottaforms/OttaFormsDemoPage").then((m) => ({
      default: m.OttaFormsDemoPage,
    })),
  ),
});

const demoOttaSelectRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "ottaselect",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/ottaselect/OttaSelectDemoPage").then((m) => ({
      default: m.OttaSelectDemoPage,
    })),
  ),
});

const demoTimezoneRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "timezone",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/timezone/TimezoneDemoPage").then((m) => ({
      default: m.TimezoneDemoPage,
    })),
  ),
});

const demoCloudflareRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "cloudflare",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/cloudflare/CloudflareDemoIndexPage").then((m) => ({
      default: m.CloudflareDemoIndexPage,
    })),
  ),
});

const demoCloudflareD1Route = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "cloudflare/d1",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/cloudflare/CloudflareD1DemoPage").then((m) => ({
      default: m.CloudflareD1DemoPage,
    })),
  ),
});

const demoCloudflareKVRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "cloudflare/kv",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/cloudflare/CloudflareKVDemoPage").then((m) => ({
      default: m.CloudflareKVDemoPage,
    })),
  ),
});

const demoCloudflareR2Route = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "cloudflare/r2",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/cloudflare/CloudflareR2DemoPage").then((m) => ({
      default: m.CloudflareR2DemoPage,
    })),
  ),
});

const demoCloudflareFileUploadRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "cloudflare/file-upload",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/cloudflare/CloudflareFileUploadDemoPage").then(
      (m) => ({
        default: m.CloudflareFileUploadDemoPage,
      }),
    ),
  ),
});

const demoCloudflareImagesRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "cloudflare/images",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/cloudflare/CloudflareImagesDemoPage").then((m) => ({
      default: m.CloudflareImagesDemoPage,
    })),
  ),
});

const demoCloudflareHyperdriveRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "cloudflare/hyperdrive",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/cloudflare/CloudflareHyperdriveDemoPage").then(
      (m) => ({ default: m.CloudflareHyperdriveDemoPage }),
    ),
  ),
});

const demoCloudflareQueuesRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "cloudflare/queues",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/cloudflare/CloudflareQueuesDemoPage").then((m) => ({
      default: m.CloudflareQueuesDemoPage,
    })),
  ),
});

const demoCloudflareRateLimitingRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "cloudflare/rate-limiting",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/cloudflare/CloudflareRateLimitingDemoPage").then(
      (m) => ({ default: m.CloudflareRateLimitingDemoPage }),
    ),
  ),
});

const demoCloudflareRealtimeRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "cloudflare/realtime",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/cloudflare/CloudflareRealtimeDemoPage").then((m) => ({
      default: m.CloudflareRealtimeDemoPage,
    })),
  ),
});

const demoApiRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "api",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/api/ApiDemoPage").then((m) => ({
      default: m.ApiDemoPage,
    })),
  ),
});

const demoThemingRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "theming",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/theming/ThemingDemoPage").then((m) => ({
      default: m.ThemingDemoPage,
    })),
  ),
});

const demoStateRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "state",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/state/StateDemoPage").then((m) => ({
      default: m.StateDemoPage,
    })),
  ),
});

const demoRendererRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "renderer",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/renderer/RendererDemoPage").then((m) => ({
      default: m.RendererDemoPage,
    })),
  ),
});

const demoEmailRoute = new Route({
  getParentRoute: () => demoLayoutRoute,
  path: "email",
  component: lazyRouteComponent(() =>
    import("@/pages/demo/email/EmailDemoPage").then((m) => ({
      default: m.EmailDemoPage,
    })),
  ),
});

// Auth routes
const loginRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: lazyRouteComponent(() =>
    import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })),
  ),
});

const registerRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: lazyRouteComponent(() =>
    import("@/pages/auth/RegisterPage").then((m) => ({
      default: m.RegisterPage,
    })),
  ),
});

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: lazyRouteComponent(() =>
    import("@/pages/auth/DashboardPage").then((m) => ({
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
  path: "/shortlinks",
  component: lazyRouteComponent(() =>
    import("@/pages/shortlinks/ShortlinksPage").then((m) => ({
      default: m.ShortlinksPage,
    })),
  ),
});

const migrationStatusRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/migration-status",
  component: lazyRouteComponent(() =>
    import("@/pages/MigrationStatusPage").then((m) => ({
      default: m.MigrationStatusPage,
    })),
  ),
});

// Referrals route
const referralsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/referrals",
  component: lazyRouteComponent(() =>
    import("@/pages/referrals/ReferralsPage").then((m) => ({
      default: m.ReferralsPage,
    })),
  ),
});

// Admin route
const adminRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: lazyRouteComponent(() =>
    import("@/pages/admin/AdminIndexPage").then((m) => ({
      default: m.AdminIndexPage,
    })),
  ),
});

// Admin Referrals route
const adminReferralsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/admin/referrals",
  component: lazyRouteComponent(() =>
    import("@/pages/admin/AdminReferralsPage").then((m) => ({
      default: m.AdminReferralsPage,
    })),
  ),
});

// Admin Queue Management route
const adminQueueRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/admin/queues",
  component: lazyRouteComponent(() =>
    import("@/pages/admin/AdminQueuePage").then((m) => ({
      default: m.AdminQueuePage,
    })),
  ),
});

// Admin Cron/Scheduled Tasks route
const adminCronRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/admin/cron",
  component: lazyRouteComponent(() =>
    import("@/pages/admin/AdminCronPage").then((m) => ({
      default: m.AdminCronPage,
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
]);

const routeTree = rootRoute.addChildren([
  indexRoute,
  demoLayoutRoute,
  loginRoute,
  registerRoute,
  dashboardRoute,
  shortlinksRoute,
  migrationStatusRoute,
  referralsRoute,
  adminRoute,
  adminReferralsRoute,
  adminQueueRoute,
  adminCronRoute,
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
