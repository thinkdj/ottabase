import { DocsLayout } from '@ottabase/docs';
import '@ottabase/docs/styles.css';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { docsConfig } from './docs.config';

export function DocsPage() {
    const location = useLocation();
    const navigate = useNavigate();

    // Extract slug from URL path after /docs/
    const basePath = '/docs';
    const activeSlug = location.pathname.replace(`${basePath}/`, '').replace(/^\/+|\/+$/g, '') || undefined;

    const handleNavigate = (slug: string) => {
        navigate({ to: `${basePath}/${slug}` });
    };

    return <DocsLayout config={docsConfig} activeSlug={activeSlug} onNavigate={handleNavigate} />;
}
