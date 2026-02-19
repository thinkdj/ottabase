import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BlogRendererErrorBoundary } from '../components/BlogRendererErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
        throw new Error('Test error from child component');
    }
    return <div>No error</div>;
};

describe('BlogRendererErrorBoundary', () => {
    // Suppress console.error during tests to avoid cluttering test output
    const originalError = console.error;
    beforeEach(() => {
        console.error = vi.fn();
    });
    afterEach(() => {
        console.error = originalError;
    });

    describe('Error catching', () => {
        it('should render children when no error occurs', () => {
            render(
                <BlogRendererErrorBoundary>
                    <div>Child content</div>
                </BlogRendererErrorBoundary>,
            );

            expect(screen.getByText('Child content')).toBeInTheDocument();
        });

        it('should catch errors and display fallback UI', () => {
            render(
                <BlogRendererErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </BlogRendererErrorBoundary>,
            );

            expect(screen.getByText(/Failed to Render Blog Post/i)).toBeInTheDocument();
        });

        it('should display error message in fallback UI', () => {
            render(
                <BlogRendererErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </BlogRendererErrorBoundary>,
            );

            expect(screen.getByText(/Test error from child component/i)).toBeInTheDocument();
        });

        it('should display error details in details element', () => {
            render(
                <BlogRendererErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </BlogRendererErrorBoundary>,
            );

            // Error details should be in a details/summary element
            expect(screen.getByText(/Error Details/i)).toBeInTheDocument();
            expect(screen.getByText(/Test error from child component/i)).toBeInTheDocument();
        });
    });

    describe('Custom fallback', () => {
        it('should render custom fallback when provided', () => {
            const customFallback = <div>Custom error message</div>;

            render(
                <BlogRendererErrorBoundary fallback={customFallback}>
                    <ThrowError shouldThrow={true} />
                </BlogRendererErrorBoundary>,
            );

            expect(screen.getByText('Custom error message')).toBeInTheDocument();
            expect(screen.queryByText(/Failed to Render Blog Post/i)).not.toBeInTheDocument();
        });

        it('should render custom fallback element', () => {
            const customFallback = <div>Custom fallback with static message</div>;

            render(
                <BlogRendererErrorBoundary fallback={customFallback}>
                    <ThrowError shouldThrow={true} />
                </BlogRendererErrorBoundary>,
            );

            expect(screen.getByText('Custom fallback with static message')).toBeInTheDocument();
        });
    });

    describe('onError callback', () => {
        it('should call onError callback when error occurs', () => {
            const onErrorSpy = vi.fn();

            render(
                <BlogRendererErrorBoundary onError={onErrorSpy}>
                    <ThrowError shouldThrow={true} />
                </BlogRendererErrorBoundary>,
            );

            expect(onErrorSpy).toHaveBeenCalledTimes(1);
            expect(onErrorSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Test error from child component',
                }),
                expect.any(Object), // errorInfo
            );
        });

        it('should not call onError when no error occurs', () => {
            const onErrorSpy = vi.fn();

            render(
                <BlogRendererErrorBoundary onError={onErrorSpy}>
                    <div>No error</div>
                </BlogRendererErrorBoundary>,
            );

            expect(onErrorSpy).not.toHaveBeenCalled();
        });
    });

    describe('Error boundary lifecycle', () => {
        it('should update state when error is caught', () => {
            const { rerender } = render(
                <BlogRendererErrorBoundary>
                    <ThrowError shouldThrow={false} />
                </BlogRendererErrorBoundary>,
            );

            expect(screen.getByText('No error')).toBeInTheDocument();

            // Update to throw error
            rerender(
                <BlogRendererErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </BlogRendererErrorBoundary>,
            );

            expect(screen.getByText(/Failed to Render Blog Post/i)).toBeInTheDocument();
        });

        it('should log error to console', () => {
            const consoleSpy = vi.spyOn(console, 'error');

            render(
                <BlogRendererErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </BlogRendererErrorBoundary>,
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                'BlogRenderer error:',
                expect.objectContaining({
                    message: 'Test error from child component',
                }),
                expect.any(Object),
            );

            consoleSpy.mockRestore();
        });
    });

    describe('Graceful degradation', () => {
        it('should prevent cascade failures to parent components', () => {
            const ParentComponent = () => {
                return (
                    <div>
                        <h1>Parent Component</h1>
                        <BlogRendererErrorBoundary>
                            <ThrowError shouldThrow={true} />
                        </BlogRendererErrorBoundary>
                        <p>This should still render</p>
                    </div>
                );
            };

            render(<ParentComponent />);

            // Parent component should still render
            expect(screen.getByText('Parent Component')).toBeInTheDocument();
            expect(screen.getByText('This should still render')).toBeInTheDocument();

            // Error boundary should show fallback
            expect(screen.getByText(/Failed to Render Blog Post/i)).toBeInTheDocument();
        });
    });
});
