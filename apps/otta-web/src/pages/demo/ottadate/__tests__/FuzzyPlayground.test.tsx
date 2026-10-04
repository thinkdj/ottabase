import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FuzzyPlayground } from '../FuzzyPlayground';

const stored = () => screen.getByText('What gets stored').nextElementSibling as HTMLElement;

describe('FuzzyPlayground', () => {
    it('opens on a real example with its stored range', () => {
        render(<FuzzyPlayground />);
        expect(stored().textContent).toContain('Summer 1998');
        expect(stored().textContent).toContain('Jun 1 to Aug 31, 1998');
        expect(stored().textContent).toContain('1998:summer');
    });

    it('loads an example memory into the picker and the readout', () => {
        const { container } = render(<FuzzyPlayground />);
        fireEvent.click(screen.getByRole('button', { name: 'late may 2010' }));
        expect(stored().textContent).toContain('Late May 2010');
        expect(container.querySelector('.ottadate-fz-title')!.textContent).toBe('May 2010');
    });

    it('keeps the value when switching to the compact picker', () => {
        const { container } = render(<FuzzyPlayground />);
        fireEvent.click(screen.getByRole('radio', { name: 'Compact' }));
        expect(container.querySelector('.ottadate--compact')).not.toBeNull();
        expect(container.querySelector<HTMLSelectElement>('.ottadate-fzc-select--part select')!.value).toBe('summer');
    });

    it('clears a decade value when decades are switched off', () => {
        render(<FuzzyPlayground />);
        fireEvent.click(screen.getByRole('button', { name: 'early 90s' }));
        expect(stored().textContent).toContain('Early 1990s');
        fireEvent.click(screen.getByRole('radio', { name: 'Off' }));
        expect(stored().textContent).toContain('Nothing picked yet');
    });
});
