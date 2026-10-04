import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spotlight } from '../Spotlight';

describe('Spotlight without onSearch', () => {
    const items = [
        { id: 'posts', label: 'Blog posts', onSelect: () => {} },
        { id: 'media', label: 'Media library', keywords: ['images'], onSelect: () => {} },
    ];

    it('filters the provided defaultResults and never shows placeholder pages', async () => {
        render(<Spotlight open onOpenChange={() => {}} defaultResults={items} searchDebounceMs={0} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'images' } });
        await waitFor(() => expect(screen.getByText('Media library')).toBeTruthy());
        expect(screen.queryByText('Blog posts')).toBeNull();
        expect(screen.queryByText('Careers')).toBeNull();
    });

    it('shows nothing (not fake results) when no items are provided', async () => {
        render(<Spotlight open onOpenChange={() => {}} searchDebounceMs={0} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a' } });
        await waitFor(() => expect(screen.queryByText('About us')).toBeNull());
        expect(screen.queryByText('Home')).toBeNull();
    });
});
