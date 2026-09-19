import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ottabase/ui-shadcn', () => ({
    BrandScope: ({ children, name }: { children: unknown; name: string }) => (
        <div data-brand-scope={name}>{children as never}</div>
    ),
}));

vi.mock('@/pages/blog/BlogListPage', () => ({
    BlogListPage: ({ variant }: { variant?: string }) => <div>Personal writing index ({variant})</div>,
}));

import { HomePage } from '../HomePage';

describe('HomePage', () => {
    it('renders the personal writing index inside the blog room', () => {
        const { container } = render(<HomePage />);
        expect(container.querySelector('[data-brand-scope="blog"]')).toBeTruthy();
        expect(screen.getByText('Personal writing index (home)')).toBeTruthy();
    });
});
