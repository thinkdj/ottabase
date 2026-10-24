// OttaTagsInput: pick or create tags, keyboard removal, paste, limits, async creation and ARIA.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OttaTagsInput, type OttaTagsInputProps } from '../index';
import type { OttaSelectItem } from '../components/items';

const ITEMS = [
    { id: 'ts', name: 'TypeScript' },
    { id: 'tw', name: 'Tailwind' },
    { id: 'ed', name: 'Edge' },
];

/** Holds the tags like an app would, and exposes the latest value. */
function Harness(props: Partial<OttaTagsInputProps> & { initial?: OttaSelectItem[] }) {
    const { initial = [], ...rest } = props;
    const [tags, setTags] = React.useState<OttaSelectItem[]>(initial);
    return (
        <>
            <OttaTagsInput aria-label="Tags" items={ITEMS} {...rest} value={tags} onChange={setTags} />
            <span data-testid="value">{tags.map((tag) => tag.id).join(',')}</span>
        </>
    );
}

const input = () => screen.getByRole('combobox', { name: 'Tags' });
const value = () => screen.getByTestId('value').textContent;
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
const press = (key: string) => fireEvent.keyDown(input(), { key });

describe('<OttaTagsInput>', () => {
    it('is a combobox over a listbox of the suggestions that are not tags yet', () => {
        render(<Harness initial={[{ id: 'ts', name: 'TypeScript' }]} />);
        expect(input()).toHaveAttribute('aria-expanded', 'false');
        fireEvent.focus(input());
        expect(input()).toHaveAttribute('aria-expanded', 'true');
        const listbox = screen.getByRole('listbox');
        expect(input()).toHaveAttribute('aria-controls', listbox.id);
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Tailwind', 'Edge']);
    });

    it('filters as you type, exact and prefix matches first, and Enter takes the armed row', () => {
        render(<Harness items={[...ITEMS, { id: 'ge', name: 'Ledge' }]} />);
        fireEvent.focus(input());
        type('edg');
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Edge', 'Ledge', 'Create “edg”']);
        // The best match is armed, not Create: a prefix picks the existing tag
        expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');

        type('edge');
        const [first] = screen.getAllByRole('option');
        expect(first).toHaveTextContent('Edge');
        expect(first).toHaveAttribute('aria-selected', 'true');
        expect(input()).toHaveAttribute('aria-activedescendant', first.id);
        press('Enter');
        expect(value()).toBe('ed');
        expect(input()).toHaveValue('');
    });

    it('creates a tag from typed text with Enter or a comma, once', async () => {
        render(<Harness />);
        fireEvent.focus(input());
        type('Workers');
        press('Enter');
        await settle();
        type('Ed'); // a comma commits the text as typed, even with "Edge" suggested
        press(',');
        await settle();
        type('workers'); // already a tag, in any case
        press('Enter');
        await settle();
        expect(value()).toBe('Workers,Ed');
        expect(input()).toHaveValue('');
        expect(screen.getByRole('status')).toHaveTextContent('workers is already added');
    });

    it('picks a suggestion with the arrows and a click', async () => {
        render(<Harness />);
        fireEvent.focus(input());
        press('ArrowDown');
        press('ArrowDown');
        press('Enter');
        expect(value()).toBe('tw');
        fireEvent.click(screen.getByRole('option', { name: 'Edge' }));
        expect(value()).toBe('tw,ed');
        expect(screen.getByRole('status')).toHaveTextContent('Added Edge');
    });

    it('highlights the last tag on Backspace and removes it on the second press', () => {
        render(
            <Harness
                initial={[
                    { id: 'a', name: 'Alpha' },
                    { id: 'b', name: 'Beta' },
                ]}
            />,
        );
        fireEvent.focus(input());
        press('Backspace');
        expect(value()).toBe('a,b');
        expect(screen.getByText('Beta').closest('li')).toHaveAttribute('data-active');
        press('Backspace');
        expect(value()).toBe('a');
        expect(screen.getByRole('status')).toHaveTextContent('Removed Beta');
    });

    it('walks tags with Left and Right and removes the highlighted one with Delete', () => {
        render(
            <Harness
                initial={[
                    { id: 'a', name: 'Alpha' },
                    { id: 'b', name: 'Beta' },
                ]}
            />,
        );
        press('ArrowLeft');
        press('ArrowLeft');
        expect(screen.getByText('Alpha').closest('li')).toHaveAttribute('data-active');
        press('ArrowRight');
        expect(screen.getByText('Beta').closest('li')).toHaveAttribute('data-active');
        press('ArrowLeft');
        press('Delete');
        expect(value()).toBe('b');
    });

    it('removes a tag from its button', () => {
        render(<Harness initial={[{ id: 'a', name: 'Alpha' }]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Remove Alpha' }));
        expect(value()).toBe('');
    });

    it('splits a paste on commas and line breaks and reuses suggestions by name', async () => {
        render(<Harness />);
        type('ty');
        fireEvent.paste(input(), { clipboardData: { getData: () => 'peScript, Rust\nGo' } });
        await waitFor(() => expect(value()).toBe('ts,Rust,Go'));
    });

    it('stops at maxTags and shows the count', async () => {
        render(<Harness maxTags={2} initial={[{ id: 'a', name: 'Alpha' }]} />);
        expect(screen.getByText('1/2')).toBeInTheDocument();
        type('Beta');
        press('Enter');
        await settle();
        expect(value()).toBe('a,Beta');
        expect(screen.getByText('2/2')).toBeInTheDocument();
        expect(input()).toHaveAttribute('readonly');
        type('Gamma'); // ignored at the limit
        expect(input()).toHaveValue('');
    });

    it('only offers suggestions when creatable is off', async () => {
        render(<Harness creatable={false} />);
        fireEvent.focus(input());
        type('Nope');
        expect(screen.queryByRole('option')).toBeNull();
        expect(screen.getByText('No matches')).toBeInTheDocument();
        press('Enter');
        await settle();
        expect(screen.getByRole('status')).toHaveTextContent('Nope was not added');
        expect(value()).toBe('');
        expect(input()).toHaveValue('Nope');
    });

    it('awaits onCreate, uses what it returns and keeps refused text', async () => {
        let resolve!: (item: { id: string; name: string } | null) => void;
        const onCreate = vi.fn(() => new Promise<{ id: string; name: string } | null>((r) => (resolve = r)));
        render(<Harness onCreate={onCreate} />);

        type('Queues');
        press('Enter');
        expect(onCreate).toHaveBeenCalledWith('Queues');
        expect(input()).toHaveAttribute('aria-busy', 'true');
        await act(async () => resolve({ id: 'q-1', name: 'Queues' }));
        expect(value()).toBe('q-1');

        type('bad tag');
        press('Enter');
        await act(async () => resolve(null));
        expect(value()).toBe('q-1');
        expect(input()).toHaveValue('bad tag');
    });

    it('loads suggestions from fetchCollection, debounced', async () => {
        vi.useFakeTimers();
        const fetchCollection = vi.fn(async (q: string) => ITEMS.filter((i) => i.name.toLowerCase().includes(q)));
        render(<Harness items={undefined} fetchCollection={fetchCollection} searchDebounceMs={200} />);
        fireEvent.focus(input());
        type('t');
        type('ty');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(250);
        });
        expect(fetchCollection).toHaveBeenCalledTimes(1);
        expect(fetchCollection).toHaveBeenLastCalledWith('ty');
        expect(screen.getByRole('option', { name: /TypeScript/ })).toBeInTheDocument();
        vi.useRealTimers();
    });

    it('works uncontrolled and submits each tag id under its name', async () => {
        const { container } = render(
            <OttaTagsInput aria-label="Tags" name="tags" defaultValue={[{ id: 'a', name: 'Alpha' }]} />,
        );
        type('Beta');
        press('Enter');
        await settle();
        const hidden = [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')];
        expect(hidden.map((el) => el.value)).toEqual(['a', 'Beta']);
    });

    it('goes quiet when disabled', () => {
        render(<OttaTagsInput aria-label="Tags" disabled defaultValue={[{ id: 'a', name: 'Alpha' }]} />);
        expect(input()).toBeDisabled();
        expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
        press('Backspace');
        press('Backspace');
        expect(screen.getByText('Alpha')).toBeInTheDocument();
    });
});

/** Lets a commit finish: it awaits each label's resolution, even a synchronous one. */
const settle = () => act(async () => {});
