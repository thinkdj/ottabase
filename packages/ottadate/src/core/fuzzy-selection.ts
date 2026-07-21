/**
 * @ottabase/ottadate — Headless fuzzy-selection state controller
 *
 * The shared brain of both fuzzy pickers (FuzzyDateTimePicker and
 * FuzzyDateTimeCompact). No DOM — the pickers are thin views over this.
 *
 * Interaction model: RESOLUTION IS DERIVED, NEVER DECLARED.
 * Every level answers the recursive question "when in X?" with one of three
 * moves — name the sub-unit (drill deeper), pick a PART (a coarse terminal
 * refinement like "early" / "summer" / "night"), or stop:
 *
 *   decade only               → resolution 'decade'   ("Sometime in the 1990s")
 *   decade + part 'early'     → resolution 'decade'   ("Early 1990s")
 *   + year                    → resolution 'year'
 *   + year part 'summer'      → resolution 'year'     ("Summer 1998")
 *   + month / day / time      → 'month' / 'day' / 'hour' / 'minute' / 'second'
 *
 * A part is TERMINAL: naming a deeper unit clears it (knowing "May" supersedes
 * "early 1996"). Clearing a level clears everything finer than it. The
 * `approximate` flag ("~ish") is orthogonal and widens the stored interval.
 *
 * The `resolutions` option bounds this drill-down: the coarsest allowed value
 * is the required baseline (always filled), the finest is how deep the UI goes.
 */

import type { DatePart, DateResolution, FuzzyDateTime, FuzzyLabelFormatter, Hemisphere } from './types';
import {
    createFuzzyDateTime,
    isResolutionFinerOrEqual,
    parseFuzzyDateTime,
    partsForResolution,
    resolutionBounds,
    resolutionIndex,
} from './fuzzy';

export interface FuzzySelectionOptions {
    /** Allowed resolutions — coarsest = required baseline, finest = max drill depth */
    resolutions?: DateResolution[];
    /** Offer part-of-period refinements. Default: true */
    parts?: boolean;
    /** Season → month mapping. Default: 'north' */
    hemisphere?: Hemisphere;
    /** Override label generation */
    formatLabel?: FuzzyLabelFormatter;
    /** Initial value to load */
    value?: FuzzyDateTime | null;
}

export interface FuzzySelectionState {
    /** Concrete year (the decade's first year while only the decade is known) */
    year: number;
    month: number; // 0-indexed
    day: number;
    hour: number | null;
    minute: number | null;
    second: number | null;
    /** Whether the user has NAMED the year (false = decade-only, when decade is in play) */
    yearSet: boolean;
    monthSet: boolean;
    daySet: boolean;
    /** Terminal part refinement of the deepest named level, if any */
    part: DatePart | null;
    /** "~ish" — soft boundary, widens the stored interval */
    approximate: boolean;
    /** False until the user has made any selection (or a value was loaded) */
    hasSelection: boolean;
}

export interface FuzzySelection {
    state: FuzzySelectionState;
    base: DateResolution;
    finest: DateResolution;
    /** Whether the drill-down may go at least this deep */
    levelAllowed(level: DateResolution): boolean;
    /** The derived resolution of the current selection */
    resolution(): DateResolution;
    /** Days in the currently selected year/month */
    daysInMonth(): number;
    /** First year of the current decade */
    decadeStart(): number;
    /** Valid parts for the current derived resolution (empty when parts are disabled) */
    partOptions(): DatePart[];
    /** Build the FuzzyDateTime for the current selection (null when nothing selected) */
    build(): FuzzyDateTime | null;
    /** Step the decade by ±1 (10 years) */
    stepDecade(delta: number): void;
    setYear(year: number): void;
    stepYear(delta: number): void;
    /** Name a year within the decade, or un-name it when re-selecting the active one (decade base only) */
    toggleYear(year: number): void;
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
    /** Set/clear the terminal part refinement (validated against partOptions) */
    setPart(part: DatePart | null): void;
    /** Toggle a part chip — re-selecting the active part clears it */
    togglePart(part: DatePart): void;
    setApproximate(approximate: boolean): void;
    toggleApproximate(): void;
    /** Today's date, no time or part — the common "it happened today" shortcut */
    setToday(): void;
    /** Full current date+time at the finest allowed depth, not approximate */
    setNow(): void;
    /** Reset to the empty state */
    clear(): void;
    /** Load an existing FuzzyDateTime into the selection */
    load(value: FuzzyDateTime): void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createFuzzySelection(options: FuzzySelectionOptions = {}): FuzzySelection {
    const { base, finest } = resolutionBounds(options.resolutions);
    const partsEnabled = options.parts !== false;
    const hemisphere = options.hemisphere ?? 'north';
    const formatLabel = options.formatLabel;

    const state: FuzzySelectionState = {
        year: new Date().getFullYear(),
        month: 0,
        day: 1,
        hour: null,
        minute: null,
        second: null,
        yearSet: false,
        monthSet: false,
        daySet: false,
        part: null,
        approximate: false,
        hasSelection: false,
    };

    // The level the current part refines — used to invalidate it when the
    // selection depth changes (a part is terminal at exactly one level).
    let partLevel: DateResolution | null = null;

    const levelAllowed = (level: DateResolution) => isResolutionFinerOrEqual(finest, level);

    /** Base levels are the required minimum — keep them filled at all times */
    function applyBaseFloor() {
        if (isResolutionFinerOrEqual(base, 'year')) state.yearSet = true;
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

    function decadeStart(): number {
        return state.year - (state.year % 10);
    }

    function resolution(): DateResolution {
        let res: DateResolution = 'decade';
        if (state.yearSet) res = 'year';
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

    function partOptions(): DatePart[] {
        return partsEnabled ? partsForResolution(resolution()) : [];
    }

    /** A part is bound to one level — drop it whenever the selection depth changes */
    function sanitizePart() {
        if (state.part && partLevel !== resolution()) {
            state.part = null;
            partLevel = null;
        }
    }

    function clearTime() {
        state.hour = null;
        state.minute = null;
        state.second = null;
    }

    function build(): FuzzyDateTime | null {
        if (!state.hasSelection) return null;
        const date = new Date(
            Date.UTC(state.year, state.month, state.day, state.hour ?? 0, state.minute ?? 0, state.second ?? 0),
        );
        return createFuzzyDateTime(date, resolution(), {
            part: state.part,
            approximate: state.approximate,
            hemisphere,
            formatLabel,
        });
    }

    function setYear(year: number) {
        state.year = clamp(Math.round(year), 1, 9999);
        state.yearSet = true;
        clampDay();
        state.hasSelection = true;
        applyBaseFloor();
        sanitizePart();
    }

    function clearYearName() {
        if (isResolutionFinerOrEqual(base, 'year')) return; // year is required unless decade is the base
        state.year = decadeStart();
        state.yearSet = false;
        state.monthSet = false;
        state.daySet = false;
        clearTime();
        state.hasSelection = true;
        sanitizePart();
    }

    function setMonth(index: number) {
        state.month = clamp(index, 0, 11);
        state.monthSet = true;
        state.yearSet = true;
        clampDay();
        state.hasSelection = true;
        sanitizePart();
    }

    function clearMonth() {
        if (isResolutionFinerOrEqual(base, 'month')) return; // month is required
        state.monthSet = false;
        state.daySet = false;
        clearTime();
        applyBaseFloor();
        state.hasSelection = true;
        sanitizePart();
    }

    function setDay(day: number) {
        state.day = clamp(day, 1, daysInMonth());
        state.daySet = true;
        state.hasSelection = true;
        sanitizePart();
    }

    function clearDay() {
        if (isResolutionFinerOrEqual(base, 'day')) return; // day is required
        state.daySet = false;
        clearTime();
        applyBaseFloor();
        state.hasSelection = true;
        sanitizePart();
    }

    function setToday() {
        const now = new Date();
        state.year = now.getFullYear();
        state.yearSet = true;
        if (levelAllowed('month')) {
            state.month = now.getMonth();
            state.monthSet = true;
        }
        if (levelAllowed('day')) {
            state.day = now.getDate();
            state.daySet = true;
        }
        clearTime();
        state.part = null;
        partLevel = null;
        applyBaseFloor();
        state.hasSelection = true;
    }

    function load(value: FuzzyDateTime) {
        const parsed = parseFuzzyDateTime(value);
        const ri = resolutionIndex(parsed.resolution);
        state.year = parsed.date.getUTCFullYear();
        state.month = parsed.date.getUTCMonth();
        state.day = parsed.date.getUTCDate();
        state.yearSet = ri >= resolutionIndex('year');
        state.monthSet = ri >= resolutionIndex('month');
        state.daySet = ri >= resolutionIndex('day');
        state.hour = ri >= resolutionIndex('hour') ? parsed.date.getUTCHours() : null;
        state.minute = ri >= resolutionIndex('minute') ? parsed.date.getUTCMinutes() : null;
        state.second = ri >= resolutionIndex('second') ? parsed.date.getUTCSeconds() : null;
        state.approximate = parsed.approximate;
        state.part = parsed.part;
        partLevel = parsed.part ? parsed.resolution : null;
        applyBaseFloor();
        sanitizePart();
        state.hasSelection = true;
    }

    function setPart(part: DatePart | null) {
        if (part == null) {
            state.part = null;
            partLevel = null;
        } else {
            if (!partOptions().includes(part)) return;
            state.part = part;
            partLevel = resolution();
        }
        state.hasSelection = true;
    }

    function setApproximate(approximate: boolean) {
        state.approximate = approximate;
        if (approximate) state.hasSelection = true;
    }

    applyBaseFloor();
    if (options.value) load(options.value);

    return {
        state,
        base,
        finest,
        levelAllowed,
        resolution,
        daysInMonth,
        decadeStart,
        partOptions,
        build,

        stepDecade(delta: number) {
            state.year = clamp(state.year + delta * 10, 1, 9999);
            clampDay();
            state.hasSelection = true;
            sanitizePart();
        },
        setYear,
        stepYear(delta: number) {
            setYear(state.year + delta);
        },
        toggleYear(year: number) {
            if (state.yearSet && state.year === year && !isResolutionFinerOrEqual(base, 'year')) {
                clearYearName();
            } else {
                setYear(year);
            }
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
            sanitizePart();
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
            sanitizePart();
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
            sanitizePart();
        },
        setPart,
        togglePart(part: DatePart) {
            setPart(state.part === part ? null : part);
        },
        setApproximate,
        toggleApproximate() {
            setApproximate(!state.approximate);
        },
        setToday,
        setNow() {
            setToday();
            const now = new Date();
            if (levelAllowed('hour')) state.hour = now.getHours();
            if (levelAllowed('minute')) state.minute = now.getMinutes();
            if (levelAllowed('second')) state.second = now.getSeconds();
            state.approximate = false;
        },
        clear() {
            state.hasSelection = false;
            state.year = new Date().getFullYear();
            state.month = 0;
            state.day = 1;
            state.yearSet = false;
            state.monthSet = false;
            state.daySet = false;
            clearTime();
            state.part = null;
            partLevel = null;
            state.approximate = false;
            applyBaseFloor();
        },
        load,
    };
}
