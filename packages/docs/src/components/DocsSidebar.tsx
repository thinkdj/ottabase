import { memo, useMemo } from 'react';
import type { DocGroup, DocsConfig, DocsTheme } from '../types';
import { buildPageSlug, organizePages } from '../utils';

interface DocsSidebarProps {
    config: DocsConfig;
    activeSlug?: string;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onNavigate: (slug: string) => void;
    currentTheme?: DocsTheme;
    onThemeChange?: (theme: DocsTheme) => void;
    className?: string;
}

const THEMES: { theme: DocsTheme; label: string; symbol: string }[] = [
    { theme: 'compact', label: 'Compact', symbol: '−' },
    { theme: 'standard', label: 'Standard', symbol: '·' },
    { theme: 'spacious', label: 'Spacious', symbol: '+' },
];

export const DocsSidebar = memo(function DocsSidebar({
    config,
    activeSlug,
    searchQuery,
    onSearchChange,
    onNavigate,
    currentTheme,
    onThemeChange,
    className = '',
}: DocsSidebarProps) {
    const groups = useMemo<DocGroup[]>(() => {
        const all = organizePages(config.sources);
        if (!searchQuery.trim()) return all;

        const query = searchQuery.toLowerCase();
        return all
            .map((group) => ({
                ...group,
                pages: group.pages.filter((page) => page.title.toLowerCase().includes(query)),
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

            {/* Subtle layout switcher (compact / standard / spacious) */}
            {currentTheme != null && onThemeChange && (
                <div className="otta-docs-theme-switcher" role="group" aria-label="Layout density">
                    {THEMES.map(({ theme, label, symbol }) => (
                        <button
                            key={theme}
                            type="button"
                            title={label}
                            aria-pressed={currentTheme === theme}
                            className={`otta-docs-theme-btn ${currentTheme === theme ? 'otta-docs-theme-btn-active' : ''}`}
                            onClick={() => onThemeChange(theme)}
                        >
                            {symbol}
                        </button>
                    ))}
                </div>
            )}
        </aside>
    );
});
