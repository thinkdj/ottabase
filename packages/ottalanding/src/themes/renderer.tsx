/**
 * @ottabase/ottalanding — Page Renderer
 *
 * Takes structured page content + a theme and renders the full page.
 * The theme decides how each section looks — this just orchestrates.
 */

import type { PageContent, SectionType, SiteContent } from '../types';
import type { LandingTheme } from './types';

/**
 * Render a single section using the given theme.
 * Returns null if the section type isn't supported by the theme.
 */
export function renderSection(
    theme: LandingTheme,
    type: SectionType,
    content: unknown,
    className?: string,
) {
    const SectionComponent = theme.sections[type];
    if (!SectionComponent) return null;
    return <SectionComponent content={content as any} className={className} />;
}

/**
 * Render a full page: navbar + sections (in order) + footer.
 */
export function renderPage(
    theme: LandingTheme,
    site: SiteContent,
    page: PageContent,
) {
    const Navbar = theme.navbar;
    const Footer = theme.footer;

    const visibleSections = page.sections
        .filter((s) => s.visible !== false)
        .sort((a, b) => a.order - b.order);

    return (
        <>
            <Navbar site={site} />
            <main>
                {visibleSections.map((section, i) => (
                    <div key={`${section.type}-${i}`}>
                        {renderSection(theme, section.type, section.content)}
                    </div>
                ))}
            </main>
            <Footer site={site} />
        </>
    );
}
