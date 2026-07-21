/**
 * @ottabase/ottadate/core — Core utilities sub-path export
 *
 * Date conversion, formatting, and calendar grid helpers.
 * No DOM or picker dependencies — safe for server-side or headless usage.
 */

export type {
    DatePart,
    DatePickerOptions,
    DateRange,
    DateRangePickerOptions,
    DateResolution,
    DateTimePickerOptions,
    FuzzyDateTime,
    FuzzyDateTimePickerOptions,
    FuzzyLabelFormatter,
    Hemisphere,
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
    DEFAULT_RESOLUTIONS,
    PART_LABELS,
    RESOLUTION_LABELS,
    RESOLUTION_ORDER,
    buildFuzzyLabel,
    createFuzzyDateTime,
    decodeFuzzyDateTime,
    encodeFuzzyDateTime,
    isResolutionFinerOrEqual,
    isValidPart,
    parseFuzzyDateTime,
    partsForResolution,
    refreshFuzzyLabel,
    resolutionBounds,
    resolutionIndex,
    snapToResolution,
} from './core/fuzzy';
