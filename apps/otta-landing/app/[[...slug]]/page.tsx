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
    return {
        title: page.title,
        description,
        // Absolute URLs need the site's public address (metadataBase, set in the layout).
        ...(site.siteUrl ? { alternates: { canonical: page.path } } : {}),
        openGraph: {
            type: 'website',
            siteName: site.name,
            title: page.title,
            description,
            ...(site.siteUrl ? { url: page.path } : {}),
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
