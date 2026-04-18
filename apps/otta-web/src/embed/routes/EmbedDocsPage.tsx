// ---------------------------------------------------------------------------
// Embed: Docs Page — renders package documentation in a minimal, chromeless
// layout designed for iframe embedding. Light/Dark Theme can be controlled
// via ?theme= param.
//
// This component runs inside the EmbedApp provider tree, which has NO session,
// brand, blog state, or org fetches — only QueryClient + next-themes.
// ---------------------------------------------------------------------------

import { docsConfig } from '@/pages/docs/docs.config';
import { DocsLayout, buildPageSlug } from '@ottabase/docs';
import '@ottabase/docs/styles.css';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useTheme } from 'next-themes';
import { useCallback, useEffect } from 'react';

const BASE_PATH = '/embed/docs';

export function EmbedDocsPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { setTheme } = useTheme();

    // Apply theme from ?theme=dark|light query parameter
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const requestedTheme = params.get('theme');
        if (requestedTheme === 'dark' || requestedTheme === 'light') {
            setTheme(requestedTheme);
        }
    }, [setTheme]);

    // Extract slug: handle both /embed/docs and /embed/docs/some-slug
    const rawSlug =
        location.pathname === BASE_PATH || location.pathname === `${BASE_PATH}/`
            ? ''
            : location.pathname.replace(`${BASE_PATH}/`, '').replace(/^\/+|\/+$/g, '');
    const activeSlug = rawSlug || undefined;

    // Auto-navigate to the first page when landing on bare /embed/docs
    useEffect(() => {
        if (activeSlug || docsConfig.sources.length === 0) return;
        const firstSource = docsConfig.sources.find((s) => s.pages.length > 0);
        if (firstSource?.pages[0]) {
            navigate({ to: `${BASE_PATH}/${buildPageSlug(firstSource, firstSource.pages[0])}` as string });
        }
    }, [activeSlug, navigate]);

    const handleNavigate = useCallback(
        (slug: string) => navigate({ to: `${BASE_PATH}/${slug}` as string }),
        [navigate],
    );

    return <DocsLayout config={docsConfig} activeSlug={activeSlug} onNavigate={handleNavigate} />;
}
