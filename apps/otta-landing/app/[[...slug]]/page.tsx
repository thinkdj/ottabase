import { LandingView } from '@ottabase/ottalanding/react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPage, getSite, toPath } from '../../lib/content';
import { SetupNotice } from '../setup-notice';

type Props = {
    params: Promise<{ slug?: string[] }>;
    searchParams: Promise<{ preview?: string | string[] }>;
};

/** The draft-preview token from `?preview=`, if any. */
const previewToken = async (searchParams: Props['searchParams']) => {
    const { preview } = await searchParams;
    return typeof preview === 'string' ? preview : undefined;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
    // Site first: before otta-web's first migration there are no tables, and the page shows setup steps.
    const site = await getSite();
    if (!site) return {};
    const page = await getPage(toPath((await params).slug), await previewToken(searchParams));
    if (!page) return {};
    // A draft preview is for the people it was shared with: never indexed, never canonical.
    if (!page.published) return { title: page.title, robots: 'noindex, nofollow' };
    const description = page.description || site.tagline;
    // The page's own social image, else the site's (relative upload URLs resolve via metadataBase).
    const image = page.share?.imageUrl || site.share?.imageUrl;
    const alt = page.share?.heading || (page.share ? page.title : site.share?.heading || site.name);
    return {
        title: page.title,
        description,
        // A canonical URL must name the real site, so it needs the configured Public URL.
        ...(site.siteUrl ? { alternates: { canonical: page.path } } : {}),
        openGraph: {
            type: 'website',
            siteName: site.name,
            title: page.title,
            description,
            ...(site.siteUrl ? { url: page.path } : {}),
            ...(image ? { images: [{ url: image, width: 1200, height: 630, alt }] } : {}),
        },
        twitter: {
            card: image ? 'summary_large_image' : 'summary',
            title: page.title,
            description,
            ...(image ? { images: [{ url: image, alt }] } : {}),
        },
    };
}

export default async function LandingRoute({ params, searchParams }: Props) {
    const path = toPath((await params).slug);
    const site = await getSite();
    if (!site) return <SetupNotice />;

    const page = await getPage(path, await previewToken(searchParams));
    if (!page) notFound();

    const view = <LandingView site={site} sections={page.sections} currentPath={path} title={page.title} />;
    if (page.published) return view;
    return (
        <>
            <p role="status" className="bg-foreground px-4 py-2 text-center text-sm font-medium text-background">
                Preview: this page isn’t published yet. Only people with this link can see it.
            </p>
            {view}
        </>
    );
}
