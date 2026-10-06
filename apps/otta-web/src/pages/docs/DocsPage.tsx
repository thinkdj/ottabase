import { SEOHead } from '@/components/SEOHead';
import { APP_META } from '@/ottabase/config';
import { DocsLayout } from '@ottabase/docs/react';
import { buildPageSlug } from '@ottabase/docs';
import '@ottabase/docs/styles.css';
import { useLayoutMeta } from '@ottabase/ottalayout/react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo } from 'react';
import { docsConfig } from './docs.config';

const BASE_PATH = '/docs';

export function DocsPage() {
    // Full-bleed docs layout: remove shell padding/max-width so docs manages its own sizing
    useLayoutMeta({ contentWidth: 'full', containerPadding: 'none', density: 'compact', footer: false });

    const location = useLocation();
    const navigate = useNavigate();
    const isOnDocsRoute = location.pathname === BASE_PATH || location.pathname.startsWith(`${BASE_PATH}/`);
    // "/docs" itself has no slug (it must redirect), "/docs/guides/x/" → "guides/x"
    const activeSlug = location.pathname.startsWith(`${BASE_PATH}/`)
        ? location.pathname.slice(BASE_PATH.length + 1).replace(/\/+$/, '') || undefined
        : undefined;

    useEffect(() => {
        if (!isOnDocsRoute || activeSlug || docsConfig.sources.length === 0) return;
        const firstSource = docsConfig.sources.find((s) => s.pages.length > 0);
        if (firstSource?.pages[0]) {
            // replace: Back from the start page should leave docs, not bounce through /docs
            navigate({
                to: `${BASE_PATH}/${buildPageSlug(firstSource, firstSource.pages[0])}` as string,
                replace: true,
            });
        }
    }, [isOnDocsRoute, activeSlug, navigate]);

    const handleNavigate = useCallback(
        (slug: string) => navigate({ to: `${BASE_PATH}/${slug}` as string }),
        [navigate],
    );

    const activeTitle = useMemo(() => {
        for (const source of docsConfig.sources) {
            const page = source.pages.find((candidate) => buildPageSlug(source, candidate) === activeSlug);
            if (page) return page.title;
        }
        return 'Docs';
    }, [activeSlug]);

    return (
        <>
            <SEOHead title={`${activeTitle} · ${APP_META.appName}`} />
            <DocsLayout config={docsConfig} activeSlug={activeSlug} onNavigate={handleNavigate} />
        </>
    );
}
