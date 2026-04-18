import Link from 'next/link';

type FooterLink = {
    href: string;
    label: string;
    external?: boolean;
};

type FooterProps = {
    /** Copyright holder name */
    siteName?: string;
    /** Additional links shown in the footer */
    links?: FooterLink[];
    /** Tagline text */
    tagline?: string;
};

export function Footer({ siteName = 'Ottabase', links = [], tagline }: FooterProps) {
    return (
        <footer className="border-t border-border bg-background">
            <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
                <div className="text-center sm:text-left">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} {siteName}. Open Source.
                    </p>
                    {tagline && <p className="mt-1 text-xs text-muted-foreground/70">{tagline}</p>}
                </div>

                {links.length > 0 && (
                    <div className="flex flex-wrap items-center gap-4">
                        {links.map((link) =>
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
