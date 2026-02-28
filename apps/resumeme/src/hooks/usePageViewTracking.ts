import { useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';

/**
 * Global hook to track page views automatically on route changes.
 * Sends a beacon to the WAE analytics endpoint.
 */
export function usePageViewTracking() {
    // Get the current location safely
    const pathname = useRouterState({ select: (s) => s.location.pathname });

    useEffect(() => {
        if (!pathname) return;

        try {
            // Fire-and-forget beacon for analytics
            const payload = JSON.stringify({
                event: 'page_view',
                metadata: [pathname],
            });

            // sendBeacon is safe to call during component unmount or navigation
            navigator.sendBeacon('/api/analytics/track', payload);
        } catch (err) {
            // Silently ignore tracking errors so they don't break the app
            console.warn('Analytics tracking failed:', err);
        }
    }, [pathname]);
}
