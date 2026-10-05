import type { ErrorComponentProps } from '@tanstack/react-router';
import { ErrorPanel } from './ErrorBoundary';

/**
 * Shown when a route's render or loader throws. Route errors render inside the
 * root layout's outlet, so the header and navigation stay usable (the top-level
 * ErrorBoundary in main.tsx only catches what escapes the router).
 */
export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
    return (
        <div className="flex min-h-[50vh] items-center justify-center p-4">
            <ErrorPanel error={error} onRetry={reset} />
        </div>
    );
}
