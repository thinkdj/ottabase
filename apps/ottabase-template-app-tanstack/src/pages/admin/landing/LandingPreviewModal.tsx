'use client';

import { useQueries } from '@tanstack/react-query';
import {
    getLandingTheme,
    initOttaLanding,
    renderPage,
    type PageContent,
    type SiteContent,
} from '@ottabase/ottalanding';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ottabase/ui-shadcn';
import { landingSiteHooks, landingPageHooks } from '@/hooks/landingHooks';
import type { LandingPageItem, LandingSectionItem, LandingSiteItem } from '@/hooks/landingHooks';

initOttaLanding({ defaultThemeId: 'atlas' });

function siteToSiteContent(site: LandingSiteItem): SiteContent {
    return {
        name: site.name,
        tagline: site.tagline ?? undefined,
        logoUrl: site.logoUrl ?? undefined,
        logoDarkUrl: site.logoDarkUrl ?? undefined,
        faviconUrl: site.faviconUrl ?? undefined,
        navLinks: site.navLinks ?? [],
        navCta: site.navCta ?? undefined,
        footerSections: site.footerSections ?? [],
        socialLinks: site.socialLinks ?? [],
        legal: site.legal ?? undefined,
    };
}

function buildPageContent(page: LandingPageItem, sections: LandingSectionItem[]): PageContent {
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);
    return {
        slug: page.slug,
        title: page.title,
        metaDescription: page.metaDescription ?? undefined,
        ogImage: page.ogImage ?? undefined,
        sections: sortedSections.map((s) => ({
            type: s.sectionType as any,
            content: s.content ?? {},
            order: s.order,
            visible: s.visible,
        })),
    };
}

export interface LandingPreviewModalProps {
    siteId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LandingPreviewModal({ siteId, open, onOpenChange }: LandingPreviewModalProps) {
    const { data: siteData, isLoading: siteLoading } = landingSiteHooks.useDetail(siteId, {
        enabled: open && !!siteId,
    });
    const { data: pagesData, isLoading: pagesLoading } = landingPageHooks.useList(
        {
            where: { siteId },
            orderBy: 'order',
            orderDirection: 'asc',
        },
        { enabled: open && !!siteId },
    );

    const pages = (Array.isArray(pagesData) ? pagesData : []) as LandingPageItem[];
    const pageIds = pages.map((p) => p.id);

    const sectionQueries = useQueries({
        queries: pageIds.map((pageId) => ({
            queryKey: ['ottalanding_sections', pageId],
            queryFn: async () => {
                const res = await fetch(
                    `/api/ottaorm/ottalanding_sections?where=${encodeURIComponent(JSON.stringify({ pageId }))}`,
                );
                const json = await res.json();
                const data = json?.data;
                const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
                return list as LandingSectionItem[];
            },
            enabled: open && pageIds.length > 0,
        })),
    });

    const site = siteData as LandingSiteItem | null | undefined;
    const sectionsByPage = sectionQueries.reduce<Record<string, LandingSectionItem[]>>((acc, q, i) => {
        const list = (q.data ?? []) as LandingSectionItem[];
        if (pageIds[i]) acc[pageIds[i]] = list;
        return acc;
    }, {});

    const isLoading = siteLoading || pagesLoading || sectionQueries.some((q) => q.isLoading);

    const theme = site ? (getLandingTheme(site.themeId) ?? getLandingTheme('atlas')!) : null;
    const siteContent = site ? siteToSiteContent(site) : null;
    // Homepage: explicit homePageId > slug "home" > first by order
    const pageToShow =
        pages.find((p) => site?.homePageId && p.id === site.homePageId) ??
        pages.find((p) => p.slug === 'home') ??
        (pages.length > 0 ? pages[0] : null);
    const pageContent: PageContent | null =
        siteContent && pageToShow
            ? buildPageContent(pageToShow, sectionsByPage[pageToShow.id] ?? [])
            : siteContent
              ? { slug: 'home', title: site?.name ?? 'Preview', sections: [] }
              : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col gap-0 p-0 sm:max-w-[95vw]">
                <DialogHeader className="shrink-0 border-b px-4 py-3">
                    <DialogTitle className="text-base">Preview — {site?.name ?? 'Loading…'}</DialogTitle>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-auto">
                    {isLoading ? (
                        <div className="flex min-h-[320px] items-center justify-center p-8">
                            <p className="text-sm text-muted-foreground">Loading preview…</p>
                        </div>
                    ) : !site ? (
                        <div className="flex min-h-[320px] items-center justify-center p-8">
                            <p className="text-sm text-muted-foreground">Site not found.</p>
                        </div>
                    ) : theme && siteContent && pageContent ? (
                        <div className="prose dark:prose-invert max-w-none bg-background [&_main]:min-h-0">
                            {renderPage(theme, siteContent, pageContent)}
                        </div>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}
