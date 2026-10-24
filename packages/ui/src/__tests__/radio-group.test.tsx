// RadioGroup: a true circle that a flex row cannot squeeze, with a centred CSS dot only on the chosen item.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';

describe('<RadioGroup>', () => {
    it('keeps each item a fixed circle and draws the dot only on the checked one', () => {
        const { container } = render(
            <RadioGroup defaultValue="a" aria-label="Plan">
                <RadioGroupItem value="a" aria-label="Solo" />
                <RadioGroupItem value="b" aria-label="Team" />
            </RadioGroup>,
        );
        const solo = screen.getByRole('radio', { name: 'Solo' });
        expect(solo.className).toContain('size-4');
        expect(solo.className).toContain('shrink-0');
        expect(solo.className).toContain('rounded-full');
        expect(solo).toHaveAttribute('data-state', 'checked');
        expect(container.querySelectorAll('[data-slot="radio-group-indicator"]')).toHaveLength(1);
        expect(container.querySelector('svg')).toBeNull();

        fireEvent.click(screen.getByRole('radio', { name: 'Team' }));
        expect(screen.getByRole('radio', { name: 'Team' })).toHaveAttribute('data-state', 'checked');
        expect(solo.querySelector('[data-slot="radio-group-indicator"]')).toBeNull();
    });
});
