/**
 * Blog Admin Navigation Bar
 *
 * Persistent navigation across all admin blog pages.
 * Highlights the current section based on the URL.
 */
import { Button } from '@ottabase/ui-shadcn';
import { Link, useLocation } from '@tanstack/react-router';
import { FileText, FolderTree, Layers, Palette, Tag } from 'lucide-react';

const NAV_ITEMS = [
    { to: '/admin/blog', label: 'Content', icon: FileText, exact: true },
    { to: '/admin/blog/tags', label: 'Tag', icon: Tag },
    { to: '/admin/blog/categories', label: 'Category', icon: FolderTree },
    { to: '/admin/blog/series', label: 'Series', icon: Layers },
    { to: '/admin/blog/studio', label: 'Content Studio', icon: Palette },
] as const;

export function BlogAdminNav() {
    const { pathname } = useLocation();

    const isActive = (to: string, exact?: boolean) => {
        if (exact) return pathname === to;
        return pathname.startsWith(to);
    };

    return (
        <nav className="flex items-center gap-1 border-b pb-3 mb-6">
            {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
                <Button key={to} asChild variant={isActive(to, exact) ? 'default' : 'ghost'} size="sm">
                    <Link to={to}>
                        <Icon className="mr-1.5 h-4 w-4" />
                        {label}
                    </Link>
                </Button>
            ))}
        </nav>
    );
}
