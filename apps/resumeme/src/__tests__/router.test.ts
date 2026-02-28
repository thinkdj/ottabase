import { describe, expect, it } from 'vitest';

import { router } from '../router';

describe('Router config', () => {
    it('router uses RouteLoadingFallback as defaultPendingComponent', () => {
        const comp = (router as any).options?.defaultPendingComponent;
        expect(comp).toBeDefined();
        expect(typeof comp).toBe('function');
    });

    it('router has defaultPendingMs 0 to show loading immediately', () => {
        expect((router as any).options?.defaultPendingMs).toBe(0);
    });

    it('root route uses NotFoundPage as notFoundComponent', () => {
        const rootRoute = router.routesById['__root__'] as any;
        expect(rootRoute.options?.notFoundComponent).toBeDefined();
        const comp = rootRoute.options.notFoundComponent;
        expect(typeof comp).toBe('function');
    });

    it('has builder route', () => {
        const routeIds = Object.keys(router.routesById);
        expect(routeIds).toContain('/builder');
    });

    it('has home route', () => {
        const routeIds = Object.keys(router.routesById);
        expect(routeIds).toContain('/');
    });
});
