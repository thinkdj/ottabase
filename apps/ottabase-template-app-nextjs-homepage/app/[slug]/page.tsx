import { notFound } from 'next/navigation';
import { fetchMarketingNav, fetchMarketingPage } from '../../lib/api';
import { MarketingPageContent } from './marketing-page-content';

export async function generateStaticParams() {
    const nav = await fetchMarketingNav();
    return nav.pages.map((page) => ({ slug: page.slug }));
}

export default async function DynamicMarketingPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ preview?: string }>;
}) {
    const { slug } = await params;
    const { preview } = await searchParams;
    const previewEnabled = preview === 'true';

    const response = await fetchMarketingPage(slug, previewEnabled);
    if (!response?.page) {
        notFound();
    }

    return <MarketingPageContent page={response.page} />;
}
