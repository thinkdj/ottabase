/**
 * @ottabase/ottadate — Core type definitions
 *
 * All types are framework-agnostic. Timestamps are UTC unix seconds by default.
 */

// ---------------------------------------------------------------------------
// Resolution & Fuzzy types
// ---------------------------------------------------------------------------

/** Precision level for fuzzy date selection (decade is opt-in for the pickers) */
export type DateResolution = 'decade' | 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

/**
 * Part-of-period refinement — the coarse human answer to "when in X?".
 * A part is TERMINAL: it refines the deepest named level instead of naming the
 * next one ("early 1996" instead of picking a month).
 *
 *   decade / year / month → early | mid | late
 *   year                  → also spring | summer | autumn | winter
 *   day                   → morning | afternoon | evening | night
 */
export type DatePart =
    | 'early'
    | 'mid'
    | 'late'
    | 'spring'
    | 'summer'
    | 'autumn'
    | 'winter'
    | 'morning'
    | 'afternoon'
    | 'evening'
    | 'night';

/** Which hemisphere season months map to (affects spring/summer/autumn/winter) */
export type Hemisphere = 'north' | 'south';

/** Override hook for label generation — receives everything except the label itself */
export type FuzzyLabelFormatter = (fuzzy: Omit<FuzzyDateTime, 'label'>) => string;

/**
 * FuzzyDateTime — a date with known precision, stored as a queryable interval.
 *
 * Example: "Late May 2010"
 *   → { resolution: 'month', part: 'late', timestamp: <May 21>, earliest: <May 21>, latest: <May 31 23:59:59> }
 *
 * `timestamp` is the start of the (part-narrowed) core window — a stable sort
 * anchor. `earliest`/`latest` are the inclusive uncertainty bounds; `approximate`
 * widens them beyond the named period ("Around 1996" → 1995…1997).
 */
export interface FuzzyDateTime {
    /** UTC unix seconds — start of the core window (period start, narrowed by `part`) */
    timestamp: number;
    /** The finest unit the user actually specified */
    resolution: DateResolution;
    /** Terminal part-of-period refinement ("early", "summer", "night"), if any */
    part?: DatePart;
    /** "~ish" — the boundary itself is soft; widens earliest/latest by ~1 unit */
    approximate?: boolean;
    /** Inclusive window start (UTC unix seconds) — the machine-usable truth */
    earliest: number;
    /** Inclusive window end (UTC unix seconds) */
    latest: number;
    /** Pre-rendered human-readable label, e.g. "Sometime in May 2020" */
    label: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Timestamp format used for getter/setter values */
export type TimestampFormat = 'unix' | 'iso' | 'date';

export interface OttaDateConfig {
    /** Timezone for display. 'auto' = detect from browser. Default: 'auto' */
    timezone?: string | 'auto';
    /** Format for input/output values. Default: 'unix' (seconds) */
    timestampFormat?: TimestampFormat;
    /** Locale object from date-fns, or locale string for native Intl. Default: 'en-US' */
    locale?: string | any;
    /** First day of week: 0 = Sunday, 1 = Monday. Default: 1 */
    firstDayOfWeek?: 0 | 1;
    /** Min selectable date (UTC unix seconds, or Date) */
    minDate?: number | Date;
    /** Max selectable date (UTC unix seconds, or Date) */
    maxDate?: number | Date;
    /** Date display format string (date-fns pattern). Default: 'MMM d, yyyy' */
    displayFormat?: string;
    /** Time display format string (date-fns pattern). Default: 'HH:mm' */
    timeDisplayFormat?: string;
    /** CSS class prefix for custom styling. Default: 'ottadate' */
    classPrefix?: string;
    /** Whether the picker opens inline (true) or as a popover (false). Default: false */
    inline?: boolean;
    /** Placeholder text for the input trigger. Default: 'Select date...' */
    placeholder?: string;
    /** Whether the field is disabled */
    disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Date Picker
// ---------------------------------------------------------------------------

export interface DatePickerOptions extends OttaDateConfig {
    /** Current value — UTC unix timestamp in seconds (or ISO string / Date depending on timestampFormat) */
    value?: number | string | Date | null;
    /** Called when the user selects a date */
    onChange?: (value: number | string | Date | null) => void;
}

// ---------------------------------------------------------------------------
// Date Range Picker
// ---------------------------------------------------------------------------

export interface DateRange {
    start: number | string | Date | null;
    end: number | string | Date | null;
}

/** A preset quick-select option for the DateRangePicker sidebar */
export interface DateRangePreset {
    /** Display label shown in the sidebar list */
    label: string;
    /** Function that returns the start/end Dates for this preset */
    range: () => { start: Date; end: Date };
}

export interface DateRangePickerOptions extends OttaDateConfig {
    /** Current value — start/end pair */
    value?: DateRange;
    /** Called when the user selects a range */
    onChange?: (value: DateRange) => void;
    /** Allow same-day start/end. Default: true */
    allowSameDay?: boolean;
    /** Placeholder for start input */
    startPlaceholder?: string;
    /** Placeholder for end input */
    endPlaceholder?: string;
    /**
     * Preset quick-select options displayed in a sidebar.
     * When provided, the picker shows a sidebar list + Apply/Cancel footer.
     * Use `getDefaultRangePresets()` for a sensible starter list.
     */
    presets?: DateRangePreset[];
}

// ---------------------------------------------------------------------------
// DateTime Picker
// ---------------------------------------------------------------------------

export interface DateTimePickerOptions extends OttaDateConfig {
    /** Current value — UTC unix timestamp in seconds */
    value?: number | string | Date | null;
    /** Called when the user selects a datetime */
    onChange?: (value: number | string | Date | null) => void;
    /** Show seconds selector. Default: false */
    showSeconds?: boolean;
    /** 12-hour format. Default: false (24h) */
    use12Hour?: boolean;
    /** Minute step for time selector. Default: 1 */
    minuteStep?: number;
}

// ---------------------------------------------------------------------------
// Fuzzy DateTime Picker
// ---------------------------------------------------------------------------

export interface FuzzyDateTimePickerOptions extends OttaDateConfig {
    /** Current fuzzy date value */
    value?: FuzzyDateTime | null;
    /** Called when the user selects/changes a fuzzy date (fires on every change — pickers auto-apply) */
    onChange?: (value: FuzzyDateTime | null) => void;
    /**
     * Bounds for the drill-down. The coarsest entry is the required baseline
     * (always filled), the finest entry caps how deep the picker goes.
     * Default: year baseline down to second — `decade` is opt-in.
     */
    resolutions?: DateResolution[];
    /** Offer part-of-period chips (early/mid/late, seasons, day-parts). Default: true */
    parts?: boolean;
    /** Offer the "~ Roughly" toggle that widens the window. Default: true */
    allowApproximate?: boolean;
    /**
     * Type-to-parse field at the top of the full picker ("early 90s",
     * "summer 98", "21 jul 2010" → parsed into the selection). Default: true
     */
    quickEntry?: boolean;
    /** Hemisphere for season → month mapping. Default: 'north' */
    hemisphere?: Hemisphere;
    /** Override label generation (e.g. "Watched in 1996" instead of "Sometime in 1996") */
    formatLabel?: FuzzyLabelFormatter;
}

// ---------------------------------------------------------------------------
// Shared picker instance interface
// ---------------------------------------------------------------------------

export interface PickerInstance {
    /** Open the picker popover */
    open(): void;
    /** Close the picker popover */
    close(): void;
    /** Toggle open/close */
    toggle(): void;
    /** Set value programmatically */
    setValue(value: any): void;
    /** Get current value */
    getValue(): any;
    /** Update options dynamically */
    setOptions(options: Partial<any>): void;
    /** Destroy the picker and clean up DOM/listeners */
    destroy(): void;
    /** Whether the picker is currently open */
    isOpen(): boolean;
    /** The root container element */
    element: HTMLElement;
}

export interface DatePickerInstance extends PickerInstance {
    setValue(value: number | string | Date | null): void;
    getValue(): number | string | Date | null;
    setOptions(options: Partial<DatePickerOptions>): void;
}

export interface DateRangePickerInstance extends PickerInstance {
    setValue(value: DateRange): void;
    getValue(): DateRange;
    setOptions(options: Partial<DateRangePickerOptions>): void;
}

export interface DateTimePickerInstance extends PickerInstance {
    setValue(value: number | string | Date | null): void;
    getValue(): number | string | Date | null;
    setOptions(options: Partial<DateTimePickerOptions>): void;
}

export interface FuzzyDateTimePickerInstance extends PickerInstance {
    setValue(value: FuzzyDateTime | null): void;
    getValue(): FuzzyDateTime | null;
    setOptions(options: Partial<FuzzyDateTimePickerOptions>): void;
}
