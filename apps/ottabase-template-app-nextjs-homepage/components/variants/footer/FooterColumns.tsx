import Link from 'next/link';
import type { FooterData } from './types';

/**
 * Columns footer — multi-column layout with grouped links.
 */
export function FooterColumns({ siteName = 'Ottabase', links = [], tagline }: FooterData) {
    // Split links into two columns for visual balance
    const mid = Math.ceil(links.length / 2);
    const leftLinks = links.slice(0, mid);
    const rightLinks = links.slice(mid);

    return (
        <footer className="border-t border-border bg-background">
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-3">
                {/* Brand column */}
                <div>
                    <p className="font-heading text-sm font-semibold text-foreground">{siteName}</p>
                    {tagline && <p className="mt-1 text-xs text-muted-foreground">{tagline}</p>}
                    <p className="mt-3 text-xs text-muted-foreground">
                        © {new Date().getFullYear()} {siteName}
                    </p>
                </div>

                {/* Links column 1 */}
                {leftLinks.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Links</p>
                        {leftLinks.map((link) =>
                            link.external ? (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    {link.label}
                                </a>
                            ) : (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    {link.label}
                                </Link>
                            ),
                        )}
                    </div>
                )}

                {/* Links column 2 */}
                {rightLinks.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">More</p>
                        {rightLinks.map((link) =>
                            link.external ? (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    {link.label}
                                </a>
                            ) : (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    {link.label}
                                </Link>
                            ),
                        )}
                    </div>
                )}
            </div>
        </footer>
    );
}
