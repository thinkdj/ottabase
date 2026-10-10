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
