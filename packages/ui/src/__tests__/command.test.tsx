// Command: cmdk's auto-selection on mount must not scroll the page; arrow keys inside it still do.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/ui/command';

describe('<Command> scrolling', () => {
    const scrollIntoView = vi.fn();

    beforeEach(() => {
        // jsdom has no scrollIntoView; this stands in for the browser's
        HTMLElement.prototype.scrollIntoView = scrollIntoView;
        scrollIntoView.mockClear();
    });
    afterEach(() => {
        delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    });

    const palette = () => (
        <Command>
            <CommandInput placeholder="Type a command…" />
            <CommandList>
                <CommandGroup heading="Suggestions">
                    <CommandItem>Calendar</CommandItem>
                    <CommandItem>Search</CommandItem>
                </CommandGroup>
            </CommandList>
        </Command>
    );

    it('does not scroll the page to the item it selects by itself on mount', async () => {
        render(palette());
        await act(async () => {});
        expect(screen.getByRole('option', { name: 'Calendar' })).toHaveAttribute('aria-selected', 'true');
        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('still keeps the selection in view while someone moves through it with the keys', async () => {
        render(palette());
        await act(async () => {});
        const input = screen.getByPlaceholderText('Type a command…');
        input.focus();
        await act(async () => {
            fireEvent.keyDown(input, { key: 'ArrowDown' });
        });
        expect(screen.getByRole('option', { name: 'Search' })).toHaveAttribute('aria-selected', 'true');
        expect(scrollIntoView).toHaveBeenCalled();
    });
});
