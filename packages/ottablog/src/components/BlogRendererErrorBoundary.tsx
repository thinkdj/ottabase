/**
 * BlogRenderer Error Boundary
 *
 * Catches errors in BlogRenderer and theme renderers to prevent the entire app from crashing.
 * Displays a fallback UI when errors occur.
 */
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
        console.error('BlogRenderer error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div
                    className="blog-renderer-error"
                    style={{
                        padding: '2rem',
                        border: '1px solid #ef4444',
                        borderRadius: '0.5rem',
                        backgroundColor: '#fef2f2',
                        color: '#991b1b',
                    }}
                >
                    <h2 style={{ marginTop: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
                        Failed to Render Blog Post
                    </h2>
                    <p style={{ marginBottom: 0 }}>
                        An error occurred while rendering this blog post. Please try refreshing the page or contact
                        support if the problem persists.
                    </p>
                    {this.state.error && (
                        <details style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: '500' }}>Error Details</summary>
                            <pre
                                style={{
                                    marginTop: '0.5rem',
                                    padding: '0.75rem',
                                    backgroundColor: 'white',
                                    borderRadius: '0.25rem',
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
