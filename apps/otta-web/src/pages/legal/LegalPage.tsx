/**
 * One page that serves every legal document through @ottabase/legal, mounted on the `/legal/$` splat route:
 *   /legal            the index of the published policies
 *   /legal/terms ...  the matching document
 * All content and toggles live in ottabase/legal.config.ts; the Worker serves the same documents at /api/legal.
 */
import { listLegalDocuments, resolveLegalSlug } from '@ottabase/legal';
import { LegalDocument, LegalIndex } from '@ottabase/legal/react';
import '@ottabase/legal/styles.css';
import { useLayoutMeta } from '@ottabase/ottalayout/react';
import { Link, useLocation } from '@tanstack/react-router';
import { SEOHead } from '@/components/SEOHead';
import { legalConfig } from '../../../ottabase/legal.config';

const BASE_PATH = legalConfig.basePath ?? '/legal';

export function LegalPage() {
    // Full-bleed: the package's .otta-legal wrapper manages its own width and padding.
    useLayoutMeta({ contentWidth: 'full', containerPadding: 'none' });

    const { pathname } = useLocation();
    const slug = pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length).replace(/^\/+|\/+$/g, '') : '';

    if (!slug) {
        return (
            <>
                <SEOHead
                    title={`Legal · ${legalConfig.appName}`}
                    description={`The policies that govern ${legalConfig.appName}.`}
                />
                <LegalIndex
                    config={legalConfig}
                    heading={<h1 className="otta-legal-title">Legal</h1>}
                    renderItem={(doc) => (
                        <Link className="otta-legal-index-item" to={`${BASE_PATH}/${doc.slug}` as '/'}>
                            <h3>{doc.title}</h3>
                        </Link>
                    )}
                />
            </>
        );
    }

    const docId = resolveLegalSlug(slug, legalConfig);
    if (!docId) {
        return (
            <div className="otta-legal">
                <SEOHead title={`Not found · ${legalConfig.appName}`} noIndex />
                <h1 className="otta-legal-title">Not found</h1>
                <p className="otta-legal-meta">There is no policy at this address. These are the published ones:</p>
                <nav className="otta-legal-index">
                    {listLegalDocuments(legalConfig).map((doc) => (
                        <Link key={doc.id} className="otta-legal-index-item" to={`${BASE_PATH}/${doc.slug}` as '/'}>
                            <h3>{doc.title}</h3>
                        </Link>
                    ))}
                </nav>
            </div>
        );
    }

    const title = listLegalDocuments(legalConfig).find((d) => d.id === docId)?.title ?? 'Legal';
    return (
        <>
            <SEOHead
                title={`${title} · ${legalConfig.appName}`}
                description={`${title} for ${legalConfig.appName}.`}
                canonicalUrl={`${legalConfig.siteUrl}${BASE_PATH}/${slug}`}
            />
            <LegalDocument docId={docId} config={legalConfig} />
        </>
    );
}
