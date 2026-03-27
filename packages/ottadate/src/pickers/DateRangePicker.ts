/**
 * @ottabase/ottadate — DateRangePicker
 *
 * Framework-agnostic date range picker. Two-calendar layout for start/end selection.
 * Optionally supports a preset sidebar with Apply/Cancel flow (see `presets` option).
 *
 * Getter/setter works with UTC unix timestamps by default.
 *
 * Usage:
 *   // Basic (auto-apply on selection)
 *   const picker = OttaDate.createDateRangePicker(container, {
 *       value: { start: 1704067200, end: 1704672000 },
 *       onChange: (range) => console.log(range),
 *   });
 *
 *   // With presets sidebar + Apply/Cancel
 *   import { getDefaultRangePresets } from '@ottabase/ottadate';
 *   const picker = OttaDate.createDateRangePicker(container, {
 *       presets: getDefaultRangePresets(),
 *       onChange: (range) => console.log(range),
 *   });
 */

import { toZonedTime } from 'date-fns-tz';
import type { DateRange, DateRangePickerInstance, DateRangePickerOptions } from '../core/types';
import {
    buildCalendarGrid,
    formatDisplay,
    fromDate,
    getIntlLocale,
    getMonthNames,
    getWeekdayLabels,
    isAfter,
    isBefore,
    isDateInBounds,
    isSameDay,
    isSameMonth,
    resolveConfig,
    resolveTimezone,
    toDate,
} from '../core/utils';
// Note: getMonthNames used in both preset-mode sidebar and classic arrow-nav title
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

export function createDateRangePicker(
    container: HTMLElement,
    options: DateRangePickerOptions = {},
): DateRangePickerInstance {
    let config = resolveConfig({
        placeholder: 'Select range…',
        startPlaceholder: 'Start date',
        endPlaceholder: 'End date',
        allowSameDay: true,
        ...options,
    });

    const tz = resolveTimezone(config.timezone!);
    const hasPresets = Boolean(config.presets && config.presets.length > 0);

    // --- State ---

    let startDate: Date | null = config.value?.start ? toDate(config.value.start, tz) : null;
    let endDate: Date | null = config.value?.end ? toDate(config.value.end, tz) : null;

    // Committed state — what was emitted last (used for Cancel in preset mode)
    let committedStart: Date | null = startDate ? new Date(startDate) : null;
    let committedEnd: Date | null = endDate ? new Date(endDate) : null;

    // Track which part is being selected: 'start' or 'end'
    let selectingEnd = false;
    let hoverDate: Date | null = null;

    // Preset sidebar state: -1 = Custom, 0+ = preset index
    let activePresetIdx = -1;

    let leftViewDate = startDate ? new Date(startDate) : tz ? toZonedTime(new Date(), tz) : new Date();
    let rightViewDate = new Date(leftViewDate.getFullYear(), leftViewDate.getMonth() + 1, 1);

    let isOpen = false;
    let removeClickOutside: (() => void) | null = null;
    let removeEscapeHandler: (() => void) | null = null;

    const minDate = config.minDate ? toDate(config.minDate as any, tz) : null;
    const maxDate = config.maxDate ? toDate(config.maxDate as any, tz) : null;

    // Root wrapper
    const root = div('ottadate');
    if (config.inline) root.classList.add('ottadate--inline');
    container.appendChild(root);

    // Trigger button
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
        'aria-label': 'Clear range',
    }) as HTMLButtonElement;
    triggerClear.innerHTML = iconX();
    triggerClear.style.display = 'none';

    trigger.append(triggerIcon, triggerText, triggerClear);
    if (!config.inline) root.appendChild(trigger);

    // Popover — wider when presets are shown
    const popover = div('ottadate-popover');
    if (hasPresets) popover.classList.add('ottadate-popover--wide');
    popover.style.display = config.inline ? '' : 'none';
    if (config.inline) isOpen = true;
    root.appendChild(popover);

    // -----------------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------------

    function updateTriggerText() {
        const localeStr = getIntlLocale(config.locale);
        if (startDate && endDate) {
            const startStr = formatDisplay(startDate, config.displayFormat!, config.locale);
            const endStr = formatDisplay(endDate, config.displayFormat!, config.locale);
            triggerText.textContent = `${startStr}  →  ${endStr}`;
            triggerText.classList.remove('ottadate-trigger-placeholder');
            triggerClear.style.display = '';
        } else if (startDate) {
            triggerText.textContent = `${formatDisplay(startDate, config.displayFormat!, config.locale)}  →  …`;
            triggerText.classList.remove('ottadate-trigger-placeholder');
            triggerClear.style.display = '';
        } else {
            triggerText.textContent = config.placeholder!;
            triggerText.classList.add('ottadate-trigger-placeholder');
            triggerClear.style.display = 'none';
        }
    }

    /** Render a single month calendar — same arrow-nav header for all modes */
    function renderCalendar(viewDate: Date, isLeft: boolean): HTMLElement {
        const cal = div('');

        // ← Month Year → nav header (shared between preset and classic modes)
        const header = div('ottadate-header');
        const prevBtn = btn('ottadate-nav-btn', '', () => {
            if (isLeft) {
                leftViewDate = new Date(leftViewDate.getFullYear(), leftViewDate.getMonth() - 1, 1);
                if (rightViewDate <= leftViewDate) {
                    rightViewDate = new Date(leftViewDate.getFullYear(), leftViewDate.getMonth() + 1, 1);
                }
            } else {
                rightViewDate = new Date(rightViewDate.getFullYear(), rightViewDate.getMonth() - 1, 1);
                if (rightViewDate <= leftViewDate) {
                    leftViewDate = new Date(rightViewDate.getFullYear(), rightViewDate.getMonth() - 1, 1);
                }
            }
            render();
        });
        prevBtn.innerHTML = iconChevronLeft();

        const localeStr = getIntlLocale(config.locale);
        const titleBtn = btn(
            'ottadate-header-title',
            `${getMonthNames(localeStr)[viewDate.getMonth()]} ${viewDate.getFullYear()}`,
            () => {},
        );
        titleBtn.style.cursor = 'default';

        const nextBtn = btn('ottadate-nav-btn', '', () => {
            if (isLeft) {
                leftViewDate = new Date(leftViewDate.getFullYear(), leftViewDate.getMonth() + 1, 1);
                if (rightViewDate <= leftViewDate) {
                    rightViewDate = new Date(leftViewDate.getFullYear(), leftViewDate.getMonth() + 1, 1);
                }
            } else {
                rightViewDate = new Date(rightViewDate.getFullYear(), rightViewDate.getMonth() + 1, 1);
            }
            render();
        });
        nextBtn.innerHTML = iconChevronRight();

        header.append(prevBtn, titleBtn, nextBtn);
        cal.appendChild(header);

        // Weekday labels
        const weekdaysRow = div('ottadate-weekdays');
        for (const label of getWeekdayLabels(config.firstDayOfWeek, localeStr)) {
            weekdaysRow.appendChild(span('ottadate-weekday', label));
        }
        cal.appendChild(weekdaysRow);

        // Day grid
        const daysGrid = div('ottadate-days');
        const days = buildCalendarGrid(viewDate.getFullYear(), viewDate.getMonth(), config.firstDayOfWeek);
        const today = tz ? toZonedTime(new Date(), tz) : new Date();

        for (const day of days) {
            const dayBtn = btn('ottadate-day', day.getDate().toString(), () => {
                handleDayClick(day);
            });
            dayBtn.dataset.time = day.getTime().toString();

            dayBtn.addEventListener('dblclick', () => {
                if (config.disabled) return;
                // Double click selects the single day as range and auto-applies
                if (hasPresets && activePresetIdx !== -1) {
                    activePresetIdx = -1;
                }
                startDate = day;
                endDate = day;
                selectingEnd = false;
                committedStart = new Date(day);
                committedEnd = new Date(day);
                updateTriggerText();
                updateRangeHighlights();
                emitChange();
                if (!config.inline) closePicker();
            });

            dayBtn.addEventListener('mouseenter', () => {
                if (selectingEnd && startDate) {
                    hoverDate = day;
                    updateRangeHighlights();
                }
            });

            if (!isSameMonth(day, viewDate)) {
                dayBtn.classList.add('ottadate-day--outside');
            }

            if (isSameDay(day, today)) {
                dayBtn.classList.add('ottadate-day--today');
            }

            if (!isDateInBounds(day, minDate, maxDate)) {
                dayBtn.classList.add('ottadate-day--disabled');
            }

            // Hover/range classes are strictly handled by updateRangeHighlights
            daysGrid.appendChild(dayBtn);
        }
        cal.appendChild(daysGrid);

        return cal;
    }

    // -----------------------------------------------------------------------
    // Preset mode — sidebar, top-bar actions, calendar with dropdowns
    // -----------------------------------------------------------------------

    /** Render the preset list sidebar */
    function renderPresetSidebar(): HTMLElement {
        const sidebar = div('ottadate-range-presets');

        // "Custom" is always first — with › icon to indicate custom calendar mode
        const customItem = btn(
            `ottadate-range-preset${activePresetIdx === -1 ? ' ottadate-range-preset--active' : ''}`,
            '',
            () => {
                activePresetIdx = -1;
                startDate = null;
                endDate = null;
                selectingEnd = false;
                hoverDate = null;
                render();
            },
        );
        // Use inner HTML so we can add the › icon
        const customText = span('ottadate-range-preset-label', 'Custom');
        const customIcon = span('ottadate-range-preset-icon', '›');
        customItem.append(customText, customIcon);
        sidebar.appendChild(customItem);

        // User-provided presets
        const presets = config.presets!;
        for (let i = 0; i < presets.length; i++) {
            const preset = presets[i];
            const isActive = activePresetIdx === i;
            const presetBtn = btn(
                `ottadate-range-preset${isActive ? ' ottadate-range-preset--active' : ''}`,
                preset.label,
                () => {
                    if (config.disabled) return;
                    activePresetIdx = i;
                    const { start, end } = preset.range();
                    startDate = start;
                    endDate = end;
                    selectingEnd = false;
                    hoverDate = null;

                    // Navigate calendars to show the start/end of the range
                    leftViewDate = new Date(start);
                    rightViewDate = new Date(end.getFullYear(), end.getMonth(), 1);
                    // If same month, shift right to next month
                    if (
                        leftViewDate.getFullYear() === rightViewDate.getFullYear() &&
                        leftViewDate.getMonth() === rightViewDate.getMonth()
                    ) {
                        rightViewDate = new Date(leftViewDate.getFullYear(), leftViewDate.getMonth() + 1, 1);
                    }

                    render();
                },
            );
            sidebar.appendChild(presetBtn);
        }

        return sidebar;
    }

    /** Render the bottom footer for preset mode — Cancel + Apply (right-aligned) */
    function renderPresetFooter(): HTMLElement {
        const footer = div('ottadate-range-footer');

        const cancelBtn = btn('ottadate-range-cancel-btn', 'Cancel', () => {
            // Revert to committed state
            startDate = committedStart ? new Date(committedStart) : null;
            endDate = committedEnd ? new Date(committedEnd) : null;
            selectingEnd = false;
            hoverDate = null;
            activePresetIdx = -1;

            if (!config.inline) {
                closePicker();
            } else {
                render();
            }
        });

        const applyBtn = btn('ottadate-range-apply-btn', 'Apply', () => {
            // Commit the current draft selection
            committedStart = startDate ? new Date(startDate) : null;
            committedEnd = endDate ? new Date(endDate) : null;
            updateTriggerText();
            emitChange();

            if (!config.inline) {
                closePicker();
            }
        });

        // Disable Apply when no complete range is selected
        if (!startDate || !endDate) {
            applyBtn.setAttribute('disabled', 'true');
            applyBtn.classList.add('ottadate-range-apply-btn--disabled');
        }

        footer.append(cancelBtn, applyBtn);
        return footer;
    }

    // -----------------------------------------------------------------------
    // Classic (non-preset) footer — Today / Clear
    // -----------------------------------------------------------------------

    function renderClassicFooter(): HTMLElement {
        const footer = div('ottadate-footer');

        const todayBtn = btn('ottadate-footer-btn ottadate-footer-btn--primary', 'Today', () => {
            if (config.disabled) return;
            const today = tz ? toZonedTime(new Date(), tz) : new Date();
            leftViewDate = new Date(today);
            rightViewDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            startDate = today;
            endDate = null;
            selectingEnd = true;
            hoverDate = null;
            updateTriggerText();
            render();
        });

        const clearBtn = btn('ottadate-footer-btn', 'Clear', () => {
            if (config.disabled) return;
            startDate = null;
            endDate = null;
            selectingEnd = false;
            hoverDate = null;
            updateTriggerText();
            emitChange();
            render();
        });

        footer.append(todayBtn, clearBtn);
        return footer;
    }

    // -----------------------------------------------------------------------
    // Main render
    // -----------------------------------------------------------------------

    function render() {
        clearChildren(popover);

        if (hasPresets) {
            // Preset mode: sidebar | calendars, footer at bottom
            const panel = div('ottadate-range-panel');

            // Left: preset sidebar
            panel.appendChild(renderPresetSidebar());

            // Right: two calendars side-by-side
            const calGrid = div('ottadate-range-calendars');
            calGrid.appendChild(renderCalendar(leftViewDate, true));
            calGrid.appendChild(renderCalendar(rightViewDate, false));
            panel.appendChild(calGrid);

            popover.appendChild(panel);

            // Bottom footer: Cancel + Apply
            popover.appendChild(renderPresetFooter());
        } else {
            // Classic mode: two calendars + Today/Clear
            const grid = div('');
            grid.style.display = 'flex';
            grid.style.gap = '1rem';

            grid.appendChild(renderCalendar(leftViewDate, true));
            grid.appendChild(renderCalendar(rightViewDate, false));

            popover.appendChild(grid);
            popover.appendChild(renderClassicFooter());
        }

        // Apply initial range highlights
        updateRangeHighlights();
    }

    function updateRangeHighlights() {
        const effectiveEnd = selectingEnd && hoverDate ? hoverDate : endDate;
        const rangeStart =
            startDate && effectiveEnd ? (isBefore(startDate, effectiveEnd) ? startDate : effectiveEnd) : startDate;
        const rangeEnd =
            startDate && effectiveEnd ? (isAfter(effectiveEnd, startDate) ? effectiveEnd : startDate) : effectiveEnd;

        const days = popover.querySelectorAll('.ottadate-day');
        days.forEach((btn) => {
            const time = Number((btn as HTMLElement).dataset.time);
            if (!time) return;
            const d = new Date(time);

            btn.classList.remove('ottadate-day--range-start', 'ottadate-day--range-end', 'ottadate-day--range-middle');

            if (rangeStart && isSameDay(d, rangeStart)) btn.classList.add('ottadate-day--range-start');
            if (rangeEnd && isSameDay(d, rangeEnd)) btn.classList.add('ottadate-day--range-end');

            if (
                rangeStart &&
                rangeEnd &&
                isAfter(d, rangeStart) &&
                isBefore(d, rangeEnd) &&
                !isSameDay(d, rangeStart) &&
                !isSameDay(d, rangeEnd)
            ) {
                btn.classList.add('ottadate-day--range-middle');
            }
        });
    }

    // -----------------------------------------------------------------------
    // Actions
    // -----------------------------------------------------------------------

    function handleDayClick(date: Date) {
        if (config.disabled) return;
        // In preset mode, clicking a day switches to "Custom"
        if (hasPresets && activePresetIdx !== -1) {
            activePresetIdx = -1;
        }

        if (!selectingEnd) {
            // First click: set start
            startDate = date;
            endDate = null;
            selectingEnd = true;
            hoverDate = null;
        } else {
            // Second click: set end
            if (startDate && isBefore(date, startDate)) {
                endDate = startDate;
                startDate = date;
            } else if (startDate && isSameDay(date, startDate) && !config.allowSameDay) {
                return;
            } else {
                endDate = date;
            }
            selectingEnd = false;
            hoverDate = null;

            if (!hasPresets) {
                // Classic mode: auto-apply and close
                updateTriggerText();
                emitChange();
                if (!config.inline) {
                    closePicker();
                }
            }
            // Preset mode: selection is buffered — wait for Apply
        }

        updateTriggerText();
        render();
    }

    function emitChange() {
        if (config.onChange) {
            config.onChange({
                start: fromDate(startDate, config.timestampFormat!, tz),
                end: fromDate(endDate, config.timestampFormat!, tz),
            });
        }
    }

    function openPicker() {
        if (isOpen || config.disabled) return;
        isOpen = true;
        popover.style.display = '';
        trigger.setAttribute('aria-expanded', 'true');
        selectingEnd = false;
        hoverDate = null;
        activePresetIdx = -1;

        // Snapshot committed state (for Cancel to revert to)
        committedStart = startDate ? new Date(startDate) : null;
        committedEnd = endDate ? new Date(endDate) : null;

        if (startDate) {
            leftViewDate = new Date(startDate);
            rightViewDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
        }
        render();

        removeClickOutside = onClickOutside(root, closePicker);
        removeEscapeHandler = onEscape(closePicker);
    }

    function closePicker() {
        if (!isOpen || config.inline) return;
        isOpen = false;
        popover.style.display = 'none';
        trigger.setAttribute('aria-expanded', 'false');
        selectingEnd = false;
        hoverDate = null;
        removeClickOutside?.();
        removeEscapeHandler?.();
        removeClickOutside = null;
        removeEscapeHandler = null;
    }

    // -----------------------------------------------------------------------
    // Event bindings
    // -----------------------------------------------------------------------

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isOpen) closePicker();
        else openPicker();
    });

    triggerClear.addEventListener('click', (e) => {
        e.stopPropagation();
        startDate = null;
        endDate = null;
        committedStart = null;
        committedEnd = null;
        selectingEnd = false;
        updateTriggerText();
        emitChange();
        if (isOpen) render();
    });

    // -----------------------------------------------------------------------
    // Initial render
    // -----------------------------------------------------------------------

    updateTriggerText();
    if (config.inline) render();

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    return {
        open: openPicker,
        close: closePicker,
        toggle() {
            if (isOpen) closePicker();
            else openPicker();
        },
        setValue(value: DateRange) {
            startDate = value.start ? toDate(value.start, tz) : null;
            endDate = value.end ? toDate(value.end, tz) : null;
            committedStart = startDate ? new Date(startDate) : null;
            committedEnd = endDate ? new Date(endDate) : null;
            if (startDate) {
                leftViewDate = new Date(startDate);
                rightViewDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
            }
            updateTriggerText();
            if (isOpen) render();
        },
        getValue() {
            return {
                start: fromDate(startDate, config.timestampFormat!, tz),
                end: fromDate(endDate, config.timestampFormat!, tz),
            };
        },
        setOptions(newOptions) {
            config = resolveConfig({ ...config, ...newOptions });
            if (newOptions.value) {
                startDate = newOptions.value.start ? toDate(newOptions.value.start, tz) : null;
                endDate = newOptions.value.end ? toDate(newOptions.value.end, tz) : null;
                committedStart = startDate ? new Date(startDate) : null;
                committedEnd = endDate ? new Date(endDate) : null;
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
