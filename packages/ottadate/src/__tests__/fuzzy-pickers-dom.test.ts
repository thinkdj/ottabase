/**
 * @ottabase/ottadate: DOM tests for the fuzzy pickers
 *
 * Locks in the zoom IA: one grid at a time, the title zooms out, arrows browse
 * without touching the value, cells name a period and zoom in, chips answer at
 * the level on screen ("Sometime" coarsens, parts are terminal), bands show
 * parts and "~ Roughly", and the shared shell (entry, result line, popover).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createFuzzyDateTime } from '../core/fuzzy';
import type { FuzzyDateTime, FuzzyDateTimePickerOptions } from '../core/types';
import { createFuzzyDateTimeCompact } from '../pickers/FuzzyDateTimeCompact';
import { createFuzzyDateTimePicker } from '../pickers/FuzzyDateTimePicker';

afterEach(() => {
    document.body.replaceChildren();
});

const YEAR = new Date().getFullYear();
const DECADE = YEAR - (YEAR % 10);

function setup(options: FuzzyDateTimePickerOptions = {}, factory = createFuzzyDateTimePicker) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const changes: (FuzzyDateTime | null)[] = [];
    const picker = factory(container, { inline: true, onChange: (v) => changes.push(v), ...options });
    const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel);
    const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => Array.from(container.querySelectorAll<T>(sel));
    const cells = () => $$<HTMLButtonElement>('.ottadate-fz-cell');
    const cell = (text: string) => cells().find((c) => c.textContent === text)!;
    const chip = (text: string) => $$<HTMLButtonElement>('.ottadate-fz-chip').find((c) => c.textContent === text)!;
    const chipLabels = () => $$('.ottadate-fz-chip').map((c) => c.textContent);
    const title = () => $('.ottadate-fz-title')!.textContent;
    const last = () => changes[changes.length - 1];
    /** Browse back to a year's decade and name it */
    const pickYear = (year: number) => {
        for (let d = DECADE; d > year - (year % 10); d -= 10) $$<HTMLButtonElement>('.ottadate-nav-btn')[0].click();
        cell(String(year)).click();
    };
    return { container, picker, changes, $, $$, cells, cell, chip, chipLabels, title, last, pickYear };
}

describe('FuzzyDateTimePicker: first view', () => {
    it('opens on the years of the current decade with nothing picked', () => {
        const t = setup();
        expect(t.title()).toBe(`${DECADE}s`);
        expect(t.cells()).toHaveLength(10);
        expect(t.chipLabels()).toEqual([]); // a decade can't be stored by default, so no decade chips
        expect(t.$('.ottadate-result-label')!.textContent).toBe('Pick what you remember');
        expect(t.$<HTMLButtonElement>('.ottadate-fz-approx')!.hidden).toBe(true);
        // This year is marked, but nothing is selected (no fake pre-filled year)
        expect(t.cell(String(YEAR)).classList.contains('ottadate-fz-cell--now')).toBe(true);
        expect(t.$('[aria-current="true"]')).toBeNull();
    });

    it('opens on the decades grid when decades are allowed', () => {
        const t = setup({ resolutions: ['decade', 'year', 'month'] });
        expect(t.cells()).toHaveLength(12);
        expect(t.cells()[0].textContent).toMatch(/^\d{3}0s$/);
        expect(t.$<HTMLButtonElement>('.ottadate-fz-title')!.disabled).toBe(true);
    });
});

describe('FuzzyDateTimePicker: zoom in by naming a period', () => {
    it('year → months with year chips, auto-applied', () => {
        const t = setup();
        t.pickYear(1998);
        expect(t.last()!.label).toBe('Sometime in 1998');
        expect(t.title()).toBe('1998');
        expect(t.cells()).toHaveLength(12);
        expect(t.chipLabels()).toEqual(['Sometime', 'Early', 'Mid', 'Late', 'Spring', 'Summer', 'Autumn', 'Winter']);
        expect(t.chip('Sometime').getAttribute('aria-pressed')).toBe('true');
    });

    it('month → a real calendar with weekday headers', () => {
        const t = setup({ firstDayOfWeek: 1 });
        t.pickYear(2010);
        t.cell('May').click();
        expect(t.last()!.resolution).toBe('month');
        expect(t.title()).toBe('May 2010');
        expect(t.$$('.ottadate-fz-weekday')).toHaveLength(7);
        expect(t.cells()).toHaveLength(31);
        // May 1 2010 was a Saturday: 5 blanks before it when weeks start on Monday
        expect(t.$$('.ottadate-fz-grid--days > span:not(.ottadate-fz-weekday)')).toHaveLength(5);
    });

    it('day → hours, day-parts, and exact time', () => {
        const t = setup();
        t.pickYear(2010);
        t.cell('May').click();
        t.cell('21').click();
        expect(t.last()!.label).toBe('May 21, 2010');
        expect(t.title()).toBe('Fri, May 21, 2010');
        expect(t.cells()).toHaveLength(24);
        expect(t.chipLabels()).toEqual(['All day', 'Morning', 'Afternoon', 'Evening', 'Night']);
        expect(t.$$('.ottadate-fz-exact .ottadate-time-input')).toHaveLength(3);

        t.cell('14:00').click();
        expect(t.last()!.resolution).toBe('hour');
        expect(t.cell('14:00').getAttribute('aria-current')).toBe('true');
    });

    it('stops at the finest allowed level (day parts only, no hours)', () => {
        const t = setup({ resolutions: ['year', 'month', 'day'] });
        t.pickYear(2010);
        t.cell('May').click();
        t.cell('21').click();
        expect(t.cells()).toHaveLength(0);
        expect(t.chipLabels()).toContain('Night');
        expect(t.$('.ottadate-fz-exact')).toBeNull();
    });

    it('stays on the day grid when nothing finer is possible', () => {
        const t = setup({ resolutions: ['year', 'month', 'day'], parts: false });
        t.pickYear(2010);
        t.cell('May').click();
        t.cell('21').click();
        expect(t.title()).toBe('May 2010');
        expect(t.cell('21').getAttribute('aria-current')).toBe('true');
    });
});

describe('FuzzyDateTimePicker: browsing never changes the value', () => {
    it('arrows page the view only', () => {
        const t = setup();
        t.pickYear(1998);
        const count = t.changes.length;
        t.$$<HTMLButtonElement>('.ottadate-nav-btn')[1].click();
        expect(t.title()).toBe('1999');
        expect(t.changes).toHaveLength(count);
        expect(t.chip('Sometime').getAttribute('aria-pressed')).toBe('false');
    });

    it('the title zooms out and keeps the path highlighted', () => {
        const t = setup();
        t.pickYear(2010);
        t.cell('May').click();
        const count = t.changes.length;
        t.$<HTMLButtonElement>('.ottadate-fz-title')!.click();
        expect(t.title()).toBe('2010');
        expect(t.cell('May').getAttribute('aria-current')).toBe('true');
        t.$<HTMLButtonElement>('.ottadate-fz-title')!.click();
        expect(t.cell('2010').getAttribute('aria-current')).toBe('true');
        expect(t.changes).toHaveLength(count);
    });

    it('re-tapping a cell on the path zooms in without dropping finer levels', () => {
        const t = setup();
        t.pickYear(2010);
        t.cell('May').click();
        t.cell('21').click();
        t.$<HTMLButtonElement>('.ottadate-fz-title')!.click(); // May 2010
        t.$<HTMLButtonElement>('.ottadate-fz-title')!.click(); // 2010
        const count = t.changes.length;
        t.cell('May').click();
        expect(t.title()).toBe('May 2010');
        expect(t.changes).toHaveLength(count);
        expect(t.picker.getValue()!.label).toBe('May 21, 2010');
    });
});

describe('FuzzyDateTimePicker: chips answer for the period on screen', () => {
    it('a part is terminal and draws a band', () => {
        const t = setup();
        t.pickYear(1998);
        t.chip('Summer').click();
        expect(t.last()).toMatchObject({ resolution: 'year', part: 'summer', label: 'Summer 1998' });
        expect(t.title()).toBe('1998'); // no zoom
        const banded = t.$$('.ottadate-fz-cell--band').map((c) => c.textContent);
        expect(banded).toEqual(['Jun', 'Jul', 'Aug']);
        expect(t.$('.ottadate-result-sub')!.textContent).toBe('Jun 1 to Aug 31, 1998');
    });

    it('tapping the active part drops it; naming a month replaces it', () => {
        const t = setup();
        t.pickYear(1998);
        t.chip('Summer').click();
        t.chip('Summer').click();
        expect(t.last()!.label).toBe('Sometime in 1998');

        t.chip('Summer').click();
        t.cell('Jul').click();
        expect(t.last()!.part).toBeUndefined();
        expect(t.last()!.label).toBe('Sometime in July 1998');
    });

    it('"Sometime" is how you become less precise', () => {
        const t = setup();
        t.pickYear(2010);
        t.cell('May').click();
        t.cell('21').click();
        t.$<HTMLButtonElement>('.ottadate-fz-title')!.click(); // back to May 2010
        t.chip('Sometime').click();
        expect(t.last()!.label).toBe('Sometime in May 2010');
        expect(t.$('[aria-current="true"]')).toBeNull();
    });

    it('a chip on a browsed period sets that period', () => {
        const t = setup();
        t.pickYear(1998);
        t.$$<HTMLButtonElement>('.ottadate-nav-btn')[0].click(); // 1997
        t.chip('Summer').click();
        expect(t.last()!.label).toBe('Summer 1997');
    });

    it('day-parts read "Night of …"', () => {
        const t = setup();
        t.pickYear(2010);
        t.cell('May').click();
        t.cell('21').click();
        t.chip('Night').click();
        expect(t.last()!.label).toBe('Night of May 21, 2010');
        expect(t.$$('.ottadate-fz-cell--band').map((c) => c.textContent)).toEqual(['21:00', '22:00', '23:00']);
    });

    it('decade chips build "Early 1990s"', () => {
        const t = setup({ resolutions: ['decade', 'year', 'month'] });
        t.cell('1990s').click();
        expect(t.last()!.label).toBe('Sometime in the 1990s');
        t.chip('Early').click();
        expect(t.last()!.label).toBe('Early 1990s');
        expect(t.$$('.ottadate-fz-cell--band').map((c) => c.textContent)).toEqual(['1990', '1991', '1992', '1993']);
    });

    it('hides parts when disabled', () => {
        const t = setup({ parts: false });
        t.pickYear(1998);
        expect(t.chipLabels()).toEqual(['Sometime']);
    });
});

describe('FuzzyDateTimePicker: ~ Roughly', () => {
    it('widens the value and hatches the spill on the grid', () => {
        const t = setup();
        t.pickYear(1998);
        const plain = t.last()!;
        t.$<HTMLButtonElement>('.ottadate-fz-approx')!.click();
        const around = t.last()!;
        expect(around.label).toBe('Around 1998');
        expect(around.earliest).toBeLessThan(plain.earliest);
        expect(t.$('.ottadate-fz-approx')!.getAttribute('aria-pressed')).toBe('true');
        expect(t.$('.ottadate-result-sub')!.textContent).toBe('1997 to 1999');

        t.$<HTMLButtonElement>('.ottadate-fz-title')!.click(); // 1990s
        expect(t.$$('.ottadate-fz-cell--approx').map((c) => c.textContent)).toEqual(['1997', '1999']);
    });

    it('is hidden when allowApproximate is false', () => {
        const t = setup({ allowApproximate: false });
        t.pickYear(1998);
        expect(t.$<HTMLButtonElement>('.ottadate-fz-approx')!.hidden).toBe(true);
    });
});

describe('FuzzyDateTimePicker: type it', () => {
    const type = (t: ReturnType<typeof setup>, text: string) => {
        const entry = t.$<HTMLInputElement>('.ottadate-entry')!;
        entry.value = text;
        entry.dispatchEvent(new Event('input'));
        return entry;
    };
    const enter = (entry: HTMLInputElement) =>
        entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    it('previews live, applies on Enter, and jumps the view to the value', () => {
        const t = setup();
        const entry = type(t, 'summer 98');
        expect(t.$('.ottadate-result-label')!.textContent).toBe('Summer 1998');
        expect(t.$('.ottadate-result-sub')!.textContent).toBe('Press Enter to use it');
        expect(t.changes).toHaveLength(0);

        enter(entry);
        expect(t.last()!.label).toBe('Summer 1998');
        expect(entry.value).toBe('');
        expect(t.title()).toBe('1998');
        expect(t.chip('Summer').getAttribute('aria-pressed')).toBe('true');
    });

    it('applies on blur (change) too', () => {
        const t = setup();
        const entry = type(t, 'late may 2010');
        entry.dispatchEvent(new Event('change'));
        expect(t.last()!.label).toBe('Late May 2010');
    });

    it('flags unreadable input without emitting', () => {
        const t = setup();
        const entry = type(t, 'banana');
        expect(t.$('.ottadate-result-label')!.textContent).toBe("Can't read that yet");
        enter(entry);
        expect(entry.classList.contains('ottadate-entry--invalid')).toBe(true);
        expect(entry.getAttribute('aria-invalid')).toBe('true');
        expect(t.changes).toHaveLength(0);
    });

    it('rejects a decade in a year-based field, accepts it when decades are allowed', () => {
        const t = setup();
        enter(type(t, 'early 90s'));
        expect(t.$('.ottadate-result-label')!.textContent).toBe('Too vague for this field');
        expect(t.changes).toHaveLength(0);

        const d = setup({ resolutions: ['decade', 'year'] });
        enter(type(d, 'early 90s'));
        expect(d.last()!.label).toBe('Early 1990s');
    });

    it('Escape drops the typed text first', () => {
        const t = setup();
        const entry = type(t, 'summer');
        entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(entry.value).toBe('');
        expect(t.$('.ottadate-result-label')!.textContent).toBe('Pick what you remember');
    });

    it('hides the field when quickEntry is false', () => {
        const t = setup({ quickEntry: false });
        expect(t.$<HTMLInputElement>('.ottadate-entry')!.hidden).toBe(true);
    });
});

describe('FuzzyDateTimePicker: result line, value API, keyboard', () => {
    it('says how precise a plain value is', () => {
        const t = setup();
        t.pickYear(2010);
        t.cell('May').click();
        expect(t.$('.ottadate-result-sub')!.textContent).toBe('Precise to the month');
    });

    it('setValue anchors the view inside the value', () => {
        const t = setup();
        t.picker.setValue(createFuzzyDateTime(new Date(Date.UTC(2010, 4, 1)), 'month', { part: 'late' }));
        expect(t.title()).toBe('May 2010');
        expect(t.chip('Late').getAttribute('aria-pressed')).toBe('true');
        expect(t.$$('.ottadate-fz-cell--band')).toHaveLength(11); // May 21 to 31
        expect(t.picker.getValue()!.label).toBe('Late May 2010');
    });

    it('Today and Clear', () => {
        const t = setup();
        t.$$<HTMLButtonElement>('.ottadate-footer-btn')
            .find((b) => b.textContent === 'Today')!
            .click();
        expect(t.last()!.resolution).toBe('day');
        t.$$<HTMLButtonElement>('.ottadate-footer-btn')
            .find((b) => b.textContent === 'Clear')!
            .click();
        expect(t.last()).toBeNull();
    });

    it('one tab stop per grid; arrows move focus', () => {
        const t = setup();
        const stops = t.cells().filter((c) => c.tabIndex === 0);
        expect(stops).toHaveLength(1);
        stops[0].focus();
        stops[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(document.activeElement).toBe(t.cells()[t.cells().indexOf(stops[0]) + 1]);
    });

    it('keeps keyboard focus on the cell position after paging', () => {
        const t = setup();
        t.cells()[3].focus();
        t.$('.ottadate-fz-zoom')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
        expect(t.title()).toBe(`${DECADE - 10}s`);
        expect(document.activeElement).toBe(t.cells()[3]);
    });
});

describe('FuzzyDateTimePicker: popover', () => {
    it('keeps the clear button outside the open button and round-trips open/close', () => {
        const t = setup({ inline: false, value: createFuzzyDateTime(new Date(Date.UTC(1998, 0)), 'year') });
        const main = t.$<HTMLButtonElement>('.ottadate-trigger-main')!;
        expect(main.querySelector('button')).toBeNull();
        expect(main.textContent).toBe('Sometime in 1998');
        expect(t.$('.ottadate-panel')!.style.display).toBe('none');

        main.click();
        expect(t.picker.isOpen()).toBe(true);
        expect(t.title()).toBe('1998');

        t.$$<HTMLButtonElement>('.ottadate-footer-btn')
            .find((b) => b.textContent === 'Done')!
            .click();
        expect(t.picker.isOpen()).toBe(false);

        main.click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(t.picker.isOpen()).toBe(false);
    });

    it('the clear button empties the value', () => {
        const t = setup({ inline: false, value: createFuzzyDateTime(new Date(Date.UTC(1998, 0)), 'year') });
        t.$<HTMLButtonElement>('.ottadate-trigger-clear')!.click();
        expect(t.last()).toBeNull();
        expect(t.$('.ottadate-trigger-text')!.textContent).toBe('Select approximate date…');
    });

    it('Enter in the entry applies and closes', () => {
        const t = setup({ inline: false });
        t.picker.open();
        const entry = t.$<HTMLInputElement>('.ottadate-entry')!;
        entry.value = '1996ish';
        entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(t.last()!.label).toBe('Around 1996');
        expect(t.picker.isOpen()).toBe(false);
    });

    it('disabled blocks opening', () => {
        const t = setup({ inline: false, disabled: true });
        t.$<HTMLButtonElement>('.ottadate-trigger-main')!.click();
        expect(t.picker.isOpen()).toBe(false);
    });
});

describe('FuzzyDateTimeCompact: selects in label order', () => {
    const setupCompact = (options: FuzzyDateTimePickerOptions = {}) => setup(options, createFuzzyDateTimeCompact);
    const pick = (t: ReturnType<typeof setup>, key: string, value: string) => {
        const s = t.$<HTMLSelectElement>(`.ottadate-fzc-select--${key} select`)!;
        s.value = value;
        s.dispatchEvent(new Event('change'));
    };
    const order = (t: ReturnType<typeof setup>) =>
        t.$$('.ottadate-fzc-select').map((w) => w.className.replace(/.*--/, ''));

    it('starts with part + a "Year" placeholder, nothing pre-filled', () => {
        const t = setupCompact();
        expect(order(t)).toEqual(['part', 'year']);
        expect(t.$<HTMLSelectElement>('.ottadate-fzc-select--year select')!.value).toBe('');
        expect(t.$('.ottadate-result-label')!.textContent).toBe('Pick what you remember');
    });

    it('reveals month then day, ordered like the label', () => {
        const t = setupCompact();
        pick(t, 'year', 'y2010');
        expect(t.last()!.label).toBe('Sometime in 2010');
        expect(order(t)).toEqual(['part', 'month', 'year']);

        pick(t, 'month', '4');
        pick(t, 'part', 'late');
        expect(t.last()!.label).toBe('Late May 2010');

        pick(t, 'day', '21');
        expect(order(t)).toEqual(['part', 'month', 'day', 'year']);
        expect(t.last()!.label).toBe('May 21, 2010');
        expect(t.$$('.ottadate-fz-exact .ottadate-time-input').length).toBeGreaterThan(0);
    });

    it('changing the year keeps the rest of the date', () => {
        const t = setupCompact();
        pick(t, 'year', 'y1998');
        pick(t, 'part', 'summer');
        pick(t, 'year', 'y1997');
        expect(t.last()!.label).toBe('Summer 1997');
    });

    it('groups years by decade and offers the decade itself when allowed', () => {
        const t = setupCompact({ resolutions: ['decade', 'year', 'month'] });
        expect(t.$$('.ottadate-fzc-select--year optgroup').length).toBeGreaterThan(10);
        pick(t, 'year', 'd1990');
        expect(t.last()!.label).toBe('Sometime in the 1990s');
        pick(t, 'part', 'early');
        expect(t.last()!.label).toBe('Early 1990s');
    });

    it('shares the shell: ~ Roughly and typing', () => {
        const t = setupCompact();
        pick(t, 'year', 'y1996');
        t.$<HTMLButtonElement>('.ottadate-fz-approx')!.click();
        expect(t.last()!.label).toBe('Around 1996');

        const entry = t.$<HTMLInputElement>('.ottadate-entry')!;
        entry.value = 'winter 2001';
        entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(t.last()!.label).toBe('Winter 2001');
        expect(t.$<HTMLSelectElement>('.ottadate-fzc-select--part select')!.value).toBe('winter');
    });
});

describe('FuzzyDateTimeCompact: keyboard', () => {
    it('keeps focus on a select after it re-renders', () => {
        const t = setup({}, createFuzzyDateTimeCompact);
        const year = t.$<HTMLSelectElement>('.ottadate-fzc-select--year select')!;
        year.focus();
        year.value = 'y2010';
        year.dispatchEvent(new Event('change'));
        expect(document.activeElement).toBe(t.$('.ottadate-fzc-select--year select'));
        expect(document.activeElement).not.toBe(year); // a fresh node, focus carried over
    });
});

describe('FuzzyDateTimePicker: disabled', () => {
    it('makes an inline panel inert and re-enables it via setOptions', () => {
        const t = setup({ disabled: true });
        expect(t.$('.ottadate-panel')!.hasAttribute('inert')).toBe(true);
        t.picker.setOptions({ disabled: false });
        expect(t.$('.ottadate-panel')!.hasAttribute('inert')).toBe(false);
    });
});
