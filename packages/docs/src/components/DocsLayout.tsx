import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocsConfig, DocsTheme } from '../types';
import { buildPageSlug, findPageBySlug } from '../utils';
import { DocsSidebar } from './DocsSidebar';
import { MarkdownRenderer, TableOfContents } from './MarkdownRenderer';

const STORAGE_KEY = 'ottabase.docs.theme';

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

/** Map theme name to CSS class (default: standard) */
function getThemeClass(theme?: string): string {
    switch (theme) {
        case 'compact':
            return 'otta-docs-theme-compact';
        case 'spacious':
            return 'otta-docs-theme-spacious';
        case 'standard':
        default:
            return 'otta-docs-theme-standard';
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
    const [resolvedContent, setResolvedContent] = useState<string>('');
    const [isLoadingContent, setIsLoadingContent] = useState(false);

    const [themeOverride, setThemeOverride] = useState<DocsTheme | null>(null);
    const effectiveTheme: DocsTheme = themeOverride ?? config.theme ?? 'standard';
    const themeClass = getThemeClass(effectiveTheme);

    useEffect(() => {
        const stored = window.localStorage.getItem(STORAGE_KEY) as DocsTheme | null;
        if (stored && ['compact', 'standard', 'spacious'].includes(stored)) setThemeOverride(stored);
    }, []);

    const handleThemeChange = useCallback((theme: DocsTheme) => {
        setThemeOverride(theme);
        window.localStorage.setItem(STORAGE_KEY, theme);
    }, []);

    const activePage = useMemo(
        () => (activeSlug ? findPageBySlug(config.sources, activeSlug) : config.sources[0]?.pages[0]),
        [config.sources, activeSlug],
    );

    useEffect(() => {
        if (!activePage) {
            setResolvedContent('');
            return;
        }

        if (typeof activePage.content === 'string') {
            setResolvedContent(activePage.content);
        } else if (typeof activePage.content === 'function') {
            setIsLoadingContent(true);
            activePage
                .content()
                .then((mod) => {
                    setResolvedContent(typeof mod === 'string' ? mod : mod.default);
                    setIsLoadingContent(false);
                })
                .catch((err) => {
                    console.error('Failed to load markdown', err);
                    setResolvedContent('# Error loading content. Please try again later.');
                    setIsLoadingContent(false);
                });
        }
    }, [activePage]);

    const { prevPage, nextPage } = useMemo(() => {
        const allPages = config.sources.flatMap((source) =>
            source.pages.map((page) => ({
                slug: buildPageSlug(source, page),
                title: page.title,
            })),
        );
        const idx = allPages.findIndex((p) => p.slug === activeSlug);
        return {
            prevPage: idx > 0 ? allPages[idx - 1] : undefined,
            nextPage: idx < allPages.length - 1 && idx >= 0 ? allPages[idx + 1] : undefined,
        };
    }, [config.sources, activeSlug]);

    const handleNavigate = useCallback(
        (slug: string) => {
            setMobileNavOpen(false);
            setActiveTocId('');
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
                currentTheme={effectiveTheme}
                onThemeChange={handleThemeChange}
                className={mobileNavOpen ? 'otta-docs-sidebar-open' : ''}
            />

            {/* Main content */}
            <main
                className="otta-docs-main"
                style={{
                    opacity: isLoadingContent ? 0.25 : 1,
                    transition: 'opacity 0.2s ease-in-out',
                    pointerEvents: isLoadingContent ? 'none' : 'auto',
                }}
            >
                {activePage && resolvedContent ? (
                    <>
                        <article className="otta-docs-article">
                            <MarkdownRenderer
                                content={resolvedContent}
                                codeRenderMode={config.codeRenderMode ?? 'ui-code-highlight'}
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
                            content={resolvedContent}
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
