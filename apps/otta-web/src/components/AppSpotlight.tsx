/**
 * AppSpotlight: the app's command palette (Ctrl/⌘K, "/").
 *
 * Every destination comes from the nav lists the app already keeps (main nav,
 * the admin menu filtered by what this user may open, the demo gallery), so the
 * palette never offers a page the user can't reach and never needs its own
 * list. Recent picks come first on an empty box.
 *
 * The demo list loads on first open (it otherwise lives only in lazy chunks), so
 * the palette adds almost nothing to the initial bundle. This provider sits above
 * <RouterProvider>, so it navigates through appNavigate (registered by router.tsx).
 */

import { useLocalStorage } from '@/hooks/useLocalStorage';
import { appNavigate } from '@/lib/app-navigate';
import { isAdminUser, isOrgAdmin, isPlatformAdmin, useSession } from '@/lib/auth';
import { appConfig } from '@/ottabase/config';
import { getEnabledAdminNav } from '@/ottabase/config/admin-nav';
import { getNavLinks } from '@/ottabase/components/layout/layout.constants';
import { SpotlightProvider } from '@ottabase/spotlight/react';
import type { SpotlightResult } from '@ottabase/spotlight';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

const RECENT_KEY = 'ottabase.spotlight-recent';
const MAX_RECENT = 5;
const MAX_RESULTS = 30;

export interface Destination {
    href: string;
    label: string;
    description?: string;
    group: string;
    keywords?: string[];
}

/** Rank a destination for a query: label prefix > label word > anywhere. 0 = no match. */
function score(d: Destination, q: string): number {
    const label = d.label.toLowerCase();
    if (label.startsWith(q)) return 4;
    if (label.includes(` ${q}`)) return 3;
    if (label.includes(q)) return 2;
    const rest = [d.description, d.group, ...(d.keywords ?? [])].join(' ').toLowerCase();
    return rest.includes(q) ? 1 : 0;
}

/**
 * Matching destinations, best first, with each group kept together (best group
 * first) so the palette never repeats a heading.
 */
export function rankDestinations(destinations: Destination[], query: string, limit = MAX_RESULTS): Destination[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const ranked = destinations
        .map((d) => ({ d, s: score(d, q) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, limit);
    const groupOrder = [...new Set(ranked.map((r) => r.d.group))];
    return groupOrder.flatMap((g) => ranked.filter((r) => r.d.group === g).map((r) => r.d));
}

export function AppSpotlightProvider({ children }: { children: ReactNode }) {
    const { user, isAuthenticated } = useSession();
    const { resolvedTheme, setTheme } = useTheme();
    const [recentRaw, setRecentRaw] = useLocalStorage<string>(RECENT_KEY);
    const [demos, setDemos] = useState<Destination[] | null>(null);
    const [opened, setOpened] = useState(false);

    // The demo list lives in lazy chunks: load it the first time the palette opens
    useEffect(() => {
        if (!opened || demos) return;
        let cancelled = false;
        void import('@/pages/demo/demoItems').then(({ DEMO_ITEMS }) => {
            if (cancelled) return;
            setDemos(
                DEMO_ITEMS.map((item) => ({
                    href: item.to,
                    label: item.label,
                    description: item.description,
                    group: 'Demos',
                })),
            );
        });
        return () => {
            cancelled = true;
        };
    }, [opened, demos]);

    // Only the admin pages this user may open (re-derived when the session changes)
    const admin = useMemo<Destination[]>(
        () =>
            getEnabledAdminNav({ isPlatformAdmin: isPlatformAdmin(user), isOrgAdmin: isOrgAdmin(user) }).flatMap(
                (group) =>
                    group.items
                        .filter((item) => !item.external)
                        .map((item) => ({
                            href: item.href,
                            label: item.title,
                            description: item.description,
                            group: 'Admin',
                            keywords: [group.label],
                        })),
            ),
        [user],
    );

    const destinations = useMemo<Destination[]>(() => {
        const pages: Destination[] = getNavLinks({ isAuthenticated, isAdmin: isAdminUser(user) }).map((link) => ({
            href: link.to,
            label: link.label,
            group: 'Pages',
            ...(link.to === '/docs'
                ? { description: 'Start here: run it locally and pick a guide', keywords: ['documentation', 'guide'] }
                : {}),
        }));
        // One entry per destination: duplicate hrefs would share a result id (and a React key)
        const seen = new Set<string>();
        return [...pages, ...admin, ...(demos ?? [])].filter((d) => !seen.has(d.href) && !!seen.add(d.href));
    }, [isAuthenticated, user, admin, demos]);

    const recentIds = useMemo<string[]>(() => {
        try {
            const parsed: unknown = JSON.parse(recentRaw ?? '[]');
            return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
        } catch {
            return [];
        }
    }, [recentRaw]);

    const remember = useCallback(
        (id: string) => {
            const next = [id, ...recentIds.filter((r) => r !== id)].slice(0, MAX_RECENT);
            setRecentRaw(JSON.stringify(next));
        },
        [recentIds, setRecentRaw],
    );

    const toResult = useCallback(
        (d: Destination, overrides: Partial<SpotlightResult> = {}): SpotlightResult => ({
            id: d.href,
            label: d.label,
            description: d.description,
            group: d.group,
            keywords: d.keywords,
            onSelect: () => appNavigate(d.href),
            ...overrides,
        }),
        [],
    );

    const themeAction = useMemo<SpotlightResult>(() => {
        const next = resolvedTheme === 'dark' ? 'light' : 'dark';
        return {
            id: 'action:theme',
            label: `Switch to ${next} mode`,
            group: 'Actions',
            keywords: ['theme', 'dark', 'light', 'appearance'],
            onSelect: () => setTheme(next),
        };
    }, [resolvedTheme, setTheme]);

    // Empty box: recent picks, then the main pages
    const defaultResults = useMemo<SpotlightResult[]>(() => {
        const byHref = new Map(destinations.map((d) => [d.href, d]));
        const recent = recentIds
            .map((id) => byHref.get(id))
            .filter((d): d is Destination => !!d)
            .map((d) => toResult(d, { id: `recent:${d.href}`, group: 'Recent', hint: d.group }));
        const recentHrefs = new Set(recentIds);
        const pages = destinations
            .filter((d) => d.group === 'Pages' && !recentHrefs.has(d.href))
            .map((d) => toResult(d));
        return [...recent, ...pages, themeAction];
    }, [destinations, recentIds, toResult, themeAction]);

    const onSearch = useCallback(
        (query: string): SpotlightResult[] => {
            const q = query.trim().toLowerCase();
            const results = rankDestinations(destinations, q).map((d) => toResult(d));
            const actionHit = [themeAction.label, ...(themeAction.keywords ?? [])].some((t) =>
                t.toLowerCase().includes(q),
            );
            return actionHit ? [...results, themeAction] : results;
        },
        [destinations, toResult, themeAction],
    );

    return (
        <SpotlightProvider
            enabled={appConfig.features.spotlight.enabled}
            shortcuts={appConfig.features.spotlight.shortcuts}
            placeholder="Search pages, admin and demos…"
            emptyMessage="No matching pages"
            idleMessage="Type to search pages, admin and demos"
            searchDebounceMs={0}
            defaultResults={defaultResults}
            onSearch={onSearch}
            onResultSelect={(result) => {
                if (!result.id.startsWith('action:')) remember(result.id.replace(/^recent:/, ''));
            }}
            onOpenChange={(open) => {
                if (open) setOpened(true);
            }}
        >
            {children}
        </SpotlightProvider>
    );
}
