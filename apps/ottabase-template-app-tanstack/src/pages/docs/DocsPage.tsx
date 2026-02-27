import { DocsLayout, buildPageSlug } from '@ottabase/docs';
import '@ottabase/docs/styles.css';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect } from 'react';
import { docsConfig } from './docs.config';

const BASE_PATH = '/docs';

export function DocsPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const isOnDocsRoute = location.pathname === BASE_PATH || location.pathname.startsWith(`${BASE_PATH}/`);
    const activeSlug = location.pathname.replace(`${BASE_PATH}/`, '').replace(/^\/+|\/+$/g, '') || undefined;

    useEffect(() => {
        if (!isOnDocsRoute || activeSlug || docsConfig.sources.length === 0) return;
        const firstSource = docsConfig.sources.find((s) => s.pages.length > 0);
        if (firstSource?.pages[0]) {
            navigate({ to: `${BASE_PATH}/${buildPageSlug(firstSource, firstSource.pages[0])}` as string });
        }
    }, [isOnDocsRoute, activeSlug, navigate]);

    const handleNavigate = useCallback(
        (slug: string) => navigate({ to: `${BASE_PATH}/${slug}` as string }),
        [navigate],
    );

    return <DocsLayout config={docsConfig} activeSlug={activeSlug} onNavigate={handleNavigate} />;
}
