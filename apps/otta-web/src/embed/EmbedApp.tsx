// ---------------------------------------------------------------------------
// Embed Router — Lightweight React tree for /embed/* routes.
//
// Runs outside the main app provider stack (no BrandProvider, no session,
// no blog state, no org fetches). Only provides:
//   - QueryClient (for any data-fetching hooks inside embeds)
//   - next-themes (dark/light toggling via ?theme= param)
//   - Base UI styles (fonts, Tailwind, shadcn tokens)
//
// To add a new embed route, register it in EMBED_ROUTES below and create
// a lazy component under src/embed/routes/.
// ---------------------------------------------------------------------------

import { NotFoundPage } from '@/components/NotFoundPage';
import { RouteLoadingFallback } from '@/components/RouteLoadingFallback';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    Outlet,
    RootRoute,
    Route,
    Router,
    RouterProvider,
    createBrowserHistory,
    lazyRouteComponent,
} from '@tanstack/react-router';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

// ---------------------------------------------------------------------------
// Minimal query client — no retries on 403, longer stale time for static content
// ---------------------------------------------------------------------------
const embedQueryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 min — embed content is mostly static
            gcTime: 10 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false, // Critical: prevent refetches when iframe loses focus
            refetchOnMount: false,
            refetchOnReconnect: false,
        },
    },
});

// ---------------------------------------------------------------------------
// Embed Root Layout — applies theme from ?theme= query param, no shell chrome
// ---------------------------------------------------------------------------
function EmbedRootLayout() {
    // No focus manager override needed — refetchOnWindowFocus is already
    // disabled on the embed QueryClient configuration above.
    return (
        <div className="min-h-screen bg-background font-sans">
            <Outlet />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------
const embedRootRoute = new RootRoute({
    component: EmbedRootLayout,
    notFoundComponent: NotFoundPage,
});

const embedDocsRoute = new Route({
    getParentRoute: () => embedRootRoute,
    path: '/embed/docs/$',
    component: lazyRouteComponent(() =>
        import('@/embed/routes/EmbedDocsPage').then((m) => ({
            default: m.EmbedDocsPage,
        })),
    ),
});

// Catch-all index redirects to a helpful 404
const embedIndexRoute = new Route({
    getParentRoute: () => embedRootRoute,
    path: '/embed',
    component: NotFoundPage,
});

const embedRouteTree = embedRootRoute.addChildren([embedIndexRoute, embedDocsRoute]);

const embedBrowserHistory = createBrowserHistory();

const embedRouter = new Router({
    routeTree: embedRouteTree,
    history: embedBrowserHistory,
    defaultPendingComponent: RouteLoadingFallback,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
});

// ---------------------------------------------------------------------------
// EmbedApp — The top-level component mounted by main.tsx for /embed/* paths
// ---------------------------------------------------------------------------
export function EmbedApp() {
    return (
        <QueryClientProvider client={embedQueryClient}>
            <NextThemesProvider
                attribute="class"
                storageKey="ottabase.embed.theme"
                defaultTheme="light"
                enableSystem={false}
                disableTransitionOnChange={false}
            >
                <RouterProvider router={embedRouter} />
            </NextThemesProvider>
        </QueryClientProvider>
    );
}
