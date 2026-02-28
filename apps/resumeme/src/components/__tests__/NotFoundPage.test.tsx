import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('@ottabase/ui-shadcn', () => ({
    Button: ({ children, asChild, variant, ...props }: any) => (
        <button data-variant={variant} {...props}>
            {children}
        </button>
    ),
}));

vi.mock('@tabler/icons-react', () => ({
    IconHome: () => <span data-testid="icon-home" />,
    IconMapPinOff: () => <span data-testid="icon-map-pin-off" />,
}));

import { NotFoundPage } from '../NotFoundPage';

describe('NotFoundPage', () => {
    it('renders 404 heading and message', () => {
        render(<NotFoundPage />);
        expect(screen.getByText('404')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
        expect(screen.getByText(/the page you're looking for doesn't exist or has been moved/i)).toBeInTheDocument();
    });

    it('renders icon', () => {
        render(<NotFoundPage />);
        expect(screen.getByTestId('icon-map-pin-off')).toBeInTheDocument();
    });

    it('renders Back home link pointing to /', () => {
        render(<NotFoundPage />);
        const homeLink = screen.getByTestId('link-back-home');
        expect(homeLink).toBeInTheDocument();
        expect(homeLink).toHaveAttribute('href', '/');
        expect(screen.getByText('Back home')).toBeInTheDocument();
    });

    it('renders Docs link pointing to docs', () => {
        render(<NotFoundPage />);
        const docsLink = screen.getByTestId('link-docs');
        expect(docsLink).toBeInTheDocument();
        expect(docsLink.getAttribute('href')).toMatch(/\/docs/);
        expect(screen.getByText('Docs')).toBeInTheDocument();
    });
});
