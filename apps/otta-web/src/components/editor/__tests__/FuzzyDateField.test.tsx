import { createFuzzyDateTime, type FuzzyDateTime } from '@ottabase/ottadate';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FuzzyDateField } from '../FuzzyDateField';

const summer98 = createFuzzyDateTime(new Date(Date.UTC(1998, 0)), 'year', { part: 'summer' });

describe('FuzzyDateField', () => {
    it('shows the value, emits picker changes, and accepts new values from props', () => {
        const onChange = vi.fn<(value: FuzzyDateTime | null) => void>();
        const { container, rerender } = render(
            <FuzzyDateField id="originalDate" value={summer98} onChange={onChange} />,
        );
        const trigger = container.querySelector<HTMLButtonElement>('#originalDate')!;
        expect(trigger.textContent).toBe('Summer 1998');

        container.querySelector<HTMLButtonElement>('.ottadate-trigger-clear')!.click();
        expect(onChange).toHaveBeenLastCalledWith(null);

        const may2010 = createFuzzyDateTime(new Date(Date.UTC(2010, 4)), 'month');
        rerender(<FuzzyDateField id="originalDate" value={may2010} onChange={onChange} />);
        expect(trigger.textContent).toBe('Sometime in May 2010');
    });

    it('allows decades', () => {
        const { container } = render(<FuzzyDateField value={null} onChange={() => {}} />);
        container.querySelector<HTMLButtonElement>('.ottadate-trigger-main')!.click();
        // Decade mode opens on the decades grid
        expect(container.querySelector('.ottadate-fz-grid--decades')).not.toBeNull();
    });

    it('cleans up on unmount', () => {
        const { container, unmount } = render(<FuzzyDateField value={null} onChange={() => {}} />);
        expect(container.querySelector('.ottadate')).not.toBeNull();
        unmount();
        expect(document.querySelector('.ottadate')).toBeNull();
    });
});
