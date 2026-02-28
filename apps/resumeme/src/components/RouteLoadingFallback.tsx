import { Spinner } from '@ottabase/ui-shadcn';

/**
 * Shown while a lazy route chunk loads (e.g. /docs, /demo).
 * Used as router's defaultPendingComponent to avoid showing the previous page during navigation.
 */
export function RouteLoadingFallback() {
    return (
        <div className="flex min-h-[50vh] items-center justify-center" data-testid="route-loading-fallback">
            <Spinner className="h-8 w-8 text-muted-foreground" aria-label="Loading" />
        </div>
    );
}
