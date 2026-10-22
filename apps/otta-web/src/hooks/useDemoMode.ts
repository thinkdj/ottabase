import { useApiQuery } from '@ottabase/ottaorm/client';

/** What `GET /api/demo/mode` reports: whether this deploy is a public demo, and its call to action. */
export interface DemoMode {
    enabled: boolean;
    ctaLabel: string | null;
    ctaUrl: string | null;
}

const NOT_A_DEMO: DemoMode = { enabled: false, ctaLabel: null, ctaUrl: null };

/**
 * Whether this deploy runs with `DEMO_MODE` (the demo banner, the Pro marks in the account menu).
 * Read once per visit; reads as "not a demo" while loading or when the request fails.
 */
export function useDemoMode(): DemoMode {
    const { data } = useApiQuery<DemoMode>({
        queryKey: ['demo-mode'],
        endpoint: '/api/demo/mode',
        queryOptions: { staleTime: Infinity, gcTime: Infinity, meta: { errorPresentation: 'silent' } },
    });
    return data ?? NOT_A_DEMO;
}
