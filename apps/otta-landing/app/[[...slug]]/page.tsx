import { LandingView } from '@ottabase/ottalanding/react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedPage, getSite, toPath } from '../../lib/content';
import { SetupNotice } from '../setup-notice';

type Props = { params: Promise<{ slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const [site, page] = await Promise.all([getSite(), getPublishedPage(toPath((await params).slug))]);
    if (!site || !page) return {};
    return { title: page.title, description: page.description || site.tagline };
}

export default async function LandingRoute({ params }: Props) {
    const path = toPath((await params).slug);
    const site = await getSite();
    if (!site) return <SetupNotice />;

    const page = await getPublishedPage(path);
    if (!page) notFound();

    return <LandingView site={site} sections={page.sections} currentPath={path} />;
}
