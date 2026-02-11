// ---------------------------------------------------------------------------
// TanStack Router adapter for LayoutResolver
// ---------------------------------------------------------------------------

import { useLocation } from '@tanstack/react-router';

export const tanstackRouterAdapter = {
    usePathname: () => useLocation().pathname,
};
