/**
 * @ottabase/ottadate — FuzzyDateTimePicker
 *
 * Picker for dates the user only partially remembers. Instead of asking the
 * user to declare a precision level up front, the UI is a progressive
 * drill-down: the year is always present, and month → day → time each appear
 * one level at a time as the previous level is filled. The resolution is
 * DERIVED from how deep the user went (see core/fuzzy-selection.ts).
 *
 * Layout:
 *   Sometime in May 2020                ← live sentence headline (the result)
 *   [ Sometime | Around | Exactly ]     ← approximation segment
 *   YEAR   ‹  [2020]  ›                 ← stepper with a directly editable year
 *   MONTH  · if you remember           ← 12-month grid; re-tap the active month to clear
 *   DAY    · if you remember           ← appears once a month is chosen
 *   TIME   · if you remember           ← hh:mm:ss cascade, appears once a day is chosen
 *   [Today] [Clear]          [Done]     ← every change auto-applies; Done just closes
 *
 * Usage:
 *   const picker = OttaDate.createFuzzyDateTimePicker(container, {
 *       onChange: (fuzzy) => console.log(fuzzy),
 *   });
 */

import { APPROXIMATION_LABELS } from '../core/fuzzy';
import { createFuzzySelection, type FuzzySelection } from '../core/fuzzy-selection';
import type { FuzzyDateTime, FuzzyDateTimePickerInstance, FuzzyDateTimePickerOptions } from '../core/types';
import { getIntlLocale, getMonthNamesShort, pad2, resolveConfig } from '../core/utils';
import {
    btn,
    clearChildren,
    div,
    el,
    iconCalendar,
    iconChevronLeft,
    iconChevronRight,
    iconX,
    onClickOutside,
    onEscape,
    span,
} from '../dom/helpers';

export function createFuzzyDateTimePicker(
    container: HTMLElement,
    options: FuzzyDateTimePickerOptions = {},
): FuzzyDateTimePickerInstance {
    let config = resolveConfig({
        placeholder: 'Select approximate date…',
        ...options,
    });

    let sel: FuzzySelection = createFuzzySelection({
        resolutions: config.resolutions,
        approximations: config.approximations,
        value: config.value,
    });
    let currentFuzzy: FuzzyDateTime | null = config.value ?? null;

    let isOpen = false;
    let removeClickOutside: (() => void) | null = null;
    let removeEscapeHandler: (() => void) | null = null;

    const root = div('ottadate');
    if (config.inline) root.classList.add('ottadate--inline');
    container.appendChild(root);

    // Trigger
    const trigger = el('button', {
        className: 'ottadate-trigger',
        type: 'button',
        'aria-haspopup': 'dialog',
        'aria-expanded': 'false',
    }) as HTMLButtonElement;

    if (config.disabled) {
        trigger.setAttribute('aria-disabled', 'true');
    }

    const triggerIcon = span('ottadate-trigger-icon', '');
    triggerIcon.innerHTML = iconCalendar();
    const triggerText = span('ottadate-trigger-text', '');
    const triggerClear = el('button', {
        className: 'ottadate-trigger-clear',
        type: 'button',
        'aria-label': 'Clear',
    }) as HTMLButtonElement;
    triggerClear.innerHTML = iconX();
    triggerClear.style.display = 'none';

    trigger.append(triggerIcon, triggerText, triggerClear);
    if (!config.inline) root.appendChild(trigger);

    // Popover
    const popover = div('ottadate-popover');
    popover.style.display = config.inline ? '' : 'none';
    popover.style.minWidth = '17rem';
    if (config.inline) isOpen = true;
    root.appendChild(popover);

    // --- Actions ---

    function emitChange() {
        if (config.onChange) {
            config.onChange(currentFuzzy);
        }
    }

    /** Every interaction commits immediately — each partial state is a valid fuzzy date */
    function commit() {
        currentFuzzy = sel.build();
        updateTriggerText();
        emitChange();
        render();
    }

    // --- Rendering ---

    function updateTriggerText() {
        if (currentFuzzy) {
            triggerText.textContent = currentFuzzy.label;
            triggerText.classList.remove('ottadate-trigger-placeholder');
            triggerClear.style.display = '';
        } else {
            triggerText.textContent = config.placeholder!;
            triggerText.classList.add('ottadate-trigger-placeholder');
            triggerClear.style.display = 'none';
        }
    }

    /** Section label row: micro-label on the left, muted hint on the right */
    function labelRow(label: string, hint?: string): HTMLElement {
        const row = div('ottadate-fuzzy-label-row');
        row.appendChild(span('ottadate-fuzzy-label', label));
        if (hint) row.appendChild(span('ottadate-fuzzy-hint', hint));
        return row;
    }

    /** The live sentence — what will actually be stored, front and center */
    function renderHeadline(): HTMLElement {
        const headline = div('ottadate-fuzzy-headline');
        const preview = sel.build();
        if (preview) {
            headline.textContent = preview.label;
        } else {
            headline.textContent = 'Pick what you remember…';
            headline.classList.add('ottadate-fuzzy-headline--empty');
        }
        return headline;
    }

    /** Segmented Sometime / Around / Exactly control — it only shapes the sentence */
    function renderApproxSegment(): HTMLElement {
        const segment = div('ottadate-fuzzy-approx');
        for (const approx of sel.allowedApprox) {
            const button = btn('ottadate-fuzzy-approx-btn', APPROXIMATION_LABELS[approx], () => {
                if (config.disabled) return;
                sel.setApproximation(approx);
                if (sel.state.hasSelection) commit();
                else render();
            });
            if (approx === sel.state.approximation) button.classList.add('ottadate-fuzzy-approx-btn--active');
            // "Sometime at 11:30" is a contradiction — disabled once a time is set
            if (approx === 'sometime' && sel.sometimeDisabled()) {
                button.classList.add('ottadate-fuzzy-approx-btn--disabled');
                button.title = 'Not available once a time is set';
            }
            segment.appendChild(button);
        }
        return segment;
    }

    /** Year: prev/next steppers around a directly editable value */
    function renderYearSection(): HTMLElement {
        const section = div('ottadate-fuzzy-section');
        section.appendChild(labelRow('Year'));

        const stepper = div('ottadate-fuzzy-year-stepper');

        const prevBtn = btn('ottadate-nav-btn', '', () => {
            if (config.disabled) return;
            sel.stepYear(-1);
            commit();
        });
        prevBtn.innerHTML = iconChevronLeft();
        prevBtn.setAttribute('aria-label', 'Previous year');

        const yearInput = el('input', {
            className: 'ottadate-fuzzy-year-input',
            type: 'number',
            'aria-label': 'Year',
        }) as HTMLInputElement;
        yearInput.value = String(sel.state.year);
        if (config.disabled) yearInput.disabled = true;
        yearInput.addEventListener('change', () => {
            const parsed = parseInt(yearInput.value, 10);
            if (!isNaN(parsed)) {
                sel.setYear(parsed);
                commit();
            } else {
                yearInput.value = String(sel.state.year);
            }
        });

        const nextBtn = btn('ottadate-nav-btn', '', () => {
            if (config.disabled) return;
            sel.stepYear(1);
            commit();
        });
        nextBtn.innerHTML = iconChevronRight();
        nextBtn.setAttribute('aria-label', 'Next year');

        stepper.append(prevBtn, yearInput, nextBtn);
        section.appendChild(stepper);
        return section;
    }

    /** Hint text for an optional, toggleable level */
    function levelHint(isSet: boolean, required: boolean): string | undefined {
        if (required) return undefined;
        return isSet ? 'tap again to clear' : 'if you remember';
    }

    function renderMonthSection(): HTMLElement {
        const required = sel.base !== 'year';
        const section = div('ottadate-fuzzy-section');
        section.appendChild(labelRow('Month', levelHint(sel.state.monthSet, required)));

        const grid = div('ottadate-months');
        const months = getMonthNamesShort(getIntlLocale(config.locale));

        months.forEach((name, idx) => {
            const monthBtn = btn('ottadate-month-cell', name, () => {
                if (config.disabled) return;
                sel.toggleMonth(idx);
                commit();
            });
            if (sel.state.monthSet && idx === sel.state.month) {
                monthBtn.classList.add('ottadate-month-cell--selected');
            }
            grid.appendChild(monthBtn);
        });

        section.appendChild(grid);
        return section;
    }

    function renderDaySection(): HTMLElement {
        const required = sel.base !== 'year' && sel.base !== 'month';
        const section = div('ottadate-fuzzy-section');
        section.appendChild(labelRow('Day', levelHint(sel.state.daySet, required)));

        const grid = div('ottadate-days ottadate-days--fuzzy');
        const daysInMonth = sel.daysInMonth();

        for (let d = 1; d <= daysInMonth; d++) {
            const dayBtn = btn('ottadate-day', d.toString(), () => {
                if (config.disabled) return;
                sel.toggleDay(d);
                commit();
            });
            if (sel.state.daySet && d === sel.state.day) {
                dayBtn.classList.add('ottadate-day--selected');
            }
            grid.appendChild(dayBtn);
        }

        section.appendChild(grid);
        return section;
    }

    /**
     * Cascading time inputs: blank = "don't remember". Filling the hour derives
     * resolution 'hour', the minute 'minute', the second 'second'. Each finer
     * input stays disabled until its coarser neighbour is filled.
     */
    function timeInput(
        value: number | null,
        enabled: boolean,
        ariaLabel: string,
        onCommit: (value: number | null) => void,
    ): HTMLInputElement {
        const input = el('input', {
            className: 'ottadate-time-input',
            type: 'number',
            placeholder: '––',
            'aria-label': ariaLabel,
        }) as HTMLInputElement;
        input.value = value != null ? pad2(value) : '';
        input.disabled = config.disabled || !enabled;
        input.addEventListener('change', () => {
            const raw = input.value.trim();
            if (raw === '') {
                onCommit(null);
            } else {
                const parsed = parseInt(raw, 10);
                onCommit(isNaN(parsed) ? null : parsed);
            }
            commit();
        });
        return input;
    }

    function renderTimeSection(): HTMLElement {
        const section = div('ottadate-fuzzy-section');
        section.appendChild(labelRow('Time', sel.state.hour == null ? 'if you remember' : 'blank = not sure'));

        const row = div('ottadate-fuzzy-time');
        row.appendChild(timeInput(sel.state.hour, true, 'Hour', (v) => sel.setHour(v)));

        if (sel.levelAllowed('minute')) {
            row.appendChild(span('ottadate-time-separator', ':'));
            row.appendChild(timeInput(sel.state.minute, sel.state.hour != null, 'Minute', (v) => sel.setMinute(v)));
        }
        if (sel.levelAllowed('second')) {
            row.appendChild(span('ottadate-time-separator', ':'));
            row.appendChild(timeInput(sel.state.second, sel.state.minute != null, 'Second', (v) => sel.setSecond(v)));
        }

        section.appendChild(row);
        return section;
    }

    function renderFooter(): HTMLElement {
        const footer = div('ottadate-footer');

        const group = div('ottadate-footer-group');
        group.appendChild(
            btn('ottadate-footer-btn', 'Today', () => {
                if (config.disabled) return;
                sel.setToday();
                commit();
            }),
        );
        group.appendChild(
            btn('ottadate-footer-btn', 'Clear', () => {
                if (config.disabled) return;
                sel.clear();
                commit();
            }),
        );
        footer.appendChild(group);

        if (!config.inline) {
            footer.appendChild(btn('ottadate-footer-btn ottadate-footer-btn--primary', 'Done', () => closePicker()));
        }

        return footer;
    }

    function render() {
        clearChildren(popover);

        const fuzzyContainer = div('ottadate-fuzzy');

        fuzzyContainer.appendChild(renderHeadline());
        fuzzyContainer.appendChild(renderApproxSegment());
        fuzzyContainer.appendChild(el('div', { className: 'ottadate-fuzzy-divider' }));

        // Progressive drill-down: each level appears only when the previous is filled
        fuzzyContainer.appendChild(renderYearSection());
        if (sel.levelAllowed('month')) {
            fuzzyContainer.appendChild(renderMonthSection());
        }
        if (sel.levelAllowed('day') && sel.state.monthSet) {
            fuzzyContainer.appendChild(renderDaySection());
        }
        if (sel.levelAllowed('hour') && sel.state.daySet) {
            fuzzyContainer.appendChild(renderTimeSection());
        }

        popover.appendChild(fuzzyContainer);
        popover.appendChild(renderFooter());
    }

    function openPicker() {
        if (isOpen || config.disabled) return;
        isOpen = true;
        popover.style.display = '';
        trigger.setAttribute('aria-expanded', 'true');
        render();

        removeClickOutside = onClickOutside(root, closePicker);
        removeEscapeHandler = onEscape(closePicker);
    }

    function closePicker() {
        if (!isOpen || config.inline) return;
        isOpen = false;
        popover.style.display = 'none';
        trigger.setAttribute('aria-expanded', 'false');
        removeClickOutside?.();
        removeEscapeHandler?.();
        removeClickOutside = null;
        removeEscapeHandler = null;
    }

    // --- Events ---

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isOpen) closePicker();
        else openPicker();
    });

    triggerClear.addEventListener('click', (e) => {
        e.stopPropagation();
        sel.clear();
        currentFuzzy = null;
        updateTriggerText();
        emitChange();
        if (isOpen) render();
    });

    // --- Initial render ---

    updateTriggerText();
    if (config.inline) render();

    // --- Value plumbing ---

    function applyValue(value: FuzzyDateTime | null) {
        if (value) {
            sel.load(value);
            currentFuzzy = value;
        } else {
            sel.clear();
            currentFuzzy = null;
        }
        updateTriggerText();
        if (isOpen) render();
    }

    // --- Public API ---

    return {
        open: openPicker,
        close: closePicker,
        toggle() {
            if (isOpen) closePicker();
            else openPicker();
        },
        setValue: applyValue,
        getValue() {
            return currentFuzzy;
        },
        setOptions(newOptions) {
            config = resolveConfig({ ...config, ...newOptions });
            // Constraint changes need a fresh selection controller
            if (newOptions.resolutions !== undefined || newOptions.approximations !== undefined) {
                sel = createFuzzySelection({
                    resolutions: config.resolutions,
                    approximations: config.approximations,
                    value: currentFuzzy,
                });
            }
            if (newOptions.value !== undefined) {
                applyValue(newOptions.value);
            } else {
                updateTriggerText();
                if (isOpen) render();
            }
        },
        destroy() {
            closePicker();
            root.remove();
        },
        isOpen: () => isOpen,
        element: root,
    };
}
