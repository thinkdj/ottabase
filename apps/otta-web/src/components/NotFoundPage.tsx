import { Link } from '@tanstack/react-router';

/**
 * 404 / Not Found page shown when a route doesn't match.
 * Used by TanStack Router's notFoundComponent on the root route.
 */
export function NotFoundPage() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
            <div className="space-y-3">
                <p className="font-serif text-6xl tracking-tight text-muted-foreground/40">404</p>
                <h1 className="font-serif text-2xl tracking-tight">This page is gone</h1>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                    The address doesn't match anything on this site.
                </p>
            </div>
            <Link
                to="/"
                className="text-[0.9375rem] text-muted-foreground underline decoration-foreground/20 underline-offset-4 hover:text-foreground"
                data-testid="link-back-home"
            >
                ← Writing
            </Link>
        </div>
    );
}
