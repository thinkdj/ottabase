/**
 * @ottabase/ottadate: DOM tests for the exact pickers on the shell
 *
 * A day stores and closes; the result line says it in words; typed dates
 * store on Enter and bad ones are flagged; the grid is keyboard-driven; the
 * time row keeps the day; a range drafts on the first click and stores on the
 * second; presets store at once.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultRangePresets } from '../core/range-presets';
import type { DateRange } from '../core/types';
import { createDatePicker } from '../pickers/DatePicker';
import { createDateRangePicker } from '../pickers/DateRangePicker';
import { createDateTimePicker } from '../pickers/DateTimePicker';

type Factory = typeof createDatePicker | typeof createDateTimePicker | typeof createDateRangePicker;

const unix = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => Date.UTC(y, m, d, h, min, s) / 1000;

beforeEach(() => vi.useFakeTimers({ now: Date.UTC(2026, 0, 15, 10, 30), toFake: ['Date'] }));
afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
});

function setup<F extends Factory>(factory: F, options: Partial<Parameters<F>[1]> = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const changes: unknown[] = [];
    const picker = (factory as Factory)(container, {
        timezone: 'UTC',
        inline: true,
        onChange: (v: unknown) => changes.push(v),
        ...options,
    } as never);
    const $ = <T extends HTMLElement = HTMLElement>(sel: string) => container.querySelector<T>(sel);
    const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => Array.from(container.querySelectorAll<T>(sel));
    /** In-month days of the first (or only) calendar */
    const days = (which = 0) =>
        Array.from(
            $$('.ottadate-cal')[which].querySelectorAll<HTMLButtonElement>('.ottadate-day:not(.ottadate-day--outside)'),
        );
    const day = (n: number, which = 0) => days(which).find((b) => b.textContent === String(n))!;
    const text = () => $('.ottadate-trigger-text')!.textContent;
    const label = () => $('.ottadate-result-label')!.textContent;
    const sub = () => $('.ottadate-result-sub')!.textContent;
    const title = () => $('.ottadate-header-title')!.textContent;
    const entry = () => $<HTMLInputElement>('.ottadate-entry')!;
    const type = (value: string) => {
        entry().value = value;
        entry().dispatchEvent(new Event('input'));
    };
    const enter = () => entry().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    const footer = (name: string) => $$<HTMLButtonElement>('.ottadate-footer-btn').find((b) => b.textContent === name)!;
    const key = (el: HTMLElement, k: string) =>
        el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    const last = () => changes[changes.length - 1];
    return {
        container,
        picker,
        changes,
        $,
        $$,
        days,
        day,
        text,
        label,
        sub,
        title,
        entry,
        type,
        enter,
        footer,
        key,
        last,
    };
}

const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

describe('DatePicker', () => {
    it('stores a clicked day, names it in words, and closes the popover', () => {
        const t = setup(createDatePicker, { inline: false, placeholder: 'Pick a date' });
        expect(t.text()).toBe('Pick a date');
        t.$<HTMLButtonElement>('.ottadate-trigger-main')!.click();
        expect(t.picker.isOpen()).toBe(true);
        expect(t.title()).toBe('January 2026');
        expect(t.label()).toBe('Pick a day');
        t.day(20).click();
        expect(t.changes).toEqual([unix(2026, 0, 20)]);
        expect(t.text()).toBe('Jan 20, 2026');
        expect(t.picker.isOpen()).toBe(false);
        t.picker.open();
        expect(t.label()).toBe('Tuesday, January 20, 2026');
        expect(t.sub()).toBe('In 5 days');
        expect(t.day(20).classList.contains('ottadate-day--selected')).toBe(true);
    });

    it('has Today, Clear and a clear button on the field', () => {
        const t = setup(createDatePicker, { inline: false, value: unix(2026, 0, 20) });
        expect(t.text()).toBe('Jan 20, 2026');
        t.picker.open();
        t.footer('Today').click();
        expect(t.last()).toBe(unix(2026, 0, 15));
        expect(t.picker.isOpen()).toBe(false);
        t.picker.open();
        expect(t.sub()).toBe('Today');
        t.footer('Clear').click();
        expect(t.last()).toBeNull();
        expect(t.text()).toBe('Select date…');
        t.picker.setValue(unix(2026, 1, 1));
        expect(t.text()).toBe('Feb 1, 2026');
        t.$<HTMLButtonElement>('.ottadate-trigger-clear')!.click();
        expect(t.last()).toBeNull();
        expect(t.picker.getValue()).toBeNull();
    });

    it('previews typed dates, stores them on Enter, and flags what it cannot read', () => {
        const t = setup(createDatePicker);
        t.type('tomorrow');
        expect(t.label()).toBe('Friday, January 16, 2026');
        expect(t.sub()).toBe('Press Enter to use it');
        expect(t.$('.ottadate-result')!.classList.contains('ottadate-result--preview')).toBe(true);
        t.enter();
        expect(t.last()).toBe(unix(2026, 0, 16));
        expect(t.entry().value).toBe('');
        t.type('someday');
        expect(t.label()).toBe("Can't read that yet");
        t.enter();
        expect(t.entry().classList.contains('ottadate-entry--invalid')).toBe(true);
        expect(t.changes).toHaveLength(1);
    });

    it('keeps typed and clicked days inside minDate and maxDate', () => {
        const t = setup(createDatePicker, { minDate: unix(2026, 0, 10), maxDate: unix(2026, 0, 25) });
        expect(t.day(5).disabled).toBe(true);
        expect(t.day(10).disabled).toBe(false);
        t.type('5 jan 2026');
        expect(t.label()).toBe('Outside the allowed dates');
        expect(t.sub()).toBe('Between Jan 10, 2026 and Jan 25, 2026');
    });

    it('is keyboard-driven: one tab stop, arrows move it, PageDown turns the month', () => {
        const t = setup(createDatePicker);
        const stop = t.$<HTMLButtonElement>('[data-roving="true"]')!;
        expect(stop.textContent).toBe('15'); // today
        stop.focus();
        t.key(stop, 'ArrowRight');
        expect((document.activeElement as HTMLElement).textContent).toBe('16');
        t.key(document.activeElement as HTMLElement, 'ArrowDown');
        expect((document.activeElement as HTMLElement).textContent).toBe('23');
        t.key(document.activeElement as HTMLElement, 'PageDown');
        expect(t.title()).toBe('February 2026');
        expect(t.$$('.ottadate-day').filter((b) => b.tabIndex === 0)).toHaveLength(1);
    });

    it('zooms out to months and years from the title', () => {
        const t = setup(createDatePicker, { value: unix(2026, 0, 20) });
        t.$<HTMLButtonElement>('.ottadate-header-title')!.click();
        expect(t.$$('.ottadate-month-cell')).toHaveLength(12);
        expect(t.title()).toBe('2026');
        t.$<HTMLButtonElement>('.ottadate-header-title')!.click();
        expect(t.$$('.ottadate-year-cell')).toHaveLength(21);
        t.$$<HTMLButtonElement>('.ottadate-year-cell')
            .find((b) => b.textContent === '2030')!
            .click();
        expect(t.title()).toBe('2030');
        t.$$<HTMLButtonElement>('.ottadate-month-cell')
            .find((b) => b.textContent === 'Mar')!
            .click();
        expect(t.title()).toBe('March 2030');
        expect(t.changes).toHaveLength(0); // browsing never stores
    });

    it('goes quiet when disabled', () => {
        const t = setup(createDatePicker, { inline: false, value: unix(2026, 0, 20) });
        t.picker.setOptions({ disabled: true });
        expect(t.$('.ottadate-trigger')!.getAttribute('aria-disabled')).toBe('true');
        expect(t.$('.ottadate-trigger-clear')!.style.display).toBe('none');
        t.picker.open();
        expect(t.picker.isOpen()).toBe(false);
    });
});

describe('DateTimePicker', () => {
    it('keeps the time across day picks and stores every time edit', () => {
        const t = setup(createDateTimePicker, { inline: false });
        t.picker.open();
        expect(t.label()).toBe('Pick a day and a time');
        t.day(20).click();
        expect(t.last()).toBe(unix(2026, 0, 20, 10, 30)); // the day at the current time
        const hour = t.$<HTMLInputElement>('[data-key="time:hour"]')!;
        hour.value = '14';
        hour.dispatchEvent(new Event('change'));
        expect(t.last()).toBe(unix(2026, 0, 20, 14, 30));
        const minute = t.$<HTMLInputElement>('[data-key="time:minute"]')!;
        minute.value = '45';
        minute.dispatchEvent(new Event('change'));
        expect(t.last()).toBe(unix(2026, 0, 20, 14, 45));
        expect(t.text()).toBe('Jan 20, 2026 14:45');
        expect(t.label()).toBe('Tuesday, January 20, 2026 at 14:45');
        expect(t.sub()).toBe('UTC');
        t.footer('23:59').click();
        expect(t.last()).toBe(unix(2026, 0, 20, 23, 59, 59));
        t.day(21).click();
        expect(t.last()).toBe(unix(2026, 0, 21, 23, 59, 59));
    });

    it('offers AM and PM on a 12-hour clock', () => {
        const t = setup(createDateTimePicker, { inline: false, use12Hour: true, value: unix(2026, 0, 20, 10, 30) });
        t.picker.open();
        expect(t.$<HTMLInputElement>('[data-key="time:hour"]')!.value).toBe('10');
        const period = t.$<HTMLButtonElement>('.ottadate-time-period')!;
        expect(period.textContent).toBe('AM');
        period.click();
        expect(t.last()).toBe(unix(2026, 0, 20, 22, 30));
        expect(t.text()).toBe('Jan 20, 2026 10:30 PM');
        const hour = t.$<HTMLInputElement>('[data-key="time:hour"]')!;
        hour.value = '12';
        hour.dispatchEvent(new Event('change'));
        expect(t.last()).toBe(unix(2026, 0, 20, 12, 30));
    });

    it('takes a typed moment, and Done closes the popover', () => {
        const t = setup(createDateTimePicker, { inline: false });
        t.picker.open();
        t.type('tomorrow 9am');
        expect(t.label()).toBe('Friday, January 16, 2026 at 09:00');
        t.enter();
        expect(t.last()).toBe(unix(2026, 0, 16, 9));
        expect(t.picker.isOpen()).toBe(false);
        t.picker.open();
        t.day(17).click();
        expect(t.picker.isOpen()).toBe(true); // a day pick keeps the panel open for the time
        t.footer('Done').click();
        expect(t.picker.isOpen()).toBe(false);
    });
});

describe('DateRangePicker', () => {
    it('drafts on the first click and stores the ordered range on the second', () => {
        const t = setup(createDateRangePicker, { inline: false, placeholder: 'Pick a range' });
        t.picker.open();
        expect(t.$$('.ottadate-cal')).toHaveLength(2);
        expect(t.label()).toBe('Pick the first day');
        t.day(20).click();
        expect(t.changes).toHaveLength(0);
        expect(t.text()).toBe('Pick a range');
        expect(t.label()).toBe('Jan 20, 2026 to …');
        expect(t.sub()).toBe('Now pick the last day');
        t.day(10).click();
        expect(t.changes).toEqual([{ start: unix(2026, 0, 10), end: unix(2026, 0, 20) }]);
        expect(t.picker.isOpen()).toBe(false);
        expect(t.text()).toBe('Jan 10, 2026 to Jan 20, 2026');
        t.picker.open();
        expect(t.sub()).toBe('11 days');
        expect(t.day(10).classList.contains('ottadate-day--range-start')).toBe(true);
        expect(t.day(15).classList.contains('ottadate-day--range-middle')).toBe(true);
        expect(t.day(20).classList.contains('ottadate-day--range-end')).toBe(true);
    });

    it('drops a half-picked range when the popover closes', () => {
        const t = setup(createDateRangePicker, { inline: false, placeholder: 'Pick a range' });
        t.picker.open();
        t.day(20).click();
        escape();
        expect(t.changes).toHaveLength(0);
        expect(t.text()).toBe('Pick a range');
        t.picker.open();
        expect(t.label()).toBe('Pick the first day');
        expect(t.$$('.ottadate-day--range-start')).toHaveLength(0);
    });

    it('paints the span under the pointer while the last day is pending', () => {
        const t = setup(createDateRangePicker);
        t.day(20).click();
        t.day(25).dispatchEvent(new Event('mouseenter'));
        expect(t.day(22).classList.contains('ottadate-day--range-middle')).toBe(true);
        expect(t.day(25).classList.contains('ottadate-day--range-end')).toBe(true);
    });

    it('stores a preset at once and reads it back by name', () => {
        const t = setup(createDateRangePicker, { presets: getDefaultRangePresets() });
        t.$$<HTMLButtonElement>('.ottadate-range-preset')
            .find((b) => b.textContent === 'Last 7 Days')!
            .click();
        const range = t.last() as DateRange;
        expect(range.start).toBe(unix(2026, 0, 9));
        expect(range.end).toBe(unix(2026, 0, 15, 23, 59, 59));
        expect(t.sub()).toBe('Last 7 Days, 7 days');
        expect(
            t
                .$$<HTMLButtonElement>('.ottadate-range-preset')
                .find((b) => b.textContent === 'Last 7 Days')!
                .getAttribute('aria-pressed'),
        ).toBe('true');
        t.type('last 30 days');
        expect(t.label()).toBe('Dec 17, 2025 to Jan 15, 2026');
        t.enter();
        expect((t.last() as DateRange).start).toBe(unix(2025, 11, 17));
    });

    it('takes typed ranges in either order and single days', () => {
        const t = setup(createDateRangePicker, { inline: false });
        t.picker.open();
        t.type('jan 12 to jan 5');
        expect(t.label()).toBe('Jan 5, 2026 to Jan 12, 2026');
        t.enter();
        expect(t.last()).toEqual({ start: unix(2026, 0, 5), end: unix(2026, 0, 12) });
        expect(t.picker.isOpen()).toBe(false);
        t.picker.open();
        t.type('tomorrow');
        t.enter();
        expect(t.last()).toEqual({ start: unix(2026, 0, 16), end: unix(2026, 0, 16) });
        expect(t.text()).toBe('Jan 16, 2026');
        t.picker.open();
        t.footer('Clear').click();
        expect(t.last()).toEqual({ start: null, end: null });
    });
});
