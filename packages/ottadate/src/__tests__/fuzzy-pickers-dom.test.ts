/**
 * @ottabase/ottadate — DOM regression tests for the fuzzy pickers
 *
 * Locks in the derived-resolution redesign: no upfront "How precise?" /
 * "I remember up to…" declarations. The pickers are progressive drill-downs —
 * year is always present, month/day/time appear one level at a time, the live
 * sentence headline is the hero, and every change auto-applies.
 */

import { afterEach, describe, expect, it } from 'vitest';
import type { FuzzyDateTime } from '../core/types';
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

function clickMonth(container: HTMLElement, index: number) {
    const cells = container.querySelectorAll<HTMLButtonElement>('.ottadate-month-cell');
    cells[index].click();
}

describe('createFuzzyDateTimePicker — structure', () => {
    it('renders no resolution/approximation chip declarations, only the approx segment', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true });

        expect(container.textContent).not.toContain('How precise?');
        expect(container.textContent).not.toContain('I remember up to');
        expect(container.querySelectorAll('.ottadate-chip')).toHaveLength(0);

        const segment = container.querySelectorAll('.ottadate-fuzzy-approx-btn');
        expect(Array.from(segment).map((b) => b.textContent)).toEqual(['Sometime', 'Around', 'Exactly']);
    });

    it('renders the year as an editable stepper input showing the current year', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true });

        const input = container.querySelector<HTMLInputElement>(
            '.ottadate-fuzzy-year-stepper .ottadate-fuzzy-year-input',
        );
        expect(input).not.toBeNull();
        expect(input!.value).toBe(String(new Date().getFullYear()));
    });

    it('steps the year via the chevron buttons', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true });

        const currentYear = new Date().getFullYear();
        const [prevBtn, nextBtn] = container.querySelectorAll<HTMLButtonElement>('.ottadate-fuzzy-year-stepper button');
        const yearValue = () => container.querySelector<HTMLInputElement>('.ottadate-fuzzy-year-input')!.value;

        nextBtn.click();
        expect(yearValue()).toBe(String(currentYear + 1));

        prevBtn.click();
        prevBtn.click();
        expect(yearValue()).toBe(String(currentYear - 1));
    });
});

describe('createFuzzyDateTimePicker — progressive drill-down', () => {
    it('hides day and time until the coarser level is filled', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true });

        // Only year + month visible at first
        expect(container.querySelectorAll('.ottadate-month-cell').length).toBe(12);
        expect(container.querySelectorAll('.ottadate-day').length).toBe(0);
        expect(container.querySelectorAll('.ottadate-time-input').length).toBe(0);

        clickMonth(container, 4); // May
        expect(container.querySelectorAll('.ottadate-day').length).toBeGreaterThan(0);
        expect(container.querySelectorAll('.ottadate-time-input').length).toBe(0);

        container.querySelectorAll<HTMLButtonElement>('.ottadate-day')[19].click(); // 20th
        expect(container.querySelectorAll('.ottadate-time-input').length).toBeGreaterThan(0);
    });

    it('derives the resolution from the deepest filled level and auto-applies', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimePicker(container, { inline: true, onChange: (v) => changes.push(v) });

        clickMonth(container, 4);
        expect(changes[changes.length - 1]?.resolution).toBe('month');

        container.querySelectorAll<HTMLButtonElement>('.ottadate-day')[19].click();
        expect(changes[changes.length - 1]?.resolution).toBe('day');
        expect(changes[changes.length - 1]?.label).toContain('May 20');
    });

    it('re-clicking the active month clears back to year resolution', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimePicker(container, { inline: true, onChange: (v) => changes.push(v) });

        clickMonth(container, 4);
        container.querySelectorAll<HTMLButtonElement>('.ottadate-day')[19].click();
        clickMonth(container, 4); // toggle off

        expect(changes[changes.length - 1]?.resolution).toBe('year');
        expect(container.querySelectorAll('.ottadate-day').length).toBe(0);
    });

    it('updates the live headline as the selection deepens', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true });
        const headline = () => container.querySelector('.ottadate-fuzzy-headline')!;

        expect(headline().classList.contains('ottadate-fuzzy-headline--empty')).toBe(true);

        clickMonth(container, 4);
        expect(headline().textContent).toContain('Sometime in May');
        expect(headline().classList.contains('ottadate-fuzzy-headline--empty')).toBe(false);
    });

    it('respects restricted resolutions by capping the drill depth', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, {
            inline: true,
            resolutions: ['year', 'month'],
            approximations: ['sometime', 'around'],
        });

        clickMonth(container, 4);
        // Day/time may not appear — month is the finest allowed level
        expect(container.querySelectorAll('.ottadate-day').length).toBe(0);
        expect(container.querySelectorAll('.ottadate-time-input').length).toBe(0);
        // Approximation segment honors the restriction
        expect(container.querySelectorAll('.ottadate-fuzzy-approx-btn').length).toBe(2);
    });

    it("disables 'sometime' and swaps to 'around' once a time is set", () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimePicker(container, { inline: true, onChange: (v) => changes.push(v) });

        clickMonth(container, 4);
        container.querySelectorAll<HTMLButtonElement>('.ottadate-day')[19].click();

        const hourInput = container.querySelector<HTMLInputElement>('.ottadate-fuzzy-time .ottadate-time-input')!;
        hourInput.value = '11';
        hourInput.dispatchEvent(new Event('change'));

        expect(changes[changes.length - 1]?.resolution).toBe('hour');
        expect(changes[changes.length - 1]?.approximation).toBe('around');
        const sometimeBtn = Array.from(container.querySelectorAll('.ottadate-fuzzy-approx-btn')).find(
            (b) => b.textContent === 'Sometime',
        )!;
        expect(sometimeBtn.classList.contains('ottadate-fuzzy-approx-btn--disabled')).toBe(true);
    });
});

describe('createFuzzyDateTimeCompact — sentence layout', () => {
    it('renders the sentence selects without a resolution dropdown', () => {
        const container = mount();
        createFuzzyDateTimeCompact(container, { inline: true });

        // approximation + month + year (day appears only after a month is chosen)
        expect(container.querySelector('.ottadate-compact-approx select')).not.toBeNull();
        expect(container.querySelector('.ottadate-compact-month select')).not.toBeNull();
        expect(container.querySelector('.ottadate-compact-year select')).not.toBeNull();
        expect(container.querySelector('.ottadate-compact-day')).toBeNull();
        // The old declared-resolution dropdown is gone
        expect(container.querySelector('.ottadate-compact-res')).toBeNull();
        expect(container.textContent).not.toContain('Stored Meta');
    });

    it("derives resolution from the selects — 'Any month' stays at year", () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimeCompact(container, { inline: true, onChange: (v) => changes.push(v) });

        const monthSelect = container.querySelector<HTMLSelectElement>('.ottadate-compact-month select')!;
        expect(monthSelect.value).toBe(''); // "Any month"

        monthSelect.value = '4'; // May
        monthSelect.dispatchEvent(new Event('change'));
        expect(changes[changes.length - 1]?.resolution).toBe('month');

        const daySelect = container.querySelector<HTMLSelectElement>('.ottadate-compact-day select')!;
        daySelect.value = '20';
        daySelect.dispatchEvent(new Event('change'));
        expect(changes[changes.length - 1]?.resolution).toBe('day');

        // Back to "Any day" → month resolution again (re-query: render rebuilds the DOM)
        const daySelectAfter = container.querySelector<HTMLSelectElement>('.ottadate-compact-day select')!;
        daySelectAfter.value = '';
        daySelectAfter.dispatchEvent(new Event('change'));
        expect(changes[changes.length - 1]?.resolution).toBe('month');
    });

    it('shows the live preview label once a selection exists', () => {
        const container = mount();
        createFuzzyDateTimeCompact(container, { inline: true });

        const preview = () => container.querySelector('.ottadate-compact-desc')!.textContent;
        expect(preview()).toContain('Pick what you remember');

        const monthSelect = container.querySelector<HTMLSelectElement>('.ottadate-compact-month select')!;
        monthSelect.value = '4';
        monthSelect.dispatchEvent(new Event('change'));
        expect(preview()).toContain('Sometime in May');
    });
});
