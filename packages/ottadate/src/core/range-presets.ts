/**
 * @ottabase/ottadate — Default range presets
 *
 * Built-in quick-select presets for the DateRangePicker sidebar.
 * All ranges compute relative to "now" each time they are called.
 */

import { endOfDay, startOfDay, subDays, subMonths, subYears } from 'date-fns';
import type { DateRangePreset } from './types';

/**
 * Returns a default set of range presets matching common analytics/reporting UIs.
 *
 * Presets: Today, Last 3 Days, Last 7 Days, Last 30 Days,
 *          Last 3 Months, Last 6 Months, Last 1 Year
 */
export function getDefaultRangePresets(): DateRangePreset[] {
    return [
        {
            label: 'Today',
            range: () => {
                const now = new Date();
                return { start: startOfDay(now), end: endOfDay(now) };
            },
        },
        {
            label: 'Last 3 Days',
            range: () => {
                const now = new Date();
                return { start: startOfDay(subDays(now, 2)), end: endOfDay(now) };
            },
        },
        {
            label: 'Last 7 Days',
            range: () => {
                const now = new Date();
                return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
            },
        },
        {
            label: 'Last 30 Days',
            range: () => {
                const now = new Date();
                return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
            },
        },
        {
            label: 'Last 3 Months',
            range: () => {
                const now = new Date();
                return { start: startOfDay(subMonths(now, 3)), end: endOfDay(now) };
            },
        },
        {
            label: 'Last 6 Months',
            range: () => {
                const now = new Date();
                return { start: startOfDay(subMonths(now, 6)), end: endOfDay(now) };
            },
        },
        {
            label: 'Last 1 Year',
            range: () => {
                const now = new Date();
                return { start: startOfDay(subYears(now, 1)), end: endOfDay(now) };
            },
        },
    ];
}
