import { useMemo } from 'react';
import type { DocGroup, DocsConfig } from '../types';
import { buildPageSlug, organizePages } from '../utils';

interface DocsSidebarProps {
    config: DocsConfig;
    activeSlug?: string;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onNavigate: (slug: string) => void;
    className?: string;
}

export function DocsSidebar({
    config,
    activeSlug,
    searchQuery,
    onSearchChange,
    onNavigate,
    className = '',
}: DocsSidebarProps) {
    const groups = useMemo<DocGroup[]>(() => {
        const all = organizePages(config.sources);
        if (!searchQuery.trim()) return all;

        const query = searchQuery.toLowerCase();
        return all
            .map((group) => ({
                ...group,
                pages: group.pages.filter(
                    (page) => page.title.toLowerCase().includes(query) || page.content.toLowerCase().includes(query),
                ),
            }))
            .filter((group) => group.pages.length > 0);
    }, [config.sources, searchQuery]);

    const getFullSlug = (page: { slug: string }) => {
        for (const source of config.sources) {
            const found = source.pages.find((p) => p.slug === page.slug);
            if (found) return buildPageSlug(source, found);
        }
        return page.slug;
    };

    return (
        <aside className={`otta-docs-sidebar ${className}`}>
            {/* Search */}
            <div className="otta-docs-sidebar-search">
                <input
                    type="text"
                    placeholder="Search docs..."
                    aria-label="Search documentation"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="otta-docs-search-input"
                />
            </div>

            {/* Navigation groups */}
            <nav className="otta-docs-sidebar-nav">
                {groups.map((group) => (
                    <div key={group.label} className="otta-docs-nav-group">
                        <p className="otta-docs-nav-group-label">{group.label}</p>
                        <ul className="otta-docs-nav-list">
                            {group.pages.map((page) => {
                                const fullSlug = getFullSlug(page);
                                const isActive = activeSlug === fullSlug || activeSlug === page.slug;
                                return (
                                    <li key={page.slug}>
                                        <button
                                            type="button"
                                            className={`otta-docs-nav-link ${isActive ? 'otta-docs-nav-active' : ''}`}
                                            onClick={() => onNavigate(fullSlug)}
                                        >
                                            {page.title}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>
        </aside>
    );
}
