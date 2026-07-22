/**
 * Blog Admin Navigation Bar
 *
 * Persistent navigation across all admin blog pages.
 * Highlights the current section based on the URL.
 */
import { Link, useLocation } from '@tanstack/react-router';
import { FileText, FolderTree, Layers, Palette, Tag } from 'lucide-react';
import { useBlogSurface } from './blogAdminPaths';

export function BlogAdminNav() {
    const { pathname } = useLocation();
    const surface = useBlogSurface();

    // Links resolve against the active surface (/admin/content/blog or /studio),
    // so the same nav serves both the control plane and the editorial studio.
    const NAV_ITEMS = [
        { to: surface.contentPath, label: 'Content', icon: FileText, exact: true },
        { to: surface.tagsPath, label: 'Tag', icon: Tag, exact: false },
        { to: surface.categoriesPath, label: 'Category', icon: FolderTree, exact: false },
        { to: surface.seriesPath, label: 'Series', icon: Layers, exact: false },
        { to: surface.themesPath, label: 'Content Studio', icon: Palette, exact: false },
    ] as const;

    const isActive = (to: string, exact?: boolean) => {
        if (exact) return pathname === to;
        return pathname.startsWith(to);
    };

    return (
        <nav
            aria-label="Blog admin sections"
            className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg bg-muted/40 p-1"
        >
            {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
                const active = isActive(to, exact);
                return (
                    <Link
                        key={to}
                        to={to}
                        aria-current={active ? 'page' : undefined}
                        className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium outline-none transition-colors duration-normal focus-visible:ring-2 focus-visible:ring-ring ${
                            active
                                ? 'bg-background text-foreground ring-1 ring-border'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
