import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPageBySlug } from '../../../lib/api';
import { PageContent } from './page-content';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const page = await fetchPageBySlug(slug);
    if (!page) return { title: 'Not Found' };
    return {
        title: page.seoMeta?.title || page.title,
        description: page.seoMeta?.description || page.excerpt || undefined,
        keywords: page.seoMeta?.keywords,
    };
}

export default async function CmsPage({ params }: PageProps) {
    const { slug } = await params;
    const page = await fetchPageBySlug(slug);
    if (!page) notFound();
    return <PageContent page={page} />;
}
