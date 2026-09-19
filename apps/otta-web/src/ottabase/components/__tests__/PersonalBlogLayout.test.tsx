import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PersonalBlogLayout } from '../PersonalBlogLayout';

vi.mock('@/lib/auth', () => ({
    useSession: () => ({ user: null }),
}));

vi.mock('@/ottabase/config', () => ({
    APP_META: { appName: 'Slices.' },
}));

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
    useLocation: () => ({ pathname: '/blog' }),
}));

vi.mock('../ThemeSwitcher', () => ({
    ThemeSwitcher: () => <button type="button">Theme</button>,
}));

vi.mock('../layout/UserSection', () => ({
    UserSection: () => null,
}));

describe('PersonalBlogLayout', () => {
    it('provides the publication shell around public blog content', () => {
        render(
            <PersonalBlogLayout>
                <div>Reading surface</div>
            </PersonalBlogLayout>,
        );

        expect(screen.getByRole('main')).toHaveTextContent('Reading surface');
        expect(screen.getByRole('link', { name: 'Slices.' })).toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: /Writing/ })).toHaveAttribute('href', '/blog');
        expect(
            screen.getAllByRole('link', { name: /About/ }).some((link) => link.getAttribute('href') === '/about'),
        ).toBe(true);
        expect(screen.getByRole('link', { name: /RSS/ })).toHaveAttribute(
            'href',
            expect.stringContaining('/api/blog/rss'),
        );
        expect(screen.getByText('Made for reading')).toBeInTheDocument();
    });
});
