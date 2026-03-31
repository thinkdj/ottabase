/**
 * Dynamic Marketing Page Route
 *
 * Handles marketing pages created via Admin → Marketing Pages.
 * Fetches page data from /api/pages/:slug and renders block-based layouts.
 *
 * Routes:
 * - /{slug} → This component (e.g., /pricing, /about-us, /features)
 * - / (homepage) → app/(site)/page.tsx
 * - /page/{slug} → app/page/[slug]/page.tsx (ottablog content pages)
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPageByPageSlug } from '../../lib/api';
import { MarketingPageContent } from './marketing-page-content';

interface PageProps {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ preview?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const { preview } = await searchParams;
    const isPreview = preview === 'true';

    // Don't handle homepage here - let (site)/page.tsx handle it
    if (slug === 'homepage') {
        return { title: 'Home' };
    }

    const pageData = await fetchPageByPageSlug(slug, isPreview);
    if (!pageData) return { title: 'Not Found' };

    return {
        title: pageData.display.seoTitle || pageData.page.title,
        description: pageData.display.seoDescription || undefined,
        openGraph: pageData.display.seoImage
            ? {
                  images: [{ url: pageData.display.seoImage }],
              }
            : undefined,
    };
}

export default async function MarketingPage({ params, searchParams }: PageProps) {
    const { slug } = await params;
    const { preview } = await searchParams;
    const isPreview = preview === 'true';

    // Don't handle homepage here - redirect or let (site)/page.tsx handle it
    if (slug === 'homepage') {
        notFound(); // Or redirect to /
    }

    const pageData = await fetchPageByPageSlug(slug, isPreview);

    // If no marketing page found, show 404
    if (!pageData) {
        notFound();
    }

    // Only show published pages (unless in preview mode)
    if (!isPreview && pageData.page.status !== 'published') {
        notFound();
    }

    return <MarketingPageContent pageData={pageData} isPreview={isPreview} />;
}
