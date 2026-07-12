# @ottabase/ottadate — agent notes

Framework-agnostic date/range/datetime/fuzzy pickers with UTC-first unix values. Full docs: ./README.md

## Use when

- Any UI needs a date, date-range (with presets), datetime, or fuzzy/approximate date input; mounts to a DOM container in any framework.
- NOT for pure date math/formatting with no picker UI — use date-fns (catalog:) directly.
- Fuzzy/server-side logic without DOM: use the `/core` or `/fuzzy` sub-path exports (SSR-safe).

## Imports

    import { OttaDate, createDatePicker, createDateRangePicker, createDateTimePicker, createFuzzyDateTimePicker, createFuzzyDateTimeCompact, getDefaultRangePresets } from '@ottabase/ottadate';
    import { toDate, fromDate, formatDate, detectTimezone, resolveTimezone } from '@ottabase/ottadate';
    import type { DateRange, DateRangePreset, FuzzyDateTime, PickerInstance } from '@ottabase/ottadate';
    import { toDate, fromDate, formatDate, buildCalendarGrid } from '@ottabase/ottadate/core'; // DOM-free
    import { createFuzzyDateTime, parseFuzzyDateTime, snapToResolution, buildFuzzyLabel, refreshFuzzyLabel } from '@ottabase/ottadate/fuzzy'; // DOM-free
    import '@ottabase/ottadate/styles.css'; // required once per app

## Canonical usage

    const picker = OttaDate.createDatePicker(el, {
        value: 1704067200, // UTC unix seconds
        onChange: (v) => setValue(v),
    });
    // later: picker.setValue(ts); picker.getValue(); picker.destroy();

    const range = OttaDate.createDateRangePicker(el, {
        presets: getDefaultRangePresets(),
        onChange: (r) => setRange(r), // r: DateRange { start/end }
    });

    // DOM-free fuzzy value (e.g. worker/edge — no DOM APIs used)
    const fuzzy = createFuzzyDateTime(new Date(), 'month', 'sometime');
    // -> { timestamp, resolution, approximation, label }

## Gotchas

- Timestamps are UTC unix SECONDS, not milliseconds (configurable via timestampFormat).
- Import styles.css or pickers render unstyled.
- FuzzyDateTime timestamp is snapped to the start of its resolution (month -> 1st 00:00 UTC) via snapToResolution.
- No keyboard navigation yet; with inline: true, open()/close() are no-ops.
- In React, destroy() the instance in the effect cleanup to avoid duplicate mounts.
