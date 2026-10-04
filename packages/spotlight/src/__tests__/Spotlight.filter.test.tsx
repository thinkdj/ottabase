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
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'images' } });
        await waitFor(() => expect(screen.getByText('Media library')).toBeTruthy());
        expect(screen.queryByText('Blog posts')).toBeNull();
        expect(screen.queryByText('Careers')).toBeNull();
    });

    it('shows nothing (not fake results) when no items are provided', async () => {
        render(<Spotlight open onOpenChange={() => {}} searchDebounceMs={0} />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a' } });
        await waitFor(() => expect(screen.queryByText('About us')).toBeNull());
        expect(screen.queryByText('Home')).toBeNull();
    });
});

describe('Spotlight presentation', () => {
    const items = [
        { id: 'a', label: 'Posts', group: 'Admin', onSelect: () => {} },
        { id: 'b', label: 'Media', group: 'Admin', onSelect: () => {} },
        { id: 'c', label: 'Fuzzy dates', group: 'Demos', onSelect: () => {} },
    ];

    it('renders one heading per group run and exposes listbox options', () => {
        render(<Spotlight open onOpenChange={() => {}} defaultResults={items} />);
        expect(screen.getAllByText('Admin')).toHaveLength(1);
        expect(screen.getByText('Demos')).toBeTruthy();
        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(3);
        expect(options[0].getAttribute('aria-selected')).toBe('true');
        expect(screen.getByRole('combobox').getAttribute('aria-activedescendant')).toBe(options[0].id);
    });

    it('shows a type-to-search hint, not "No results", before anything is typed', () => {
        render(<Spotlight open onOpenChange={() => {}} />);
        expect(screen.getByText('Type to search')).toBeTruthy();
        expect(screen.queryByText('No results found')).toBeNull();
    });
});

describe('SpotlightProvider onOpenChange', () => {
    it('fires when opened by keyboard shortcut, not just on dialog close', async () => {
        const { SpotlightProvider } = await import('../SpotlightProvider');
        const calls: boolean[] = [];
        render(
            <SpotlightProvider shortcuts={['mod + K']} onOpenChange={(o) => calls.push(o)}>
                <p>app</p>
            </SpotlightProvider>,
        );
        fireEvent.keyDown(window, { key: 'k', ctrlKey: true, metaKey: true });
        await waitFor(() => expect(calls).toEqual([true]));
    });
});
