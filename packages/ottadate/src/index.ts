/**
 * @ottabase/ottadate — Main entry point
 *
 * Framework-agnostic date picker library with support for:
 * - Single date selection
 * - Date range selection
 * - DateTime (date + time) selection
 * - FuzzyDateTime (approximate dates with resolution levels)
 *
 * All pickers mount to a DOM container and work without React or any framework.
 * Values default to UTC unix timestamps (seconds). Configurable via timestampFormat.
 *
 * @example
 * ```typescript
 * import { OttaDate } from '@ottabase/ottadate';
 * // Don't forget to import styles:
 * // import '@ottabase/ottadate/styles.css';
 *
 * const picker = OttaDate.createDatePicker(document.getElementById('my-container')!, {
 *     value: 1704067200,
 *     onChange: (timestamp) => console.log('Selected:', timestamp),
 * });
 * ```
 */

// Core types — re-export everything
export type {
    DatePart,
    DatePickerInstance,
    DatePickerOptions,
    DateRange,
    DateRangePickerInstance,
    DateRangePickerOptions,
    DateRangePreset,
    DateResolution,
    DateTimePickerInstance,
    DateTimePickerOptions,
    FuzzyDateTime,
    FuzzyDateTimePickerInstance,
    FuzzyDateTimePickerOptions,
    FuzzyLabelFormatter,
    Hemisphere,
    OttaDateConfig,
    PickerInstance,
    TimestampFormat,
} from './core/types';

// Core utilities — re-export key ones
export { detectTimezone, formatDate, fromDate, resolveTimezone, toDate } from './core/utils';

// FuzzyDateTime utilities
export {
    buildFuzzyLabel,
    createFuzzyDateTime,
    decodeFuzzyDateTime,
    DEFAULT_RESOLUTIONS,
    encodeFuzzyDateTime,
    parseFuzzyDateTime,
    PART_LABELS,
    partsForResolution,
    refreshFuzzyLabel,
    RESOLUTION_LABELS,
    RESOLUTION_ORDER,
    resolutionBounds,
    snapToResolution,
} from './core/fuzzy';

// Headless fuzzy selection-state controller (build custom fuzzy UIs on top)
export { createFuzzySelection } from './core/fuzzy-selection';
export type { FuzzySelection, FuzzySelectionOptions, FuzzySelectionState } from './core/fuzzy-selection';

// Type-to-parse ("early 90s", "summer 98", "21 july 2026" → FuzzyDateTime)
export { parseFuzzyInput } from './core/parse';
export type { ParseFuzzyOptions } from './core/parse';

// Range presets
export { getDefaultRangePresets } from './core/range-presets';

// Pickers
export { createDatePicker } from './pickers/DatePicker';
export { createDateRangePicker } from './pickers/DateRangePicker';
export { createDateTimePicker } from './pickers/DateTimePicker';
export { createFuzzyDateTimeCompact } from './pickers/FuzzyDateTimeCompact';
export { createFuzzyDateTimePicker } from './pickers/FuzzyDateTimePicker';

// ---------------------------------------------------------------------------
// OttaDate namespace — convenient single import
// ---------------------------------------------------------------------------

import {
    buildFuzzyLabel,
    createFuzzyDateTime,
    decodeFuzzyDateTime,
    encodeFuzzyDateTime,
    parseFuzzyDateTime,
    refreshFuzzyLabel,
    snapToResolution,
} from './core/fuzzy';
import { parseFuzzyInput } from './core/parse';
import { getDefaultRangePresets } from './core/range-presets';
import { detectTimezone, formatDate, fromDate, resolveTimezone, toDate } from './core/utils';
import { createDatePicker } from './pickers/DatePicker';
import { createDateRangePicker } from './pickers/DateRangePicker';
import { createDateTimePicker } from './pickers/DateTimePicker';
import { createFuzzyDateTimeCompact } from './pickers/FuzzyDateTimeCompact';
import { createFuzzyDateTimePicker } from './pickers/FuzzyDateTimePicker';

/**
 * OttaDate — namespace object for all picker factory methods and utilities.
 *
 * @example
 * ```typescript
 * import { OttaDate } from '@ottabase/ottadate';
 *
 * const picker = OttaDate.createDatePicker(container, { onChange: console.log });
 * const range = OttaDate.createDateRangePicker(container, { onChange: console.log });
 * const dt = OttaDate.createDateTimePicker(container, { onChange: console.log });
 * const fuzzy = OttaDate.createFuzzyDateTimePicker(container, { onChange: console.log });
 * ```
 */
export const OttaDate = {
    createDatePicker,
    createDateRangePicker,
    createDateTimePicker,
    createFuzzyDateTimePicker,
    createFuzzyDateTimeCompact,

    // Range presets
    getDefaultRangePresets,

    // Utilities
    toDate,
    fromDate,
    formatDate,
    detectTimezone,
    resolveTimezone,

    // Fuzzy helpers
    createFuzzyDateTime,
    parseFuzzyDateTime,
    refreshFuzzyLabel,
    buildFuzzyLabel,
    snapToResolution,
    encodeFuzzyDateTime,
    decodeFuzzyDateTime,
    parseFuzzyInput,
} as const;
