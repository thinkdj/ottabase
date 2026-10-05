import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '../components/EmptyState';

describe('EmptyState', () => {
    it('renders title, description, icon and action', () => {
        render(
            <EmptyState
                icon={<svg data-testid="icon" />}
                title="No posts yet"
                description="Write the first one."
                action={<button type="button">New post</button>}
            />,
        );
        expect(screen.getByText('No posts yet')).toBeInTheDocument();
        expect(screen.getByText('Write the first one.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'New post' })).toBeInTheDocument();
        // Decorative: hidden from assistive tech
        expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
    });

    it('tightens padding when compact', () => {
        const { container } = render(<EmptyState title="Empty" compact />);
        expect(container.firstChild).toHaveClass('py-8');
    });
});
