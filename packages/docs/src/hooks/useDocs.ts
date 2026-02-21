import { useMemo, useState } from 'react';
import type { DocsConfig } from '../types';
import { buildPageSlug, findPageBySlug, organizePages } from '../utils';

export interface UseDocsOptions {
    config: DocsConfig;
    /** Currently active slug (from URL) */
    activeSlug?: string;
}

export function useDocs({ config, activeSlug }: UseDocsOptions) {
    const [searchQuery, setSearchQuery] = useState('');

    const groups = useMemo(() => organizePages(config.sources), [config.sources]);

    const activePage = useMemo(() => {
        if (!activeSlug) {
            // Default to first page
            for (const source of config.sources) {
                if (source.pages.length > 0) {
                    return source.pages[0];
                }
            }
            return undefined;
        }
        return findPageBySlug(config.sources, activeSlug);
    }, [config.sources, activeSlug]);

    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return groups;

        const query = searchQuery.toLowerCase();
        return groups
            .map((group) => ({
                ...group,
                pages: group.pages.filter((page) => page.title.toLowerCase().includes(query)),
            }))
            .filter((group) => group.pages.length > 0);
    }, [groups, searchQuery]);

    /** Get the full slug for navigation */
    const getPageSlug = (sourceIndex: number, pageSlug: string): string => {
        const source = config.sources[sourceIndex];
        if (!source) return pageSlug;
        const page = source.pages.find((p) => p.slug === pageSlug);
        if (!page) return pageSlug;
        return buildPageSlug(source, page);
    };

    /** Get previous and next pages for navigation */
    const navigation = useMemo(() => {
        const allPages: { slug: string; title: string }[] = [];
        for (const source of config.sources) {
            for (const page of source.pages) {
                allPages.push({
                    slug: buildPageSlug(source, page),
                    title: page.title,
                });
            }
        }

        const currentIndex = allPages.findIndex((p) => p.slug === activeSlug);
        return {
            prev: currentIndex > 0 ? allPages[currentIndex - 1] : undefined,
            next: currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : undefined,
        };
    }, [config.sources, activeSlug]);

    return {
        groups,
        filteredGroups,
        activePage,
        searchQuery,
        setSearchQuery,
        getPageSlug,
        navigation,
    };
}
