// ============================================================
// @ottabase/payport/admin — Public Surface
// ============================================================
//
// Opt-in admin module. Importing this subpath introduces React,
// lucide-react, @ottabase/ui-shadcn and @ottabase/forms as runtime
// peer deps. The core `@ottabase/payport` package stays UI-free for
// non-admin consumers.
//
// Wiring (3 lines in your app):
//
//     // 1. Sidebar
//     import { PAYPORT_ADMIN_NAV } from '@ottabase/payport/admin';
//     export const ADMIN_NAV_GROUPS = [...EXISTING, PAYPORT_ADMIN_NAV];
//
//     // 2. Routes
//     import { createPayportAdminRoutes } from '@ottabase/payport/admin';
//     const billingRoutes = createPayportAdminRoutes(makeAdminRoute);
//     rootRoute.addChildren([...existing, ...billingRoutes]);
//
//     // 3. Server (in your router):
//     import { handleAdminStats, handleAdminProvidersInfo }
//         from '@ottabase/payport/server';
// ============================================================

export { getPayportEntity, PAYPORT_ENTITIES, PAYPORT_ENTITIES_BY_KEY } from './entities';
export type { PayportEntityDescriptor } from './entities';

export { PAYPORT_ADMIN_NAV } from './nav';
export type { PayportAdminNavGroup, PayportAdminNavItem } from './nav';

export { createPayportAdminRoutes, PAYPORT_ADMIN_ROUTE_DESCRIPTORS } from './routes';
export type { PayportRouteDescriptor } from './routes';

export { PayportDashboardPage, type PayportDashboardStats } from './pages/Dashboard';
export { PayportEntityCrudPage, type PayportEntityCrudPageProps } from './pages/EntityCrudPage';
export { PayportProvidersPage, type PayportProvidersInfo } from './pages/Providers';
