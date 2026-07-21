/**
 * @ottabase/ottadate — FuzzyDateTimePicker
 *
 * Picker for dates the user only partially remembers. Every section asks the
 * same recursive question — "when in X?" — answerable at three fidelities:
 * name the sub-unit (drill deeper), pick a PART chip (a coarse terminal
 * answer like "early" / "summer" / "night"), or stop. The resolution is
 * DERIVED from how deep the user went (see core/fuzzy-selection.ts).
 *
 * Layout (decade mode shown; default mode starts at the year stepper):
 *   Early 1990s                        ← live sentence headline   [~ Roughly]
 *   DECADE  ‹  1990s  ›
 *   WHEN IN THE 1990S? · if you remember
 *   [Early][Mid][Late]                 ← decade parts (terminal)
 *   [1990][1991]…[1999]                ← or name the year (drills deeper)
 *   WHEN IN 1996?
 *   [Early][Mid][Late][Spring][Summer][Autumn][Winter]
 *   [Jan][Feb]…[Dec]
 *   WHEN IN MAY? … WHEN ON MAY 21? …   ← same pattern all the way down
 *   [Today] [Clear]          [Done]    ← every change auto-applies
 *
 * Usage:
 *   const picker = OttaDate.createFuzzyDateTimePicker(container, {
 *       onChange: (fuzzy) => console.log(fuzzy),
 *       resolutions: ['decade', 'year', 'month', 'day'], // decade is opt-in
 *   });
 */

import { PART_LABELS, resolutionIndex } from '../core/fuzzy';
import { createFuzzySelection, type FuzzySelection } from '../core/fuzzy-selection';
import { parseFuzzyInput } from '../core/parse';
import type { FuzzyDateTime, FuzzyDateTimePickerInstance, FuzzyDateTimePickerOptions } from '../core/types';
import { getIntlLocale, getMonthNames, getMonthNamesShort, pad2, resolveConfig } from '../core/utils';
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

    function buildSelection(value: FuzzyDateTime | null): FuzzySelection {
        return createFuzzySelection({
            resolutions: config.resolutions,
            parts: config.parts,
            hemisphere: config.hemisphere,
            formatLabel: config.formatLabel,
            value,
        });
    }

    let sel = buildSelection(config.value ?? null);
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

    /**
     * Type-to-parse field: "early 90s" / "summer 98" / "21 jul 2010" parses
     * straight into the selection. Strict — an unparseable or out-of-bounds
     * entry gets a red ring instead of a silent guess.
     */
    function renderQuickEntry(): HTMLElement {
        const entry = el('input', {
            className: 'ottadate-fuzzy-entry',
            type: 'text',
            placeholder: 'Type it: early 90s · summer 98 · 21 jul 2010',
            'aria-label': 'Type an approximate date',
        }) as HTMLInputElement;
        if (config.disabled) entry.disabled = true;

        const tryParse = () => {
            const raw = entry.value.trim();
            if (!raw) return;
            const parsed = parseFuzzyInput(raw, {
                hemisphere: config.hemisphere,
                formatLabel: config.formatLabel,
            });
            // Reject values coarser than this field's baseline (e.g. a decade
            // typed into a year-based picker) — loading would silently degrade.
            if (!parsed || resolutionIndex(parsed.resolution) < resolutionIndex(sel.base)) {
                entry.classList.add('ottadate-fuzzy-entry--invalid');
                return;
            }
            sel.load(parsed);
            commit();
        };

        entry.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                tryParse();
            }
        });
        entry.addEventListener('change', tryParse);
        entry.addEventListener('input', () => entry.classList.remove('ottadate-fuzzy-entry--invalid'));

        return entry;
    }

    /** Headline row: the live sentence + the "~ Roughly" toggle */
    function renderHeadlineRow(): HTMLElement {
        const row = div('ottadate-fuzzy-headline-row');

        const headline = div('ottadate-fuzzy-headline');
        const preview = sel.build();
        if (preview) {
            headline.textContent = preview.label;
        } else {
            headline.textContent = 'Pick what you remember…';
            headline.classList.add('ottadate-fuzzy-headline--empty');
        }
        row.appendChild(headline);

        if (config.allowApproximate !== false) {
            const toggle = btn('ottadate-fuzzy-approx-toggle', '~ Roughly', () => {
                if (config.disabled) return;
                sel.toggleApproximate();
                commit();
            });
            toggle.title = 'The boundary is soft — widens the stored range';
            if (sel.state.approximate) toggle.classList.add('ottadate-fuzzy-approx-toggle--active');
            row.appendChild(toggle);
        }

        return row;
    }

    /** Part chips — the coarse terminal answers to "when in X?" */
    function renderPartsRow(): HTMLElement | null {
        const parts = sel.partOptions();
        if (!parts.length) return null;

        const rowEl = div('ottadate-fuzzy-parts');
        for (const part of parts) {
            const chip = btn('ottadate-part-chip', PART_LABELS[part], () => {
                if (config.disabled) return;
                sel.togglePart(part);
                commit();
            });
            if (sel.state.part === part) chip.classList.add('ottadate-part-chip--active');
            rowEl.appendChild(chip);
        }
        return rowEl;
    }

    /** Hint text for an optional, toggleable level */
    function levelHint(isSet: boolean, required: boolean): string | undefined {
        if (required) return undefined;
        return isSet ? 'tap again to clear' : 'if you remember';
    }

    /** Decade stepper — only rendered when 'decade' is the base level */
    function renderDecadeSection(): HTMLElement {
        const section = div('ottadate-fuzzy-section');
        section.appendChild(labelRow('Decade'));

        const stepper = div('ottadate-fuzzy-year-stepper');

        const prevBtn = btn('ottadate-nav-btn', '', () => {
            if (config.disabled) return;
            sel.stepDecade(-1);
            commit();
        });
        prevBtn.innerHTML = iconChevronLeft();
        prevBtn.setAttribute('aria-label', 'Previous decade');

        const value = span('ottadate-fuzzy-stepper-value', `${sel.decadeStart()}s`);

        const nextBtn = btn('ottadate-nav-btn', '', () => {
            if (config.disabled) return;
            sel.stepDecade(1);
            commit();
        });
        nextBtn.innerHTML = iconChevronRight();
        nextBtn.setAttribute('aria-label', 'Next decade');

        stepper.append(prevBtn, value, nextBtn);
        section.appendChild(stepper);
        return section;
    }

    /** "When in the 1990s?" — decade parts + a 10-year grid (decade mode) */
    function renderYearGridSection(): HTMLElement {
        const section = div('ottadate-fuzzy-section');
        section.appendChild(labelRow(`When in the ${sel.decadeStart()}s?`, levelHint(sel.state.yearSet, false)));

        if (!sel.state.yearSet) {
            const parts = renderPartsRow();
            if (parts) section.appendChild(parts);
        }

        const grid = div('ottadate-months');
        const start = sel.decadeStart();
        for (let y = start; y < start + 10; y++) {
            const yearBtn = btn('ottadate-month-cell', String(y), () => {
                if (config.disabled) return;
                sel.toggleYear(y);
                commit();
            });
            if (sel.state.yearSet && y === sel.state.year) {
                yearBtn.classList.add('ottadate-month-cell--selected');
            }
            grid.appendChild(yearBtn);
        }
        section.appendChild(grid);
        return section;
    }

    /** Year stepper with a directly editable value — type "1994" instead of clicking 30 times */
    function renderYearStepperSection(): HTMLElement {
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

    /** "When in 1996?" — year parts (incl. seasons) + the month grid */
    function renderMonthSection(): HTMLElement {
        const required = sel.base !== 'decade' && sel.base !== 'year';
        const section = div('ottadate-fuzzy-section');
        section.appendChild(labelRow(`When in ${sel.state.year}?`, levelHint(sel.state.monthSet, required)));

        if (!sel.state.monthSet) {
            const parts = renderPartsRow();
            if (parts) section.appendChild(parts);
        }

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

    /** "When in May?" — month parts + the day grid */
    function renderDaySection(): HTMLElement {
        const required = sel.base !== 'decade' && sel.base !== 'year' && sel.base !== 'month';
        const monthName = getMonthNames(getIntlLocale(config.locale))[sel.state.month];
        const section = div('ottadate-fuzzy-section');
        section.appendChild(labelRow(`When in ${monthName}?`, levelHint(sel.state.daySet, required)));

        if (!sel.state.daySet) {
            const parts = renderPartsRow();
            if (parts) section.appendChild(parts);
        }

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

    /** Cascading time input: blank = "don't remember" */
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

    /** "When on May 21?" — day parts (morning/night) + the hh:mm:ss cascade */
    function renderTimeSection(): HTMLElement {
        const monthName = getMonthNames(getIntlLocale(config.locale))[sel.state.month];
        const section = div('ottadate-fuzzy-section');
        section.appendChild(
            labelRow(
                `When on ${monthName} ${sel.state.day}?`,
                sel.state.hour == null ? 'if you remember' : 'blank = not sure',
            ),
        );

        if (sel.state.hour == null) {
            const parts = renderPartsRow();
            if (parts) section.appendChild(parts);
        }

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

        if (config.quickEntry !== false) {
            fuzzyContainer.appendChild(renderQuickEntry());
        }
        fuzzyContainer.appendChild(renderHeadlineRow());
        fuzzyContainer.appendChild(el('div', { className: 'ottadate-fuzzy-divider' }));

        // Progressive drill-down: each level appears only when the previous is
        // named; a part is terminal, so deeper sections never open past it.
        if (sel.base === 'decade') {
            fuzzyContainer.appendChild(renderDecadeSection());
            if (sel.levelAllowed('year')) {
                fuzzyContainer.appendChild(renderYearGridSection());
            }
        } else {
            fuzzyContainer.appendChild(renderYearStepperSection());
        }
        if (sel.levelAllowed('month') && sel.state.yearSet) {
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
            if (
                newOptions.resolutions !== undefined ||
                newOptions.parts !== undefined ||
                newOptions.hemisphere !== undefined ||
                newOptions.formatLabel !== undefined
            ) {
                sel = buildSelection(currentFuzzy);
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
