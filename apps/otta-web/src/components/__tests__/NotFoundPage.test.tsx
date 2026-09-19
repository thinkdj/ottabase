import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
}));

import { NotFoundPage } from '../NotFoundPage';

describe('NotFoundPage', () => {
    it('renders 404 heading and message', () => {
        render(<NotFoundPage />);
        expect(screen.getByText('404')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /this page is gone/i })).toBeInTheDocument();
        expect(screen.getByText(/the address doesn't match anything on this site/i)).toBeInTheDocument();
    });

    it('renders a writing link pointing to /', () => {
        render(<NotFoundPage />);
        const homeLink = screen.getByTestId('link-back-home');
        expect(homeLink).toBeInTheDocument();
        expect(homeLink).toHaveAttribute('href', '/');
        expect(screen.getByText(/writing/i)).toBeInTheDocument();
    });
});
