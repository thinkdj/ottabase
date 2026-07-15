/**
 * @ottabase/ottadate — Popover-content regression tests for the fuzzy pickers
 *
 * Locks in the bulk-reduction pass: FuzzyDateTimePicker's year selector collapsed
 * from an 11-button grid to a stepper, its resolution description line was dropped,
 * and FuzzyDateTimeCompact's redundant "Resolution / Stored Meta" row was removed.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createFuzzyDateTimeCompact } from '../pickers/FuzzyDateTimeCompact';
import { createFuzzyDateTimePicker } from '../pickers/FuzzyDateTimePicker';

function mount(): HTMLElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    return container;
}

afterEach(() => {
    document.body.replaceChildren();
});

describe('createFuzzyDateTimePicker popover contents', () => {
    it('renders the year as a single stepper value, not a grid of year buttons', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true });

        expect(container.querySelectorAll('.ottadate-year-cell')).toHaveLength(0);
        const yearValue = container.querySelector('.ottadate-fuzzy-year-stepper .ottadate-fuzzy-year-value');
        expect(yearValue).not.toBeNull();
        expect(yearValue!.textContent).toBe(String(new Date().getFullYear()));
    });

    it('increments and decrements the year via the stepper buttons', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true });

        const currentYear = new Date().getFullYear();
        const [prevBtn, nextBtn] = container.querySelectorAll('.ottadate-fuzzy-year-stepper button');
        const yearValue = () => container.querySelector('.ottadate-fuzzy-year-value')!.textContent;

        (nextBtn as HTMLButtonElement).click();
        expect(yearValue()).toBe(String(currentYear + 1));

        (prevBtn as HTMLButtonElement).click();
        (prevBtn as HTMLButtonElement).click();
        expect(yearValue()).toBe(String(currentYear - 1));
    });

    it('does not render a resolution description line under the resolution chips', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true });

        const sections = container.querySelectorAll('.ottadate-fuzzy-section');
        const resolutionSection = Array.from(sections).find((section) =>
            section.querySelector('.ottadate-fuzzy-label')?.textContent?.includes('I remember up to'),
        );

        expect(resolutionSection).toBeDefined();
        // Label + chip row only — the old description paragraph made this 3.
        expect(resolutionSection!.children).toHaveLength(2);
    });
});

describe('createFuzzyDateTimeCompact popover contents', () => {
    it('does not render the redundant Resolution / Stored Meta info row', () => {
        const container = mount();
        createFuzzyDateTimeCompact(container, { inline: true });

        expect(container.querySelector('.ottadate-compact-info')).toBeNull();
        expect(container.textContent).not.toContain('Stored Meta');
    });
});
