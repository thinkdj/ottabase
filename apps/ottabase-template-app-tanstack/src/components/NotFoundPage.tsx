import { Button } from '@ottabase/ui-shadcn';
import { IconHome, IconMapPinOff } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';

/**
 * 404 / Not Found page shown when a route doesn't match.
 * Used by TanStack Router's notFoundComponent on the root route.
 */
export function NotFoundPage() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
            <div className="flex flex-col items-center gap-3 text-center">
                <div className="rounded-full bg-muted/50 p-4 dark:bg-muted/30">
                    <IconMapPinOff className="h-12 w-12 text-muted-foreground" stroke={1.25} />
                </div>
                <span className="text-6xl font-bold tracking-tighter text-muted-foreground/30 dark:text-muted-foreground/20">
                    404
                </span>
                <h1 className="text-xl font-semibold">Page not found</h1>
                <p className="max-w-sm text-sm text-muted-foreground">
                    The page you're looking for doesn't exist or has been moved.
                </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild>
                    <Link to="/" className="inline-flex items-center gap-2" data-testid="link-back-home">
                        <IconHome className="h-4 w-4" />
                        Back home
                    </Link>
                </Button>
                <Button asChild variant="outline">
                    <Link to="/docs/$" params={{ _splat: '' }} data-testid="link-docs">
                        Docs
                    </Link>
                </Button>
            </div>
        </div>
    );
}
