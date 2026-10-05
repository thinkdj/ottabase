import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingState } from '../components/LoadingState';

describe('LoadingState', () => {
    it('is one busy status region with the requested number of blocks', () => {
        render(<LoadingState count={4} height="h-12" />);
        const status = screen.getByRole('status', { name: 'Loading' });
        expect(status).toHaveAttribute('aria-busy', 'true');
        expect(status.querySelectorAll('[data-slot=skeleton]')).toHaveLength(4);
        expect(status.firstElementChild).toHaveClass('h-12');
    });

    it('draws a header row plus rows for tables', () => {
        render(<LoadingState kind="table" count={2} columns={3} label="Loading users" />);
        const status = screen.getByRole('status', { name: 'Loading users' });
        // 3 header cells + 2 rows
        expect(status.querySelectorAll('[data-slot=skeleton]')).toHaveLength(5);
    });
});
