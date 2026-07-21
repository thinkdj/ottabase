/**
 * @ottabase/ottadate — DOM regression tests for the fuzzy pickers (v2)
 *
 * Locks in the recursive "when in X?" architecture: progressive drill-down
 * with terminal part chips (early/mid/late, seasons, day-parts), the single
 * "~ Roughly" approximate toggle, opt-in decade mode, and auto-apply.
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

function clickPart(container: HTMLElement, label: string) {
    const chip = Array.from(container.querySelectorAll<HTMLButtonElement>('.ottadate-part-chip')).find(
        (c) => c.textContent === label,
    )!;
    chip.click();
}

describe('createFuzzyDateTimePicker — structure', () => {
    it('renders the headline, the ~ toggle, and no approximation segment', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true });

        expect(container.querySelector('.ottadate-fuzzy-headline')).not.toBeNull();
        expect(container.querySelector('.ottadate-fuzzy-approx-toggle')).not.toBeNull();
        // The old three-way approximation segment is gone
        expect(container.querySelectorAll('.ottadate-fuzzy-approx-btn')).toHaveLength(0);
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

    it('hides part chips when parts are disabled', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true, parts: false });
        expect(container.querySelectorAll('.ottadate-part-chip')).toHaveLength(0);
    });
});

describe('createFuzzyDateTimePicker — progressive drill-down', () => {
    it('hides day and time until the coarser level is filled', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true });

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

    it('respects restricted resolutions by capping the drill depth', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true, resolutions: ['year', 'month'] });

        clickMonth(container, 4);
        expect(container.querySelectorAll('.ottadate-day').length).toBe(0);
        expect(container.querySelectorAll('.ottadate-time-input').length).toBe(0);
    });
});

describe('createFuzzyDateTimePicker — parts', () => {
    it('offers year parts (incl. seasons) above the month grid and builds "Summer <year>"', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimePicker(container, { inline: true, onChange: (v) => changes.push(v) });

        const chipLabels = Array.from(container.querySelectorAll('.ottadate-part-chip')).map((c) => c.textContent);
        expect(chipLabels).toEqual(['Early', 'Mid', 'Late', 'Spring', 'Summer', 'Autumn', 'Winter']);

        clickPart(container, 'Summer');
        const last = changes[changes.length - 1]!;
        expect(last.resolution).toBe('year');
        expect(last.part).toBe('summer');
        expect(last.label).toContain('Summer');
        // A part is terminal — the day/time steps must not open
        expect(container.querySelectorAll('.ottadate-day').length).toBe(0);
    });

    it('clears the part when a month is named (terminal rule)', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimePicker(container, { inline: true, onChange: (v) => changes.push(v) });

        clickPart(container, 'Summer');
        clickMonth(container, 6); // July supersedes "summer"

        const last = changes[changes.length - 1]!;
        expect(last.part).toBeUndefined();
        expect(last.resolution).toBe('month');
        // Month is named now, so the year-part chips row is gone; day-part rows aren't open yet
        const labels = Array.from(container.querySelectorAll('.ottadate-part-chip')).map((c) => c.textContent);
        expect(labels).not.toContain('Summer');
    });

    it('offers day-parts in the time section', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimePicker(container, { inline: true, onChange: (v) => changes.push(v) });

        clickMonth(container, 4);
        container.querySelectorAll<HTMLButtonElement>('.ottadate-day')[20].click(); // 21st

        const labels = Array.from(container.querySelectorAll('.ottadate-part-chip')).map((c) => c.textContent);
        expect(labels).toEqual(['Morning', 'Afternoon', 'Evening', 'Night']);

        clickPart(container, 'Night');
        const last = changes[changes.length - 1]!;
        expect(last.resolution).toBe('day');
        expect(last.part).toBe('night');
        expect(last.label).toContain('Night of May 21');
    });
});

describe('createFuzzyDateTimePicker — quick entry (type-to-parse)', () => {
    function typeEntry(container: HTMLElement, text: string) {
        const entry = container.querySelector<HTMLInputElement>('.ottadate-fuzzy-entry')!;
        entry.value = text;
        entry.dispatchEvent(new Event('change'));
        return entry;
    }

    it('parses a typed memory into the selection', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimePicker(container, { inline: true, onChange: (v) => changes.push(v) });

        typeEntry(container, 'summer 98');
        const last = changes[changes.length - 1]!;
        expect(last.resolution).toBe('year');
        expect(last.part).toBe('summer');
        expect(last.label).toBe('Summer 1998');
        // The visual controls reflect the parsed state
        expect(container.querySelector<HTMLInputElement>('.ottadate-fuzzy-year-input')!.value).toBe('1998');
    });

    it('marks unparseable input invalid without emitting a change', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimePicker(container, { inline: true, onChange: (v) => changes.push(v) });

        const entry = typeEntry(container, 'banana');
        expect(entry.classList.contains('ottadate-fuzzy-entry--invalid')).toBe(true);
        expect(changes).toHaveLength(0);
    });

    it('rejects input coarser than the baseline (decade typed into a year picker)', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimePicker(container, { inline: true, onChange: (v) => changes.push(v) });

        const entry = typeEntry(container, 'early 90s');
        expect(entry.classList.contains('ottadate-fuzzy-entry--invalid')).toBe(true);
        expect(changes).toHaveLength(0);
    });

    it('accepts a decade memory when decade is in the resolutions', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimePicker(container, {
            inline: true,
            resolutions: ['decade', 'year', 'month', 'day'],
            onChange: (v) => changes.push(v),
        });

        typeEntry(container, 'early 90s');
        expect(changes[changes.length - 1]?.label).toBe('Early 1990s');
    });

    it('hides the field when quickEntry is false', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true, quickEntry: false });
        expect(container.querySelector('.ottadate-fuzzy-entry')).toBeNull();
    });
});

describe('createFuzzyDateTimePicker — approximate', () => {
    it('toggles "~ Roughly", prefixing the label with Around and widening the interval', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimePicker(container, { inline: true, onChange: (v) => changes.push(v) });

        clickMonth(container, 4);
        const plain = changes[changes.length - 1]!;

        container.querySelector<HTMLButtonElement>('.ottadate-fuzzy-approx-toggle')!.click();
        const around = changes[changes.length - 1]!;
        expect(around.approximate).toBe(true);
        expect(around.label).toContain('Around');
        expect(around.earliest).toBeLessThan(plain.earliest);
        expect(around.latest).toBeGreaterThan(plain.latest);
    });

    it('hides the toggle when allowApproximate is false', () => {
        const container = mount();
        createFuzzyDateTimePicker(container, { inline: true, allowApproximate: false });
        expect(container.querySelector('.ottadate-fuzzy-approx-toggle')).toBeNull();
    });
});

describe('createFuzzyDateTimePicker — decade mode', () => {
    it('renders a decade stepper, decade parts, and a 10-year grid', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimePicker(container, {
            inline: true,
            resolutions: ['decade', 'year', 'month'],
            onChange: (v) => changes.push(v),
        });

        const currentDecade = new Date().getFullYear() - (new Date().getFullYear() % 10);
        expect(container.querySelector('.ottadate-fuzzy-stepper-value')!.textContent).toBe(`${currentDecade}s`);
        // Year grid = 10 year cells; no editable year input in decade mode
        expect(container.querySelectorAll('.ottadate-month-cell').length).toBe(10);
        expect(container.querySelector('.ottadate-fuzzy-year-input')).toBeNull();

        clickPart(container, 'Early');
        const last = changes[changes.length - 1]!;
        expect(last.resolution).toBe('decade');
        expect(last.label).toBe(`Early ${currentDecade}s`);
    });

    it('naming a year drills to year resolution and opens the month step', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimePicker(container, {
            inline: true,
            resolutions: ['decade', 'year', 'month'],
            onChange: (v) => changes.push(v),
        });

        // First 10 cells are the years of the current decade
        container.querySelectorAll<HTMLButtonElement>('.ottadate-month-cell')[6].click();
        expect(changes[changes.length - 1]?.resolution).toBe('year');
        // Month grid (12 cells) now renders after the year grid (10 cells)
        expect(container.querySelectorAll('.ottadate-month-cell').length).toBe(22);
    });
});

describe('createFuzzyDateTimeCompact — sentence layout', () => {
    it('renders part + month + year selects and the ~ chip', () => {
        const container = mount();
        createFuzzyDateTimeCompact(container, { inline: true });

        const partSelect = container.querySelector<HTMLSelectElement>('.ottadate-compact-part select')!;
        expect(partSelect).not.toBeNull();
        expect(partSelect.options[0].textContent).toBe('Sometime');
        expect(container.querySelector('.ottadate-compact-month select')).not.toBeNull();
        expect(container.querySelector('.ottadate-compact-year select')).not.toBeNull();
        expect(container.querySelector('.ottadate-compact-approx-chip')).not.toBeNull();
        // Day select appears only after a month is chosen
        expect(container.querySelector('.ottadate-compact-day')).toBeNull();
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
    });

    it('selects a part from the sentence ("Summer · <year>")', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimeCompact(container, { inline: true, onChange: (v) => changes.push(v) });

        const partSelect = container.querySelector<HTMLSelectElement>('.ottadate-compact-part select')!;
        partSelect.value = 'summer';
        partSelect.dispatchEvent(new Event('change'));

        const last = changes[changes.length - 1]!;
        expect(last.part).toBe('summer');
        expect(last.resolution).toBe('year');
        expect(last.label).toContain('Summer');
    });

    it('toggles approximate via the ~ chip', () => {
        const container = mount();
        const changes: (FuzzyDateTime | null)[] = [];
        createFuzzyDateTimeCompact(container, { inline: true, onChange: (v) => changes.push(v) });

        container.querySelector<HTMLButtonElement>('.ottadate-compact-approx-chip')!.click();
        expect(changes[changes.length - 1]?.approximate).toBe(true);
        expect(changes[changes.length - 1]?.label).toContain('Around');
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
