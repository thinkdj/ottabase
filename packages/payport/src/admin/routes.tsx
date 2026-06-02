// ============================================================
// Payport Admin — Route Descriptors
// ============================================================
//
// Router-agnostic route descriptors. The host app maps these to its
// concrete router (TanStack Router file routes, React Router, etc.).
//
// Example wiring with the otta-web `makeAdminRoute` helper:
//
//     import { createPayportAdminRoutes } from '@ottabase/payport/admin';
//     const routes = createPayportAdminRoutes(makeAdminRoute);
//     // routes is an array of TanStack route nodes ready to push into
//     // rootRoute.addChildren([...])
// ============================================================

import React from 'react';
import { PAYPORT_ENTITIES } from './entities';
import { PayportDashboardPage } from './pages/Dashboard';
import { PayportEntityCrudPage } from './pages/EntityCrudPage';
import { PayportProvidersPage } from './pages/Providers';

export interface PayportRouteDescriptor {
    /** Absolute URL path. */
    path: string;
    /** Lazy element factory — call to mount the page. */
    render: () => React.ReactElement;
    /** When true, requires the wildcard `*:*` permission. */
    superAdminOnly?: boolean;
}

/** Static descriptors — useful for non-TanStack routers or doc generation. */
export const PAYPORT_ADMIN_ROUTE_DESCRIPTORS: PayportRouteDescriptor[] = [
    { path: '/admin/billing', render: () => <PayportDashboardPage /> },
    {
        path: '/admin/billing/providers',
        render: () => <PayportProvidersPage />,
        superAdminOnly: true,
    },
    ...PAYPORT_ENTITIES.map((entity) => ({
        path: `/admin/billing/${entity.key.replace(/^payment_/, '')}`,
        render: () => <PayportEntityCrudPage entityKey={entity.key} />,
        superAdminOnly: entity.superAdminOnly,
    })),
];

/**
 * Factory that hands each descriptor to your `makeAdminRoute` helper
 * (which typically wraps with `<ProtectedRoute>` + `<AdminLayout>`).
 *
 * The factory receives a **lazy element getter** `() => React.ReactElement`
 * rather than a pre-constructed element so the host app can defer importing
 * payport admin components until the route is actually visited.
 *
 * The factory is intentionally generic so it works with any router that
 * accepts a `(path, getElement, options) => routeNode` adapter.
 *
 * Example (TanStack Router with React.lazy):
 *
 *   createPayportAdminRoutes((path, getElement, options) =>
 *     new Route({
 *       path,
 *       component: () => {
 *         const LazyPage = React.lazy(() => Promise.resolve({ default: () => getElement() }));
 *         return <React.Suspense fallback={<Spinner />}><LazyPage /></React.Suspense>;
 *       },
 *     })
 *   )
 */
export function createPayportAdminRoutes<TRoute>(
    makeAdminRoute: (
        path: string,
        getElement: () => React.ReactElement,
        options?: { superAdminOnly?: boolean },
    ) => TRoute,
): TRoute[] {
    return PAYPORT_ADMIN_ROUTE_DESCRIPTORS.map((d) =>
        makeAdminRoute(d.path, d.render, { superAdminOnly: d.superAdminOnly }),
    );
}
