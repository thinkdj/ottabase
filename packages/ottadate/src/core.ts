/**
 * @ottabase/ottadate/core — Core utilities sub-path export
 *
 * Date conversion, formatting, and calendar grid helpers.
 * No DOM or picker dependencies — safe for server-side or headless usage.
 */

export type {
    DateApproximation,
    DatePickerOptions,
    DateRange,
    DateRangePickerOptions,
    DateResolution,
    DateTimePickerOptions,
    FuzzyDateTime,
    FuzzyDateTimePickerOptions,
    OttaDateConfig,
    TimestampFormat,
} from './core/types';

export {
    buildCalendarGrid,
    detectTimezone,
    formatDate,
    formatDisplay,
    formatHour12,
    formatTime,
    fromDate,
    getHoursList,
    getMinutesList,
    getMonthNames,
    getMonthNamesShort,
    getSecondsList,
    getWeekdayLabels,
    getYearRange,
    isAfter,
    isBefore,
    isDateInBounds,
    isSameDay,
    isSameMonth,
    isValid,
    isWithinInterval,
    pad2,
    resolveConfig,
    resolveTimezone,
    toDate,
} from './core/utils';

export {
    APPROXIMATION_LABELS,
    RESOLUTION_LABELS,
    RESOLUTION_ORDER,
    buildFuzzyLabel,
    createFuzzyDateTime,
    getResolutionDescription,
    isResolutionFinerOrEqual,
    parseFuzzyDateTime,
    refreshFuzzyLabel,
    resolutionIndex,
    snapToResolution,
} from './core/fuzzy';
