/**
 * @ottabase/ottadate — Core type definitions
 *
 * All types are framework-agnostic. Timestamps are UTC unix seconds by default.
 */

// ---------------------------------------------------------------------------
// Resolution & Fuzzy types
// ---------------------------------------------------------------------------

/** Precision level for fuzzy date selection */
export type DateResolution = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

/** How approximate the date is */
export type DateApproximation = 'exact' | 'around' | 'sometime';

/**
 * FuzzyDateTime — stores a date with known precision level.
 *
 * Example: "Sometime in May 2020"
 *   → { timestamp: 1588291200, resolution: 'month', approximation: 'sometime' }
 *
 * The `timestamp` is stored as UTC unix seconds at the start of the resolved period
 * (e.g. resolution 'month' → first day of that month at 00:00 UTC).
 */
export interface FuzzyDateTime {
    /** UTC unix timestamp in seconds (start of the resolved period) */
    timestamp: number;
    /** The finest unit the user actually specified */
    resolution: DateResolution;
    /** How approximate — 'exact' | 'around' | 'sometime' */
    approximation: DateApproximation;
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
    /** Called when the user selects/changes a fuzzy date */
    onChange?: (value: FuzzyDateTime | null) => void;
    /** Allowed resolutions. Default: all */
    resolutions?: DateResolution[];
    /** Allowed approximations. Default: all */
    approximations?: DateApproximation[];
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
