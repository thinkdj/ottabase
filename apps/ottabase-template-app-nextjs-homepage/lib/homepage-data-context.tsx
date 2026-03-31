'use client';

/**
 * React context for passing homepage API data from LayoutShell to page components.
 *
 * This bridges the server-fetched homepage data (from layout.tsx → LayoutShell)
 * down to client components like (site)/page.tsx, without prop drilling through
 * Next.js route boundaries.
 */

import { createContext, useContext } from 'react';
import type { HomepageDataPayload } from './api';

const HomepageDataContext = createContext<HomepageDataPayload | null>(null);

export function HomepageDataProvider({
    children,
    data,
}: {
    children: React.ReactNode;
    data: HomepageDataPayload | null;
}) {
    return <HomepageDataContext.Provider value={data}>{children}</HomepageDataContext.Provider>;
}

/**
 * Access the homepage data payload from context.
 * Returns null when data is unavailable (API not configured or failed).
 */
export function useHomepageData(): HomepageDataPayload | null {
    return useContext(HomepageDataContext);
}
