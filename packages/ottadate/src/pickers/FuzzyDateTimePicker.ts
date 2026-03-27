/**
 * @ottabase/ottadate — FuzzyDateTimePicker
 *
 * Framework-agnostic picker for approximate/fuzzy dates.
 * Users choose a resolution level (year, month, day, hour, minute, second)
 * and an approximation (exact, around, sometime). The result is a FuzzyDateTime
 * object with a human-readable label.
 *
 * Example output:
 *   { timestamp: 1588291200, resolution: 'month', approximation: 'sometime', label: 'Sometime in May 2020' }
 *
 * Usage:
 *   const picker = OttaDate.createFuzzyDateTimePicker(container, {
 *       onChange: (fuzzy) => console.log(fuzzy),
 *   });
 */

import {
    APPROXIMATION_LABELS,
    createFuzzyDateTime,
    getResolutionDescription,
    isResolutionFinerOrEqual,
    parseFuzzyDateTime,
    RESOLUTION_LABELS,
    RESOLUTION_ORDER,
} from '../core/fuzzy';
import type {
    DateApproximation,
    DateResolution,
    FuzzyDateTime,
    FuzzyDateTimePickerInstance,
    FuzzyDateTimePickerOptions,
} from '../core/types';
import { getIntlLocale, getMonthNamesShort, getYearRange, pad2, resolveConfig } from '../core/utils';
import { btn, clearChildren, div, el, iconCalendar, iconX, onClickOutside, onEscape, span } from '../dom/helpers';

export function createFuzzyDateTimePicker(
    container: HTMLElement,
    options: FuzzyDateTimePickerOptions = {},
): FuzzyDateTimePickerInstance {
    let config = resolveConfig({
        placeholder: 'Select approximate date…',
        resolutions: [...RESOLUTION_ORDER],
        approximations: ['exact', 'around', 'sometime'] as DateApproximation[],
        ...options,
    });

    // State
    let resolution: DateResolution = 'month';
    let approximation: DateApproximation = 'sometime';
    let selectedYear = new Date().getFullYear();
    let selectedMonth = 0; // 0-indexed
    let selectedDay = 1;
    let selectedHour = 12;
    let selectedMinute = 0;
    let selectedSecond = 0;
    let currentFuzzy: FuzzyDateTime | null = null;

    // Initialize from existing value
    if (config.value) {
        const parsed = parseFuzzyDateTime(config.value);
        resolution = parsed.resolution;
        approximation = parsed.approximation;
        selectedYear = parsed.date.getUTCFullYear();
        selectedMonth = parsed.date.getUTCMonth();
        selectedDay = parsed.date.getUTCDate();
        selectedHour = parsed.date.getUTCHours();
        selectedMinute = parsed.date.getUTCMinutes();
        selectedSecond = parsed.date.getUTCSeconds();
        currentFuzzy = config.value;
    }

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
    popover.style.minWidth = '20rem';
    if (config.inline) isOpen = true;
    root.appendChild(popover);

    // --- Helpers ---

    /** Build a Date from the current selection state */
    function buildDate(): Date {
        return new Date(
            Date.UTC(selectedYear, selectedMonth, selectedDay, selectedHour, selectedMinute, selectedSecond),
        );
    }

    /** Build the current FuzzyDateTime from state */
    function buildFuzzy(): FuzzyDateTime {
        return createFuzzyDateTime(buildDate(), resolution, approximation);
    }

    /** Check if a given resolution is enabled */
    function isResEnabled(res: DateResolution): boolean {
        return (config.resolutions ?? RESOLUTION_ORDER).includes(res);
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

    function renderApproximationSection(): HTMLElement {
        const section = div('ottadate-fuzzy-section');
        section.appendChild(span('ottadate-fuzzy-label', 'How precise?'));

        const chips = div('ottadate-fuzzy-chips');
        for (const approx of config.approximations ?? (['exact', 'around', 'sometime'] as DateApproximation[])) {
            const chip = btn('ottadate-chip', APPROXIMATION_LABELS[approx], () => {
                if (config.disabled) return;
                approximation = approx;
                updateAndRender();
            });
            if (approx === approximation) {
                chip.classList.add('ottadate-chip--active');
            }
            chips.appendChild(chip);
        }
        section.appendChild(chips);
        return section;
    }

    function renderResolutionSection(): HTMLElement {
        const section = div('ottadate-fuzzy-section');
        section.appendChild(span('ottadate-fuzzy-label', 'I remember up to…'));

        const chips = div('ottadate-fuzzy-chips');
        for (const res of RESOLUTION_ORDER) {
            if (!isResEnabled(res)) continue;

            const chip = btn('ottadate-chip', RESOLUTION_LABELS[res], () => {
                if (config.disabled) return;
                resolution = res;
                updateAndRender();
            });
            if (res === resolution) {
                chip.classList.add('ottadate-chip--active');
            }
            chips.appendChild(chip);
        }
        section.appendChild(chips);

        // Description
        const desc = span('', getResolutionDescription(resolution));
        desc.style.fontSize = 'var(--od-font-size-sm)';
        desc.style.color = 'var(--od-muted-fg)';
        desc.style.marginTop = '0.25rem';
        section.appendChild(desc);

        return section;
    }

    function renderYearSelector(): HTMLElement {
        const section = div('ottadate-fuzzy-section');
        section.appendChild(span('ottadate-fuzzy-label', 'Year'));

        const grid = div('ottadate-years');
        const years = getYearRange(selectedYear, 5);

        for (const year of years) {
            const yearBtn = btn('ottadate-year-cell', year.toString(), () => {
                if (config.disabled) return;
                selectedYear = year;
                updateAndRender();
            });
            if (year === selectedYear) {
                yearBtn.classList.add('ottadate-year-cell--selected');
            }
            if (year === new Date().getFullYear()) {
                yearBtn.classList.add('ottadate-year-cell--current');
            }
            grid.appendChild(yearBtn);
        }
        section.appendChild(grid);
        return section;
    }

    function renderMonthSelector(): HTMLElement {
        const section = div('ottadate-fuzzy-section');
        section.appendChild(span('ottadate-fuzzy-label', 'Month'));

        const grid = div('ottadate-months');
        const localeStr = getIntlLocale(config.locale);
        const months = getMonthNamesShort(localeStr);

        months.forEach((name, idx) => {
            const monthBtn = btn('ottadate-month-cell', name, () => {
                if (config.disabled) return;
                selectedMonth = idx;
                updateAndRender();
            });
            if (idx === selectedMonth) {
                monthBtn.classList.add('ottadate-month-cell--selected');
            }
            grid.appendChild(monthBtn);
        });

        section.appendChild(grid);
        return section;
    }

    function renderDaySelector(): HTMLElement {
        const section = div('ottadate-fuzzy-section');
        section.appendChild(span('ottadate-fuzzy-label', 'Day'));

        // Simple number grid (1-31, capped to month's actual days)
        const grid = div('ottadate-days ottadate-days--fuzzy');
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
            const dayBtn = btn('ottadate-day', d.toString(), () => {
                if (config.disabled) return;
                selectedDay = d;
                updateAndRender();
            });
            if (d === selectedDay) {
                dayBtn.classList.add('ottadate-day--selected');
            }
            grid.appendChild(dayBtn);
        }

        section.appendChild(grid);
        return section;
    }

    function renderTimeSelector(): HTMLElement {
        const section = div('ottadate-fuzzy-section');
        section.appendChild(span('ottadate-fuzzy-label', 'Time'));

        const timeRow = div('ottadate-time');
        timeRow.style.borderTop = 'none';
        timeRow.style.paddingTop = '0';
        timeRow.style.marginTop = '0';

        const scrollContainer = div('ottadate-time-scroll');

        // Hour
        if (isResolutionFinerOrEqual(resolution, 'hour')) {
            const hourInput = el('input', {
                className: 'ottadate-time-input',
                type: 'number',
            }) as HTMLInputElement;
            hourInput.min = '0';
            hourInput.max = '23';
            hourInput.value = pad2(selectedHour);
            if (config.disabled) hourInput.disabled = true;
            hourInput.addEventListener('change', () => {
                selectedHour = Math.max(0, Math.min(23, parseInt(hourInput.value, 10) || 0));
                hourInput.value = pad2(selectedHour);
                updateAndRender();
            });
            scrollContainer.appendChild(hourInput);
        }

        // Minute
        if (isResolutionFinerOrEqual(resolution, 'minute')) {
            scrollContainer.appendChild(span('ottadate-time-separator', ':'));
            const minInput = el('input', {
                className: 'ottadate-time-input',
                type: 'number',
            }) as HTMLInputElement;
            minInput.min = '0';
            minInput.max = '59';
            minInput.value = pad2(selectedMinute);
            if (config.disabled) minInput.disabled = true;
            minInput.addEventListener('change', () => {
                selectedMinute = Math.max(0, Math.min(59, parseInt(minInput.value, 10) || 0));
                minInput.value = pad2(selectedMinute);
                updateAndRender();
            });
            scrollContainer.appendChild(minInput);
        }

        // Second
        if (isResolutionFinerOrEqual(resolution, 'second')) {
            scrollContainer.appendChild(span('ottadate-time-separator', ':'));
            const secInput = el('input', {
                className: 'ottadate-time-input',
                type: 'number',
            }) as HTMLInputElement;
            secInput.min = '0';
            secInput.max = '59';
            secInput.value = pad2(selectedSecond);
            if (config.disabled) secInput.disabled = true;
            secInput.addEventListener('change', () => {
                selectedSecond = Math.max(0, Math.min(59, parseInt(secInput.value, 10) || 0));
                secInput.value = pad2(selectedSecond);
                updateAndRender();
            });
            scrollContainer.appendChild(secInput);
        }

        timeRow.appendChild(scrollContainer);
        section.appendChild(timeRow);
        return section;
    }

    function renderPreview(): HTMLElement {
        const fuzzy = buildFuzzy();
        const preview = div('ottadate-fuzzy-preview', `"${fuzzy.label}"`);
        return preview;
    }

    function renderFooter(): HTMLElement {
        const footer = div('ottadate-footer');

        const applyBtn = btn('ottadate-footer-btn ottadate-footer-btn--primary', 'Apply', () => {
            if (config.disabled) return;
            currentFuzzy = buildFuzzy();
            updateTriggerText();
            emitChange();
            if (!config.inline) closePicker();
        });

        const clearBtn = btn('ottadate-footer-btn', 'Clear', () => {
            if (config.disabled) return;
            currentFuzzy = null;
            updateTriggerText();
            emitChange();
            render();
        });

        footer.append(applyBtn, clearBtn);
        return footer;
    }

    function render() {
        clearChildren(popover);

        const fuzzyContainer = div('ottadate-fuzzy');

        // 1. Approximation chips
        fuzzyContainer.appendChild(renderApproximationSection());

        // 2. Resolution chips
        fuzzyContainer.appendChild(renderResolutionSection());

        fuzzyContainer.appendChild(el('div', { className: 'ottadate-fuzzy-divider' }));

        // 3. Year selector (always shown)
        fuzzyContainer.appendChild(renderYearSelector());

        // 4. Month selector (if resolution >= month)
        if (isResolutionFinerOrEqual(resolution, 'month')) {
            fuzzyContainer.appendChild(renderMonthSelector());
        }

        // 5. Day selector (if resolution >= day)
        if (isResolutionFinerOrEqual(resolution, 'day')) {
            fuzzyContainer.appendChild(renderDaySelector());
        }

        // 6. Time selectors (if resolution >= hour)
        if (isResolutionFinerOrEqual(resolution, 'hour')) {
            fuzzyContainer.appendChild(renderTimeSelector());
        }

        fuzzyContainer.appendChild(el('div', { className: 'ottadate-fuzzy-divider' }));

        // 7. Preview
        fuzzyContainer.appendChild(renderPreview());

        popover.appendChild(fuzzyContainer);
        popover.appendChild(renderFooter());
    }

    function updateAndRender() {
        render();
    }

    // --- Actions ---

    function emitChange() {
        if (config.onChange) {
            config.onChange(currentFuzzy);
        }
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
        currentFuzzy = null;
        updateTriggerText();
        emitChange();
        if (isOpen) render();
    });

    // --- Initial render ---

    updateTriggerText();
    if (config.inline) render();

    // --- Public API ---

    return {
        open: openPicker,
        close: closePicker,
        toggle() {
            if (isOpen) closePicker();
            else openPicker();
        },
        setValue(value: FuzzyDateTime | null) {
            if (value) {
                const parsed = parseFuzzyDateTime(value);
                resolution = parsed.resolution;
                approximation = parsed.approximation;
                selectedYear = parsed.date.getUTCFullYear();
                selectedMonth = parsed.date.getUTCMonth();
                selectedDay = parsed.date.getUTCDate();
                selectedHour = parsed.date.getUTCHours();
                selectedMinute = parsed.date.getUTCMinutes();
                selectedSecond = parsed.date.getUTCSeconds();
                currentFuzzy = value;
            } else {
                currentFuzzy = null;
            }
            updateTriggerText();
            if (isOpen) render();
        },
        getValue() {
            return currentFuzzy;
        },
        setOptions(newOptions) {
            config = resolveConfig({ ...config, ...newOptions });
            if (newOptions.value !== undefined) {
                if (newOptions.value) {
                    const parsed = parseFuzzyDateTime(newOptions.value);
                    resolution = parsed.resolution;
                    approximation = parsed.approximation;
                    selectedYear = parsed.date.getUTCFullYear();
                    selectedMonth = parsed.date.getUTCMonth();
                    selectedDay = parsed.date.getUTCDate();
                    selectedHour = parsed.date.getUTCHours();
                    selectedMinute = parsed.date.getUTCMinutes();
                    selectedSecond = parsed.date.getUTCSeconds();
                    currentFuzzy = newOptions.value;
                } else {
                    currentFuzzy = null;
                }
            }
            updateTriggerText();
            if (isOpen) render();
        },
        destroy() {
            closePicker();
            root.remove();
        },
        isOpen: () => isOpen,
        element: root,
    };
}
