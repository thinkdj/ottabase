/**
 * @ottabase/ottadate: DateRangePicker draft handling
 *
 * Closing without applying (Cancel, Escape, click outside, half-picked range)
 * must drop the draft, and the field must never show a range that onChange
 * never reported.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { getDefaultRangePresets } from '../core/range-presets';
import type { DateRange } from '../core/types';
import { createDateRangePicker } from '../pickers/DateRangePicker';

afterEach(() => document.body.replaceChildren());

function setup(withPresets: boolean) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const changes: DateRange[] = [];
    const picker = createDateRangePicker(container, {
        placeholder: 'Pick a range',
        presets: withPresets ? getDefaultRangePresets() : undefined,
        onChange: (v) => changes.push(v),
    });
    const text = () => container.querySelector('.ottadate-trigger-text')!.textContent;
    const days = () =>
        Array.from(container.querySelectorAll<HTMLButtonElement>('.ottadate-day:not(.ottadate-day--outside)'));
    return { container, picker, changes, text, days };
}

const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

describe('DateRangePicker drafts', () => {
    it('preset mode: the field ignores the draft and Escape drops it', () => {
        const t = setup(true);
        t.picker.open();
        t.days()[3].click();
        t.days()[8].click();
        expect(t.text()).toBe('Pick a range'); // not applied yet

        escape();
        expect(t.changes).toHaveLength(0);
        expect(t.text()).toBe('Pick a range');
        expect(t.picker.getValue()).toEqual({ start: null, end: null });
    });

    it('preset mode: Apply commits the draft to the field and onChange', () => {
        const t = setup(true);
        t.picker.open();
        t.days()[3].click();
        t.days()[8].click();
        t.container.querySelector<HTMLButtonElement>('.ottadate-range-apply-btn')!.click();
        expect(t.changes).toHaveLength(1);
        expect(t.text()).not.toBe('Pick a range');
    });

    it('classic mode: closing with only a start picked reverts the field', () => {
        const t = setup(false);
        t.picker.open();
        t.days()[3].click();
        expect(t.text()).toContain('…'); // live draft while open
        escape();
        expect(t.changes).toHaveLength(0);
        expect(t.text()).toBe('Pick a range');
    });

    it('classic mode: a completed range sticks after closing', () => {
        const t = setup(false);
        t.picker.open();
        t.days()[3].click();
        t.days()[8].click();
        expect(t.changes).toHaveLength(1);
        expect(t.picker.isOpen()).toBe(false);
        expect(t.text()).not.toBe('Pick a range');
    });
});
