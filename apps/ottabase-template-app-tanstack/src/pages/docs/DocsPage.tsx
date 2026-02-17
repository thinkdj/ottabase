import { DocsLayout, buildPageSlug } from '@ottabase/docs';
import '@ottabase/docs/styles.css';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { docsConfig } from './docs.config';

export function DocsPage() {
    const location = useLocation();
    const navigate = useNavigate();

    // Extract slug from URL path after /docs/
    const basePath = '/docs';
    const rawSlug = location.pathname.replace(`${basePath}/`, '').replace(/^\/+|\/+$/g, '');
    const activeSlug = rawSlug || undefined;

    // Auto-navigate to first page when no slug
    useEffect(() => {
        if (!activeSlug && docsConfig.sources.length > 0) {
            const firstSource = docsConfig.sources.find((s) => s.pages.length > 0);
            if (firstSource && firstSource.pages[0]) {
                const slug = buildPageSlug(firstSource, firstSource.pages[0]);
                navigate({ to: `${basePath}/${slug}` as string });
            }
        }
    }, [activeSlug, navigate]);

    const handleNavigate = (slug: string) => {
        navigate({ to: `${basePath}/${slug}` as string });
    };

    return <DocsLayout config={docsConfig} activeSlug={activeSlug} onNavigate={handleNavigate} />;
}
