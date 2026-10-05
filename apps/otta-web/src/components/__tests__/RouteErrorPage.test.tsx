import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouteErrorPage } from '../RouteErrorPage';

describe('RouteErrorPage', () => {
    it('shows the error and offers to try again', () => {
        const reset = vi.fn();
        render(<RouteErrorPage error={new Error('Chunk failed to load')} reset={reset} />);

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText('Chunk failed to load')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(reset).toHaveBeenCalled();
    });
});
