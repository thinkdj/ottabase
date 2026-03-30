import type { FooterData } from './types';

/**
 * Minimal footer — single-line copyright only.
 */
export function FooterMinimal({ siteName = 'Ottabase' }: FooterData) {
    return (
        <footer className="border-t border-border bg-background">
            <div className="mx-auto max-w-5xl px-4 py-4 text-center">
                <p className="text-xs text-muted-foreground">
                    © {new Date().getFullYear()} {siteName}
                </p>
            </div>
        </footer>
    );
}
