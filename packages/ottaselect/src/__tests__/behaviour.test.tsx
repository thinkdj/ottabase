import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OttaSelect } from '../components/OttaSelect';

const items = [
    { id: '1', name: 'Alpha' },
    { id: '2', name: 'Beta' },
    { id: '3', name: 'Gamma' },
];

describe('OttaSelect search-as-you-type', () => {
    it('opens on a typed letter, filters, and Enter picks the first match', () => {
        const onChange = vi.fn();
        render(<OttaSelect items={items} value={null} onChange={onChange} />);

        const trigger = screen.getByRole('combobox');
        fireEvent.keyDown(trigger, { key: 'b' });

        const search = screen.getByRole('searchbox');
        expect(search).toHaveValue('b');
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Beta']);
        expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'false');
        expect(search).toHaveAttribute('aria-activedescendant', screen.getByRole('option').id);

        fireEvent.keyDown(search, { key: 'Enter' });
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: '2', name: 'Beta' }));
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('offers to create what nothing matches and selects the result', async () => {
        const onChange = vi.fn();
        const onCreate = vi.fn(async (name: string) => ({ id: '9', name }));
        render(<OttaSelect items={items} value={null} onChange={onChange} onCreate={onCreate} />);

        fireEvent.keyDown(screen.getByRole('combobox'), { key: 'd' });
        const search = screen.getByRole('searchbox');
        fireEvent.change(search, { target: { value: 'Delta' } });

        const create = screen.getByRole('option', { name: 'Create "Delta"' });
        fireEvent.keyDown(search, { key: 'Enter' });

        await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Delta'));
        await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: '9', name: 'Delta' })));
        expect(create).not.toBeInTheDocument();
    });

    it('does not offer to create an existing name', () => {
        render(<OttaSelect items={items} value={null} onChange={() => {}} onCreate={async () => undefined} />);
        fireEvent.keyDown(screen.getByRole('combobox'), { key: 'a' });
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'alpha' } });
        expect(screen.queryByRole('option', { name: /Create/ })).toBeNull();
    });
});
