/**
 * @ottabase/ottadate — Headless fuzzy-selection state controller
 *
 * The shared brain of both fuzzy pickers (FuzzyDateTimePicker and
 * FuzzyDateTimeCompact). No DOM — the pickers are thin views over this.
 *
 * Interaction model: RESOLUTION IS DERIVED, NEVER DECLARED.
 * The user fills in the parts of the date they remember — year, then optionally
 * month, then day, then time — and the resolution is simply the deepest level
 * they filled. Clearing a level clears everything finer than it (you can't
 * remember the day without the month).
 *
 *   year only            → resolution 'year'
 *   + month              → resolution 'month'
 *   + day                → resolution 'day'
 *   + hour / min / sec   → resolution 'hour' / 'minute' / 'second'
 *
 * The `resolutions` option bounds this drill-down: the coarsest allowed value
 * is the required baseline (always filled), the finest is how deep the UI goes.
 */

import type { DateApproximation, DateResolution, FuzzyDateTime } from './types';
import {
    APPROXIMATION_ORDER,
    createFuzzyDateTime,
    isResolutionFinerOrEqual,
    parseFuzzyDateTime,
    resolutionBounds,
    resolutionIndex,
} from './fuzzy';

export interface FuzzySelectionOptions {
    /** Allowed resolutions — coarsest = required baseline, finest = max drill depth */
    resolutions?: DateResolution[];
    /** Allowed approximations. Default: sometime, around, exact */
    approximations?: DateApproximation[];
    /** Initial value to load */
    value?: FuzzyDateTime | null;
}

export interface FuzzySelectionState {
    year: number;
    month: number; // 0-indexed
    day: number;
    hour: number | null;
    minute: number | null;
    second: number | null;
    monthSet: boolean;
    daySet: boolean;
    approximation: DateApproximation;
    /** False until the user has made any selection (or a value was loaded) */
    hasSelection: boolean;
}

export interface FuzzySelection {
    state: FuzzySelectionState;
    base: DateResolution;
    finest: DateResolution;
    allowedApprox: DateApproximation[];
    /** Whether the drill-down may go at least this deep */
    levelAllowed(level: DateResolution): boolean;
    /** The derived resolution of the current selection */
    resolution(): DateResolution;
    /** Days in the currently selected year/month */
    daysInMonth(): number;
    /** 'sometime' is nonsense at time-of-day precision — segment should disable it */
    sometimeDisabled(): boolean;
    /** Build the FuzzyDateTime for the current selection (null when nothing selected) */
    build(): FuzzyDateTime | null;
    setYear(year: number): void;
    stepYear(delta: number): void;
    /** Select a month, or clear it (and everything finer) when re-selecting the active one */
    toggleMonth(index: number): void;
    toggleDay(day: number): void;
    setMonth(index: number): void;
    clearMonth(): void;
    setDay(day: number): void;
    clearDay(): void;
    /** null clears the whole time (hour, minute, second cascade) */
    setHour(hour: number | null): void;
    setMinute(minute: number | null): void;
    setSecond(second: number | null): void;
    setApproximation(approx: DateApproximation): void;
    /** Today's date, no time — the common "it happened today" shortcut */
    setToday(): void;
    /** Full current date+time at the finest allowed depth, approximation 'exact' */
    setNow(): void;
    /** Reset to the empty state */
    clear(): void;
    /** Load an existing FuzzyDateTime into the selection */
    load(value: FuzzyDateTime): void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createFuzzySelection(options: FuzzySelectionOptions = {}): FuzzySelection {
    const { base, finest } = resolutionBounds(options.resolutions);
    const allowedApprox: DateApproximation[] = APPROXIMATION_ORDER.filter((a) =>
        options.approximations?.length ? options.approximations.includes(a) : true,
    );

    const state: FuzzySelectionState = {
        year: new Date().getFullYear(),
        month: 0,
        day: 1,
        hour: null,
        minute: null,
        second: null,
        monthSet: false,
        daySet: false,
        approximation: allowedApprox.includes('sometime') ? 'sometime' : allowedApprox[0],
        hasSelection: false,
    };

    // Tracks whether 'sometime' was auto-swapped to 'around' when the user added
    // a time, so it can be restored if they remove the time again.
    let sometimeAutoSwitched = false;

    const levelAllowed = (level: DateResolution) => isResolutionFinerOrEqual(finest, level);

    /** Base levels are the required minimum — keep them filled at all times */
    function applyBaseFloor() {
        if (isResolutionFinerOrEqual(base, 'month')) state.monthSet = true;
        if (isResolutionFinerOrEqual(base, 'day')) state.daySet = true;
        if (isResolutionFinerOrEqual(base, 'hour') && state.hour == null) state.hour = 0;
        if (isResolutionFinerOrEqual(base, 'minute') && state.minute == null) state.minute = 0;
        if (isResolutionFinerOrEqual(base, 'second') && state.second == null) state.second = 0;
    }

    function daysInMonth(): number {
        return new Date(state.year, state.month + 1, 0).getDate();
    }

    function clampDay() {
        const max = daysInMonth();
        if (state.day > max) state.day = max;
    }

    function resolution(): DateResolution {
        let res: DateResolution = 'year';
        if (state.monthSet) res = 'month';
        if (state.daySet) res = 'day';
        if (state.hour != null) res = 'hour';
        if (state.minute != null) res = 'minute';
        if (state.second != null) res = 'second';
        // Clamp into the allowed window
        if (resolutionIndex(res) < resolutionIndex(base)) res = base;
        if (resolutionIndex(res) > resolutionIndex(finest)) res = finest;
        return res;
    }

    function sometimeDisabled(): boolean {
        return isResolutionFinerOrEqual(resolution(), 'hour');
    }

    /** Swap 'sometime' ↔ 'around' as the selection crosses into/out of time-of-day */
    function normalizeApproximation() {
        if (sometimeDisabled()) {
            if (state.approximation === 'sometime') {
                const fallback = allowedApprox.find((a) => a !== 'sometime');
                if (fallback) {
                    state.approximation = fallback;
                    sometimeAutoSwitched = true;
                }
            }
        } else if (sometimeAutoSwitched && allowedApprox.includes('sometime')) {
            state.approximation = 'sometime';
            sometimeAutoSwitched = false;
        }
    }

    function clearTime() {
        state.hour = null;
        state.minute = null;
        state.second = null;
    }

    function build(): FuzzyDateTime | null {
        if (!state.hasSelection) return null;
        normalizeApproximation();
        const date = new Date(
            Date.UTC(state.year, state.month, state.day, state.hour ?? 0, state.minute ?? 0, state.second ?? 0),
        );
        return createFuzzyDateTime(date, resolution(), state.approximation);
    }

    function setMonth(index: number) {
        state.month = clamp(index, 0, 11);
        state.monthSet = true;
        clampDay();
        state.hasSelection = true;
    }

    function clearMonth() {
        if (isResolutionFinerOrEqual(base, 'month')) return; // month is required
        state.monthSet = false;
        state.daySet = false;
        clearTime();
        applyBaseFloor();
        state.hasSelection = true;
    }

    function setDay(day: number) {
        state.day = clamp(day, 1, daysInMonth());
        state.daySet = true;
        state.hasSelection = true;
    }

    function clearDay() {
        if (isResolutionFinerOrEqual(base, 'day')) return; // day is required
        state.daySet = false;
        clearTime();
        applyBaseFloor();
        state.hasSelection = true;
    }

    applyBaseFloor();

    function load(value: FuzzyDateTime) {
        const parsed = parseFuzzyDateTime(value);
        const ri = resolutionIndex(parsed.resolution);
        state.approximation = parsed.approximation;
        state.year = parsed.date.getUTCFullYear();
        state.month = parsed.date.getUTCMonth();
        state.day = parsed.date.getUTCDate();
        state.monthSet = ri >= resolutionIndex('month');
        state.daySet = ri >= resolutionIndex('day');
        state.hour = ri >= resolutionIndex('hour') ? parsed.date.getUTCHours() : null;
        state.minute = ri >= resolutionIndex('minute') ? parsed.date.getUTCMinutes() : null;
        state.second = ri >= resolutionIndex('second') ? parsed.date.getUTCSeconds() : null;
        applyBaseFloor();
        state.hasSelection = true;
        sometimeAutoSwitched = false;
    }

    if (options.value) load(options.value);

    function setYear(year: number) {
        state.year = clamp(Math.round(year), 1, 9999);
        clampDay();
        state.hasSelection = true;
    }

    function setToday() {
        const now = new Date();
        state.year = now.getFullYear();
        if (levelAllowed('month')) {
            state.month = now.getMonth();
            state.monthSet = true;
        }
        if (levelAllowed('day')) {
            state.day = now.getDate();
            state.daySet = true;
        }
        clearTime();
        applyBaseFloor();
        state.hasSelection = true;
    }

    return {
        state,
        base,
        finest,
        allowedApprox,
        levelAllowed,
        resolution,
        daysInMonth,
        sometimeDisabled,
        build,

        setYear,
        stepYear(delta: number) {
            setYear(state.year + delta);
        },
        setMonth,
        clearMonth,
        toggleMonth(index: number) {
            if (state.monthSet && state.month === index && !isResolutionFinerOrEqual(base, 'month')) {
                clearMonth();
            } else {
                setMonth(index);
            }
        },
        setDay,
        clearDay,
        toggleDay(day: number) {
            if (state.daySet && state.day === day && !isResolutionFinerOrEqual(base, 'day')) {
                clearDay();
            } else {
                setDay(day);
            }
        },
        setHour(hour: number | null) {
            if (hour == null) {
                clearTime();
                applyBaseFloor();
            } else {
                state.hour = clamp(hour, 0, 23);
            }
            state.hasSelection = true;
        },
        setMinute(minute: number | null) {
            if (minute == null) {
                state.minute = null;
                state.second = null;
                applyBaseFloor();
            } else {
                if (state.hour == null) state.hour = 0;
                state.minute = clamp(minute, 0, 59);
            }
            state.hasSelection = true;
        },
        setSecond(second: number | null) {
            if (second == null) {
                state.second = null;
                applyBaseFloor();
            } else {
                if (state.hour == null) state.hour = 0;
                if (state.minute == null) state.minute = 0;
                state.second = clamp(second, 0, 59);
            }
            state.hasSelection = true;
        },
        setApproximation(approx: DateApproximation) {
            if (!allowedApprox.includes(approx)) return;
            state.approximation = approx;
            sometimeAutoSwitched = false;
        },
        setToday,
        setNow() {
            setToday();
            const now = new Date();
            if (levelAllowed('hour')) state.hour = now.getHours();
            if (levelAllowed('minute')) state.minute = now.getMinutes();
            if (levelAllowed('second')) state.second = now.getSeconds();
            if (allowedApprox.includes('exact')) {
                state.approximation = 'exact';
                sometimeAutoSwitched = false;
            }
        },
        clear() {
            state.hasSelection = false;
            state.year = new Date().getFullYear();
            state.month = 0;
            state.day = 1;
            state.monthSet = false;
            state.daySet = false;
            clearTime();
            applyBaseFloor();
            sometimeAutoSwitched = false;
        },
        load,
    };
}
