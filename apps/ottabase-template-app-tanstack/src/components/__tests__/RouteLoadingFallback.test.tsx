import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ottabase/ui-shadcn', () => ({
    Spinner: ({ 'aria-label': ariaLabel, ...props }: any) => (
        <div data-testid="spinner" role="status" aria-label={ariaLabel} {...props} />
    ),
}));

import { RouteLoadingFallback } from '../RouteLoadingFallback';

describe('RouteLoadingFallback', () => {
    it('renders container with route-loading-fallback testid', () => {
        render(<RouteLoadingFallback />);
        expect(screen.getByTestId('route-loading-fallback')).toBeInTheDocument();
    });

    it('renders spinner', () => {
        render(<RouteLoadingFallback />);
        expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('spinner has loading accessibility label', () => {
        render(<RouteLoadingFallback />);
        expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
    });
});
