import { sanitizeUrl } from '@ottabase/utils/sanitize';
import type { AnchorHTMLAttributes, FC, ReactNode } from 'react';
import type { SectionData, SectionType } from '../sections';
import type { SiteSettings } from '../site';

/** What a theme must provide: a page shell and one component per section type. */
export type ShellProps = { site: SiteSettings; currentPath?: string; children: ReactNode };
export type ThemeComponents = {
    Shell: FC<ShellProps>;
    sections: { [T in SectionType]: FC<SectionData<T>> };
};

export type Action = { label: string; href: string };

export const focusRing =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const isExternal = (href: string) => /^https?:\/\//i.test(href);

/** Every content link goes through here: sanitized href, new tab for external sites. */
export function SiteLink({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    const safe = sanitizeUrl(href);
    const external = isExternal(safe);
    return (
        <a href={safe} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
            {children}
        </a>
    );
}

/** Sanitized image source, or undefined when there is nothing safe to show. */
export function safeSrc(src?: string): string | undefined {
    const safe = src ? sanitizeUrl(src) : '#';
    return safe === '#' ? undefined : safe;
}

/** Split a textarea body into paragraphs on blank lines. */
export function paragraphs(body?: string): string[] {
    return (body ?? '')
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
}

/** Whether a nav href points at the page being viewed (ignores in-page anchors). */
export function isCurrent(href: string, currentPath?: string): boolean {
    return currentPath !== undefined && href === currentPath;
}

/** Initials for an avatar fallback. */
export function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('');
}

/** Native, JS-free mobile menu: a <details> disclosure. */
export function MobileMenu({ site, className = '' }: { site: SiteSettings; className?: string }) {
    if (!site.nav?.length && !site.navCtaHref) return null;
    return (
        <details className={`group relative ${className}`}>
            <summary
                className={`flex h-10 cursor-pointer list-none items-center rounded-md px-3 text-sm font-medium [&::-webkit-details-marker]:hidden ${focusRing}`}
                aria-label="Menu"
            >
                <span className="group-open:hidden">Menu</span>
                <span className="hidden group-open:inline">Close</span>
            </summary>
            <nav className="absolute right-0 z-50 mt-2 flex w-56 flex-col rounded-lg border border-border bg-background p-2 shadow-lg">
                {site.nav?.map((l) => (
                    <SiteLink
                        key={l.href + l.label}
                        href={l.href}
                        className={`rounded-md px-3 py-2 text-sm hover:bg-muted ${focusRing}`}
                    >
                        {l.label}
                    </SiteLink>
                ))}
                {site.navCtaHref && site.navCtaLabel && (
                    <SiteLink
                        href={site.navCtaHref}
                        className={`mt-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground ${focusRing}`}
                    >
                        {site.navCtaLabel}
                    </SiteLink>
                )}
            </nav>
        </details>
    );
}
