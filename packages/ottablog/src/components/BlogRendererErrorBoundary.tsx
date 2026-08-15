/**
 * BlogRenderer Error Boundary
 *
 * Catches errors in BlogRenderer and theme renderers to prevent the entire app from crashing.
 * Displays a fallback UI when errors occur.
 */
import { redactErrorForLog } from '@ottabase/utils/http-errors';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface BlogRendererErrorBoundaryProps {
    children: ReactNode;
    /** Fallback UI to show when an error occurs */
    fallback?: ReactNode;
    /** Callback when an error is caught */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface BlogRendererErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary for BlogRenderer
 *
 * Wraps BlogRenderer to catch and handle rendering errors gracefully.
 *
 * @example
 * ```tsx
 * <BlogRendererErrorBoundary
 *   fallback={<div>Failed to render blog post</div>}
 *   onError={(error) => console.error('Render error:', error)}
 * >
 *   <BlogRenderer post={post} />
 * </BlogRendererErrorBoundary>
 * ```
 */
export class BlogRendererErrorBoundary extends Component<
    BlogRendererErrorBoundaryProps,
    BlogRendererErrorBoundaryState
> {
    constructor(props: BlogRendererErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): BlogRendererErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('BlogRenderer error:', redactErrorForLog(error), errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI — quiet tinted notice driven by theme tokens
            return (
                <div
                    className="blog-renderer-error"
                    style={{
                        padding: '1.5rem',
                        border: '1px solid hsl(var(--destructive) / 0.2)',
                        borderRadius: 'calc(var(--radius) + 4px)',
                        backgroundColor: 'hsl(var(--destructive) / 0.08)',
                        color: 'hsl(var(--foreground))',
                    }}
                >
                    <h2 style={{ marginTop: 0, marginBottom: '0.375rem', fontSize: '0.9375rem', fontWeight: 600 }}>
                        Failed to Render Blog Post
                    </h2>
                    <p
                        style={{
                            marginBottom: 0,
                            fontSize: '0.875rem',
                            lineHeight: 1.625,
                            color: 'hsl(var(--muted-foreground))',
                        }}
                    >
                        An error occurred while rendering this blog post. Please try refreshing the page or contact
                        support if the problem persists.
                    </p>
                    {this.state.error && (
                        <details style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                            <summary
                                style={{
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    color: 'hsl(var(--muted-foreground))',
                                }}
                            >
                                Error Details
                            </summary>
                            <pre
                                style={{
                                    marginTop: '0.5rem',
                                    padding: '0.75rem',
                                    backgroundColor: 'hsl(var(--background))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: 'calc(var(--radius) - 2px)',
                                    color: 'hsl(var(--muted-foreground))',
                                    overflow: 'auto',
                                }}
                            >
                                {this.state.error.message}
                                {'\n\n'}
                                {this.state.error.stack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default BlogRendererErrorBoundary;
