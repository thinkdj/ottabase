/**
 * @ottabase/ottadate/fuzzy — FuzzyDateTime sub-path export
 *
 * Standalone FuzzyDateTime logic: creation, parsing, label generation, snapping.
 * No DOM dependencies — safe for server-side usage.
 */

export type { DateApproximation, DateResolution, FuzzyDateTime } from './core/types';

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
