import { LandingView } from '@ottabase/ottalanding/react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedPage, getSite, toPath } from '../../lib/content';
import { SetupNotice } from '../setup-notice';

type Props = { params: Promise<{ slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    // Site first: before otta-web's first migration there are no tables, and the page shows setup steps.
    const site = await getSite();
    if (!site) return {};
    const page = await getPublishedPage(toPath((await params).slug));
    if (!page) return {};
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

export default async function LandingRoute({ params }: Props) {
    const path = toPath((await params).slug);
    const site = await getSite();
    if (!site) return <SetupNotice />;

    const page = await getPublishedPage(path);
    if (!page) notFound();

    return <LandingView site={site} sections={page.sections} currentPath={path} title={page.title} />;
}
