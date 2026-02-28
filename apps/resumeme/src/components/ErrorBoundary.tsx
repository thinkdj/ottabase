import { Component, type ReactNode } from 'react';
import { isApiError, type ApiError } from '@ottabase/api';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ottabase/ui-shadcn';

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Custom fallback component */
    fallback?: ReactNode;
    /** Called when an error is caught */
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    /** Whether to show detailed error info (default: true in dev) */
    showDetails?: boolean;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

/**
 * Error boundary component that catches JavaScript errors anywhere in the child
 * component tree, logs those errors, and displays a fallback UI.
 *
 * @example
 * ```tsx
 * <ErrorBoundary onError={(error) => logToService(error)}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({ errorInfo });
        this.props.onError?.(error, errorInfo);

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const { error } = this.state;
            const showDetails = this.props.showDetails ?? process.env.NODE_ENV === 'development';
            const apiError = error && isApiError(error) ? error : null;

            return (
                <div className="flex min-h-[400px] items-center justify-center p-4">
                    <Card className="w-full max-w-lg">
                        <CardHeader>
                            <CardTitle className="text-destructive">Something went wrong</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {apiError ? apiError.message : error?.message || 'An unexpected error occurred'}
                            </p>

                            {apiError && (
                                <div className="space-y-2 text-sm">
                                    {apiError.details && <p className="text-muted-foreground">{apiError.details}</p>}
                                    {apiError.hint && (
                                        <p className="rounded bg-muted px-2 py-1 font-mono text-xs">{apiError.hint}</p>
                                    )}
                                    {apiError.messages.length > 1 && (
                                        <ul className="list-inside list-disc text-muted-foreground">
                                            {apiError.messages.map((msg, i) => (
                                                <li key={i}>{msg}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {showDetails && error && !apiError && (
                                <details className="rounded border bg-muted/50 p-2">
                                    <summary className="cursor-pointer text-xs text-muted-foreground">
                                        Technical details
                                    </summary>
                                    <pre className="mt-2 overflow-auto text-xs">{error.stack || error.message}</pre>
                                </details>
                            )}

                            <div className="flex gap-2">
                                <Button onClick={this.handleReset} variant="outline">
                                    Try again
                                </Button>
                                <Button onClick={this.handleReload} variant="default">
                                    Reload page
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * API-specific error display component.
 * Use this to display API errors in a consistent format.
 *
 * @example
 * ```tsx
 * {error && <ApiErrorDisplay error={error} onRetry={() => refetch()} />}
 * ```
 */
export function ApiErrorDisplay({
    error,
    onRetry,
    onDismiss,
    className = '',
}: {
    error: ApiError | Error | unknown;
    onRetry?: () => void;
    onDismiss?: () => void;
    className?: string;
}) {
    const apiError = isApiError(error) ? error : null;
    const message = apiError?.message || (error instanceof Error ? error.message : 'An error occurred');
    const authMessage = apiError?.isUnauthorized()
        ? 'You must be signed in to access this resource.'
        : apiError?.isForbidden()
          ? 'You do not have permission to view this data. Check your organization access or role.'
          : null;

    // Choose color based on error type
    const isWarning = apiError?.status === 501 || apiError?.code === 'NOT_IMPLEMENTED';
    const colorClasses = isWarning ? 'border-amber-500/30 bg-amber-500/10' : 'border-destructive/30 bg-destructive/10';
    const textClasses = isWarning ? 'text-amber-700 dark:text-amber-400' : 'text-destructive';

    return (
        <div className={`rounded-lg border p-4 ${colorClasses} ${className}`}>
            <div className="space-y-2">
                <p className={`font-medium ${textClasses}`}>{message}</p>

                {apiError?.details && <p className={`text-sm opacity-80 ${textClasses}`}>{apiError.details}</p>}
                {authMessage && <p className={`text-sm ${textClasses}`}>{authMessage}</p>}

                {apiError?.hint && (
                    <p
                        className={`inline-block rounded px-2 py-1 text-sm font-mono ${isWarning ? 'bg-amber-500/10' : 'bg-destructive/10'} ${textClasses}`}
                    >
                        {apiError.hint}
                    </p>
                )}

                {apiError?.messages && apiError.messages.length > 1 && (
                    <ul className={`list-inside list-disc text-sm ${textClasses}`}>
                        {apiError.messages.slice(1).map((msg, i) => (
                            <li key={i}>{msg}</li>
                        ))}
                    </ul>
                )}

                {apiError?.fieldErrors && Object.keys(apiError.fieldErrors).length > 0 && (
                    <div className="text-sm">
                        {Object.entries(apiError.fieldErrors).map(([field, errors]) => (
                            <div key={field}>
                                <span className="font-medium">{field}:</span> {errors.join(', ')}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {(onRetry || onDismiss) && (
                <div className="mt-3 flex gap-2">
                    {onRetry && (
                        <Button size="sm" variant="outline" onClick={onRetry}>
                            Retry
                        </Button>
                    )}
                    {onDismiss && (
                        <Button size="sm" variant="ghost" onClick={onDismiss}>
                            Dismiss
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
