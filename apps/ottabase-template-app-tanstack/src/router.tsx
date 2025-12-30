import {
    Outlet,
    RootRoute,
    Route,
    Router,
    Link,
} from "@tanstack/react-router";
import { APP_META } from "@/ottabase/config/app.config";
import { DarkModeToggle } from "@ottabase/ui-components/dark-mode-toggle";
import { Button } from "@ottabase/ui-shadcn";

import { DemoIndexPage } from "@/pages/demo/DemoIndexPage";
import { CloudflareDemoIndexPage } from "@/pages/demo/cloudflare/CloudflareDemoIndexPage";
import { CloudflareD1DemoPage } from "@/pages/demo/cloudflare/CloudflareD1DemoPage";
import { CloudflareKVDemoPage } from "@/pages/demo/cloudflare/CloudflareKVDemoPage";
import { CloudflareR2DemoPage } from "@/pages/demo/cloudflare/CloudflareR2DemoPage";
import { CloudflareQueuesDemoPage } from "@/pages/demo/cloudflare/CloudflareQueuesDemoPage";
import { CloudflareRateLimitingDemoPage } from "@/pages/demo/cloudflare/CloudflareRateLimitingDemoPage";
import { CloudflareRealtimeDemoPage } from "@/pages/demo/cloudflare/CloudflareRealtimeDemoPage";
import { CloudflareImagesDemoPage } from "@/pages/demo/cloudflare/CloudflareImagesDemoPage";
import { CloudflareHyperdriveDemoPage } from "@/pages/demo/cloudflare/CloudflareHyperdriveDemoPage";
import { MantineDemoRoute } from "@/pages/demo/mantine/MantineDemoRoute";
import { OttaEditorDemoPage } from "@/pages/demo/ottaeditor/OttaEditorDemoPage";
import { OttaORMDemoPage } from "@/pages/demo/ottaorm/OttaORMDemoPage";
import { ShadcnDemoPage } from "@/pages/demo/shadcn/ShadcnDemoPage";
import { TimezoneDemoPage } from "@/pages/demo/timezone/TimezoneDemoPage";

function RootLayout() {
    return (
        <div className="min-h-screen bg-background">
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
                        <DarkModeToggle type="button" title="Toggle dark/light mode" />
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
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-4xl font-bold">{APP_META.appName}</h1>
            <p className="text-muted-foreground">{APP_META.description}</p>

            <p className="text-sm text-muted-foreground">
                Built with <strong>Vite</strong>, <strong>TanStack Router</strong>, and
                <strong> TanStack Query</strong>. Deploys to <strong>Cloudflare
                    Workers</strong> (assets served by the Worker).
            </p>

            <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                    <Link to="/demo">Go to Demo</Link>
                </Button>
                <Button asChild variant="outline">
                    <a href="/api/health" target="_blank" rel="noreferrer">
                        /api/health
                    </a>
                </Button>
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
    component: DemoIndexPage,
});

const demoMantineRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/mantine",
    component: MantineDemoRoute,
});

const demoShadcnRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/shadcn",
    component: ShadcnDemoPage,
});

const demoOttaEditorRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/ottaeditor",
    component: OttaEditorDemoPage,
});

const demoOttaOrmRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/ottaorm",
    component: OttaORMDemoPage,
});

const demoTimezoneRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/timezone",
    component: TimezoneDemoPage,
});

const demoCloudflareRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare",
    component: CloudflareDemoIndexPage,
});

const demoCloudflareD1Route = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/d1",
    component: CloudflareD1DemoPage,
});

const demoCloudflareKVRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/kv",
    component: CloudflareKVDemoPage,
});

const demoCloudflareR2Route = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/r2",
    component: CloudflareR2DemoPage,
});

const demoCloudflareImagesRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/images",
    component: CloudflareImagesDemoPage,
});

const demoCloudflareHyperdriveRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/hyperdrive",
    component: CloudflareHyperdriveDemoPage,
});

const demoCloudflareQueuesRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/queues",
    component: CloudflareQueuesDemoPage,
});

const demoCloudflareRateLimitingRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/rate-limiting",
    component: CloudflareRateLimitingDemoPage,
});

const demoCloudflareRealtimeRoute = new Route({
    getParentRoute: () => rootRoute,
    path: "/demo/cloudflare/realtime",
    component: CloudflareRealtimeDemoPage,
});

const routeTree = rootRoute.addChildren([
    indexRoute,
    demoRoute,
    demoMantineRoute,
    demoShadcnRoute,
    demoOttaEditorRoute,
    demoOttaOrmRoute,
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
]);

export const router = new Router({
    routeTree,
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}
