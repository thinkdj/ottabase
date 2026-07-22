/**
 * Studio Shell — the writing-first editorial surface at /studio.
 *
 * Deliberately NOT a second admin: same session, same ProtectedRoute machinery,
 * same blog pages — just a focused chrome for people whose job is content.
 * Gated by content permissions (posts:*), never by org:admin or platform admin,
 * so authors and editors get a workspace without seeing the control plane.
 */
import { Link } from '@tanstack/react-router';
import { ExternalLink, PenLine } from 'lucide-react';
import type { ReactNode } from 'react';

// Widened to string: these routes are registered dynamically (package-gated),
// so they are absent from the static route-union type.
const PATHS: Record<'studio' | 'blog', string> = { studio: '/studio', blog: '/blog' };

export function StudioShell({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
                <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
                    <Link to={PATHS.studio} className="inline-flex items-center gap-2 font-semibold">
                        <PenLine className="h-4 w-4" />
                        Studio
                    </Link>
                    <nav className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Link to={PATHS.blog} className="inline-flex items-center gap-1.5 hover:text-foreground">
                            View blog
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                    </nav>
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </div>
    );
}
