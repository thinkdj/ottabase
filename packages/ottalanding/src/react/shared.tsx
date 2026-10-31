import { safeImageProps, sanitizeUrl } from '@ottabase/utils/sanitize';
import type { AnchorHTMLAttributes, FC, ReactNode } from 'react';
import type { SectionData, SectionType } from '../sections';
import type { SiteSettings } from '../site';

/** What a theme must provide: a page shell and one component per section type. */
export type ShellProps = { site: SiteSettings; currentPath?: string; children: ReactNode };
/**
 * What every section component receives: its content, plus `lead` — true only for the page's
 * first hero, which owns the page's single <h1>.
 */
export type SectionProps<T extends SectionType> = SectionData<T> & { lead?: boolean };
export type ThemeComponents = {
    Shell: FC<ShellProps>;
    sections: { [T in SectionType]: FC<SectionProps<T>> };
};

export type Action = { label: string; href: string };

/** `sizes` for the small image slots every theme shares: a logo in a strip, a testimonial photo. */
export const LOGO_SIZES = '10rem';
export const AVATAR_SIZES = '2.5rem';

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
                {site.nav?.map((l, i) => (
                    <SiteLink
                        key={i}
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

/**
 * The home link's content: the site's logo and/or name. The name is always what the link is
 * called — as the logo's alt text when the logo shows it, as visible text otherwise.
 */
export function SiteBrand({ site, logoClassName = 'h-8' }: { site: SiteSettings; logoClassName?: string }) {
    // At most 12rem wide (the class below), so a small rendition is plenty.
    const logo = safeImageProps(site.logo, '12rem');
    if (!logo) return <>{site.name}</>;
    return (
        <span className="inline-flex items-center gap-2.5">
            <img
                {...logo}
                alt={site.logoIncludesName ? site.name : ''}
                className={`${logoClassName} w-auto max-w-[12rem] object-contain`}
            />
            {!site.logoIncludesName && <span>{site.name}</span>}
        </span>
    );
}
