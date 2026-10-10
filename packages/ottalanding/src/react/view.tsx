// LandingView: a full page drawn by the site's theme. Server-safe (no hooks).

import type { FC } from 'react';
import type { Section } from '../sections';
import type { SiteSettings } from '../site';
import { getTheme, type ThemeId } from '../themes';
import type { ThemeComponents } from './shared';
import { bold } from './themes/bold';
import { editorial } from './themes/editorial';
import { launch } from './themes/launch';

export type { ShellProps, ThemeComponents } from './shared';

export const THEME_COMPONENTS: Record<ThemeId, ThemeComponents> = { launch, editorial, bold };

export type LandingViewProps = {
    site: SiteSettings;
    sections: Section[];
    /** The path being shown, so the theme can mark the current nav link. */
    currentPath?: string;
};

/**
 * A full page in the site's theme. Expects the theme's tokens to be in scope
 * (`themeStyles()` on `:root` for the live site; `LandingPreview` does it for you).
 * The first section of each type gets an anchor id, so `/#pricing` links work.
 */
export function LandingView({ site, sections, currentPath }: LandingViewProps) {
    const id = getTheme(site.theme).id;
    const theme = THEME_COMPONENTS[id];
    const anchored = new Set<string>();
    return (
        <div data-landing-theme={id} className="min-h-screen bg-background font-sans text-foreground antialiased">
            <theme.Shell site={site} currentPath={currentPath}>
                {sections.map((section) => {
                    const Component = theme.sections[section.type] as FC<Section['data']>;
                    const anchor = anchored.has(section.type) ? undefined : section.type;
                    anchored.add(section.type);
                    return (
                        <section key={section.id} id={anchor} className="scroll-mt-24">
                            <Component {...section.data} />
                        </section>
                    );
                })}
            </theme.Shell>
        </div>
    );
}
