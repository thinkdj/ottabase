import { describe, expect, it } from 'vitest';

import { router } from '../router';

describe('Router config', () => {
    it('root route has loader to trigger pending state for lazy routes', () => {
        const rootRoute = router.routesById['__root__'] as any;
        expect(rootRoute.options?.loader).toBeDefined();
    });

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
        // NotFoundPage is a named export - we check the component exists
        const comp = rootRoute.options.notFoundComponent;
        expect(typeof comp).toBe('function');
    });
});
