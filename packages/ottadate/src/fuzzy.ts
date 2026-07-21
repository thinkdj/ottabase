/**
 * @ottabase/ottadate/fuzzy — FuzzyDateTime sub-path export
 *
 * Standalone FuzzyDateTime logic: creation, parsing, label generation, snapping.
 * No DOM dependencies — safe for server-side usage.
 */

export type { DateApproximation, DateResolution, FuzzyDateTime } from './core/types';

export {
    APPROXIMATION_LABELS,
    APPROXIMATION_ORDER,
    RESOLUTION_LABELS,
    RESOLUTION_ORDER,
    buildFuzzyLabel,
    createFuzzyDateTime,
    isResolutionFinerOrEqual,
    parseFuzzyDateTime,
    refreshFuzzyLabel,
    resolutionBounds,
    resolutionIndex,
    snapToResolution,
} from './core/fuzzy';

// Headless selection-state controller (what the fuzzy pickers render from) —
// use it to build custom fuzzy-date UIs with the same derived-resolution model.
export { createFuzzySelection } from './core/fuzzy-selection';
export type { FuzzySelection, FuzzySelectionOptions, FuzzySelectionState } from './core/fuzzy-selection';
