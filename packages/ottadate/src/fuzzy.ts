/**
 * @ottabase/ottadate/fuzzy — FuzzyDateTime sub-path export
 *
 * Standalone FuzzyDateTime logic: creation, parsing, label generation, snapping.
 * No DOM dependencies — safe for server-side usage.
 */

export type { DatePart, DateResolution, FuzzyDateTime, FuzzyLabelFormatter, Hemisphere } from './core/types';

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

// Headless selection-state controller (what the fuzzy pickers render from) —
// use it to build custom fuzzy-date UIs with the same derived-resolution model.
export { createFuzzySelection } from './core/fuzzy-selection';
export type { FuzzySelection, FuzzySelectionOptions, FuzzySelectionState } from './core/fuzzy-selection';
