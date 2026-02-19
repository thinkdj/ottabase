import { useCallback, useEffect, useState } from 'react';
import type { DocsConfig } from '../types';
import { buildPageSlug, findPageBySlug } from '../utils';
import { DocsSidebar } from './DocsSidebar';
import { MarkdownRenderer, TableOfContents } from './MarkdownRenderer';

export interface DocsLayoutProps {
    /** Docs configuration with sources and pages */
    config: DocsConfig;
    /** Current active slug (controlled by parent routing) */
    activeSlug?: string;
    /** Callback when user navigates to a different page */
    onNavigate?: (slug: string) => void;
    /** Additional class name */
    className?: string;
}

/** Map theme name to CSS class */
function getThemeClass(theme?: string): string {
    switch (theme) {
        case 'github':
            return 'otta-docs-theme-github';
        case 'notion':
            return 'otta-docs-theme-notion';
        default:
            return '';
    }
}

/**
 * Full documentation layout with left sidebar, markdown content, and right TOC.
 * Minimal, clean design. Supports theme switching via config.theme.
 */
export function DocsLayout({ config, activeSlug, onNavigate, className = '' }: DocsLayoutProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTocId, setActiveTocId] = useState<string>('');
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const themeClass = getThemeClass(config.theme);

    // Resolve active page
    const activePage = activeSlug ? findPageBySlug(config.sources, activeSlug) : config.sources[0]?.pages[0];

    // Get previous/next for pagination
    const allPages = config.sources.flatMap((source) =>
        source.pages.map((page) => ({
            slug: buildPageSlug(source, page),
            title: page.title,
        })),
    );
    const currentIndex = allPages.findIndex((p) => p.slug === activeSlug);
    const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : undefined;
    const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : undefined;

    const handleNavigate = useCallback(
        (slug: string) => {
            setMobileNavOpen(false);
            onNavigate?.(slug);
        },
        [onNavigate],
    );

    const handleTocClick = useCallback((id: string) => {
        setActiveTocId(id);
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    // Track scroll position for TOC highlighting
    useEffect(() => {
        if (!activePage) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveTocId(entry.target.id);
                    }
                }
            },
            { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
        );

        const headings = document.querySelectorAll(
            '.otta-docs-content h2, .otta-docs-content h3, .otta-docs-content h4',
        );
        headings.forEach((h) => observer.observe(h));

        return () => observer.disconnect();
    }, [activePage]);

    return (
        <div className={`otta-docs-layout ${themeClass} ${className}`.trim()}>
            {/* Mobile nav toggle */}
            <button
                type="button"
                className="otta-docs-mobile-toggle"
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                aria-label="Toggle navigation"
            >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>Menu</span>
            </button>

            {/* Mobile nav overlay */}
            {mobileNavOpen && <div className="otta-docs-mobile-overlay" onClick={() => setMobileNavOpen(false)} />}

            {/* Left sidebar */}
            <DocsSidebar
                config={config}
                activeSlug={activeSlug}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onNavigate={handleNavigate}
                className={mobileNavOpen ? 'otta-docs-sidebar-open' : ''}
            />

            {/* Main content */}
            <main className="otta-docs-main">
                {activePage ? (
                    <>
                        <article className="otta-docs-article">
                            <MarkdownRenderer
                                content={activePage.content}
                                enableCodeHighlight={config.enableCodeHighlight}
                            />

                            {/* Prev/Next navigation */}
                            {(prevPage || nextPage) && (
                                <div className="otta-docs-pagination">
                                    {prevPage ? (
                                        <button
                                            type="button"
                                            className="otta-docs-pagination-btn otta-docs-pagination-prev"
                                            onClick={() => handleNavigate(prevPage.slug)}
                                        >
                                            <span className="otta-docs-pagination-label">Previous</span>
                                            <span className="otta-docs-pagination-title">{prevPage.title}</span>
                                        </button>
                                    ) : (
                                        <div />
                                    )}
                                    {nextPage ? (
                                        <button
                                            type="button"
                                            className="otta-docs-pagination-btn otta-docs-pagination-next"
                                            onClick={() => handleNavigate(nextPage.slug)}
                                        >
                                            <span className="otta-docs-pagination-label">Next</span>
                                            <span className="otta-docs-pagination-title">{nextPage.title}</span>
                                        </button>
                                    ) : (
                                        <div />
                                    )}
                                </div>
                            )}
                        </article>

                        {/* Right TOC */}
                        <TableOfContents
                            content={activePage.content}
                            activeId={activeTocId}
                            onItemClick={handleTocClick}
                            className="otta-docs-toc-sidebar"
                        />
                    </>
                ) : (
                    <div className="otta-docs-empty">
                        <p>Select a page from the sidebar to get started.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
