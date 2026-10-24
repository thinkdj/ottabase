// OttaSelect onCreate: a "Create" row for search text that names no option, in both modes.
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OttaSelect, type OttaSelectItem, type OttaSelectProps } from '../index';

const ITEMS = [
    { id: '1', name: 'Alpha' },
    { id: '2', name: 'Beta' },
];

function Harness({ mode, onCreate }: { mode: 'single' | 'multiple'; onCreate: OttaSelectProps['onCreate'] }) {
    const [value, setValue] = React.useState<OttaSelectItem | OttaSelectItem[] | null>(null);
    const ids = value === null ? '' : Array.isArray(value) ? value.map((v) => v.id).join(',') : value.id;
    return (
        <>
            <OttaSelect mode={mode} items={ITEMS} value={value} onChange={setValue} onCreate={onCreate} />
            <output data-testid="value">{ids}</output>
        </>
    );
}

const open = () => fireEvent.click(screen.getByRole('button', { name: /Select an option/ }));
const search = (text: string) =>
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: text } });

describe('<OttaSelect onCreate>', () => {
    it('offers Create only for text that names no option, case-insensitively', () => {
        render(<Harness mode="single" onCreate={vi.fn()} />);
        open();
        search('alpha');
        expect(screen.queryByText(/Create/)).toBeNull();
        search('Gamma');
        expect(screen.getByText('“Gamma”')).toBeInTheDocument();
        expect(screen.queryByText('No options found')).toBeNull();
    });

    it('selects what onCreate returns in multiple mode, from a click', async () => {
        const onCreate = vi.fn(async (label: string) => ({ id: 'new-1', name: label }));
        render(<Harness mode="multiple" onCreate={onCreate} />);
        open();
        search('Gamma');
        await act(async () => {
            fireEvent.click(screen.getByText('“Gamma”').closest('button')!);
        });
        expect(onCreate).toHaveBeenCalledWith('Gamma');
        expect(screen.getByTestId('value')).toHaveTextContent('new-1');
    });

    it('creates with Enter when the search matches nothing, and refuses on null', async () => {
        const onCreate = vi.fn((label: string) => (label === 'nope' ? null : { id: label, name: label }));
        render(<Harness mode="single" onCreate={onCreate} />);
        open();
        search('nope');
        await act(async () => {
            fireEvent.keyDown(screen.getByPlaceholderText('Search...'), { key: 'Enter' });
        });
        expect(screen.getByTestId('value')).toHaveTextContent('');

        search('Delta');
        await act(async () => {
            fireEvent.keyDown(screen.getByPlaceholderText('Search...'), { key: 'Enter' });
        });
        expect(screen.getByTestId('value')).toHaveTextContent('Delta');
    });
});
