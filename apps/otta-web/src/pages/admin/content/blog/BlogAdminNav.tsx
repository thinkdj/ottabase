/**
 * Blog Admin Navigation Bar
 *
 * Persistent navigation across all admin blog pages.
 * Highlights the current section based on the URL.
 */
import { getLongestNavMatch } from '@/ottabase/components/layout/layout.constants';
import { Button } from '@ottabase/ui-shadcn';
import { Link, useLocation } from '@tanstack/react-router';
import { useMemo } from 'react';
import { FileText, FolderTree, Layers, Palette, Tag } from 'lucide-react';

const NAV_ITEMS = [
    { to: '/admin/content/blog', label: 'Content', icon: FileText, exact: true },
    { to: '/admin/content/blog/tags', label: 'Tag', icon: Tag },
    { to: '/admin/content/blog/categories', label: 'Category', icon: FolderTree },
    { to: '/admin/content/blog/series', label: 'Series', icon: Layers },
    { to: '/admin/content/blog/studio', label: 'Content Studio', icon: Palette },
] as const;

export function BlogAdminNav() {
    const { pathname } = useLocation();

    const activeNav = useMemo(
        () =>
            getLongestNavMatch(
                pathname,
                NAV_ITEMS.map((item) => item.to),
            ),
        [pathname],
    );

    return (
        <nav className="flex items-center gap-1 border-b pb-3 mb-6">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <Button key={to} asChild variant={activeNav === to ? 'default' : 'ghost'} size="sm">
                    <Link to={to}>
                        <Icon className="mr-1.5 h-4 w-4" />
                        {label}
                    </Link>
                </Button>
            ))}
        </nav>
    );
}
