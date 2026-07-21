# @ottabase/ottadate

Framework-agnostic date picker library with range, datetime, and fuzzy date support. Works with any framework or vanilla
JS — no React, Vue, or Angular required.

## Features

- **DatePicker** — Single date selection with calendar popover or inline mode
- **DateRangePicker** — Two-calendar layout for start/end range selection
- **DateRangePicker (with Presets)** — Sidebar with quick-select presets + Apply/Cancel footer
- **DateTimePicker** — Calendar + time inputs (hours, minutes, optional seconds, 12h/24h toggle)
- **FuzzyDateTimePicker** — Approximate dates via a progressive "fill in what you remember" drill-down; the resolution
  is derived from how deep the user goes, never declared upfront
- **FuzzyDateTimeCompact** — Space-efficient fuzzy picker: sentence-style native `<select>`s that read like the stored
  label ("Sometime · May · 2020")
- **UTC-first** — Getter/setter uses UTC unix timestamps (seconds) by default; configurable to ISO strings or Date
  objects
- **Auto timezone** — Displays dates in user's detected timezone automatically
- **Inline or popover** — Both modes supported for all picker variants
- **Popover not clipped in scroll panes** — `DatePicker` / `DateTimePicker` popovers use `position: fixed` with viewport
  clamping so narrow sidebars (`overflow: auto`) do not cut off the calendar
- **Theme-aware** — CSS custom properties integrate with shadcn/tailwind design tokens; dark mode supported
- **Tree-shakeable** — Import only what you need via sub-path exports

## Installation

```bash
pnpm add @ottabase/ottadate
```

## Quick Start

```typescript
import { OttaDate } from '@ottabase/ottadate';
import '@ottabase/ottadate/styles.css';

const picker = OttaDate.createDatePicker(document.getElementById('container')!, {
    value: 1704067200, // Jan 1, 2024 00:00 UTC
    onChange: (timestamp) => console.log('Selected:', timestamp),
});
```

## API

### `OttaDate.createDatePicker(container, options)`

Single date selector.

```typescript
const picker = OttaDate.createDatePicker(container, {
    value: 1704067200, // UTC unix timestamp (seconds)
    onChange: (ts) => {}, // Called on selection
    timezone: 'auto', // 'auto' detects browser TZ (default)
    timestampFormat: 'unix', // 'unix' | 'iso' | 'date'
    displayFormat: 'MMM d, yyyy', // date-fns format string
    firstDayOfWeek: 1, // 0 = Sunday, 1 = Monday
    inline: false, // true = always visible, no popover
    placeholder: 'Select date…',
    minDate: 1672531200, // Constraint: min selectable
    maxDate: 1735689600, // Constraint: max selectable
    disabled: false,
});

// Programmatic control
picker.open();
picker.close();
picker.toggle();
picker.setValue(1735689600); // Set programmatically
picker.getValue(); // Get current value
picker.setOptions({ disabled: true }); // Update options
picker.destroy(); // Clean up DOM
picker.isOpen(); // Check open state
```

### `OttaDate.createDateRangePicker(container, options)`

Start/end date range selector with dual calendar.

```typescript
// Basic — auto-apply on selection, Today/Clear footer
const range = OttaDate.createDateRangePicker(container, {
    value: { start: 1704067200, end: 1704672000 },
    onChange: ({ start, end }) => console.log(start, end),
    allowSameDay: true, // Allow same start/end (default: true)
    startPlaceholder: 'Start date',
    endPlaceholder: 'End date',
});

range.getValue(); // { start: 1704067200, end: 1704672000 }
```

#### With Preset Sidebar

Pass `presets` to enable a quick-select sidebar with Apply/Cancel footer:

```typescript
import { OttaDate, getDefaultRangePresets } from '@ottabase/ottadate';

const range = OttaDate.createDateRangePicker(container, {
    presets: getDefaultRangePresets(),
    onChange: ({ start, end }) => console.log(start, end),
});
```

Default presets: Today, Last 3 Days, Last 7 Days, Last 30 Days, Last 3 Months, Last 6 Months, Last 1 Year.

**Custom presets:**

```typescript
import type { DateRangePreset } from '@ottabase/ottadate';
import { startOfDay, endOfDay, subDays } from 'date-fns';

const myPresets: DateRangePreset[] = [
    {
        label: 'This Week',
        range: () => ({ start: startOfDay(subDays(new Date(), 6)), end: endOfDay(new Date()) }),
    },
    {
        label: 'Custom Period',
        range: () => ({ start: new Date(2025, 0, 1), end: new Date(2025, 5, 30) }),
    },
];

const range = OttaDate.createDateRangePicker(container, {
    presets: myPresets,
    onChange: console.log,
});
```

**Preset mode behavior:**

- Sidebar lists presets with a "Customised »" first item for manual calendar selection
- Selecting a preset highlights it and auto-navigates both calendars to show the range
- Cancel reverts to the previously committed selection; Apply commits the draft
- Without `presets`, the picker behaves as classic mode (auto-apply, Today/Clear footer)

### `OttaDate.createDateTimePicker(container, options)`

Calendar + time inputs.

```typescript
const dt = OttaDate.createDateTimePicker(container, {
    value: 1704067200,
    onChange: (ts) => console.log(ts),
    showSeconds: false, // Show seconds input (default: false)
    use12Hour: false, // 12h AM/PM pill toggle (default: false, 24h)
    minuteStep: 1, // Minute increment (default: 1)
});
```

### `OttaDate.createFuzzyDateTimePicker(container, options)`

For dates the user only partially remembers. There is no upfront "pick your precision" step — the picker is a
progressive drill-down and **the resolution is derived from how deep the user fills in**:

- **Year** is always present (editable value + prev/next steppers — type `1994` directly).
- **Month** is a 12-cell grid marked "if you remember". Picking one refines the resolution to `month`; tapping the
  active month again clears it (and everything finer).
- **Day** appears only once a month is chosen; same toggle-to-clear behavior.
- **Time** appears only once a day is chosen: cascading `hh : mm : ss` inputs where blank means "don't remember".
  Filling the hour derives `hour`, the minute `minute`, the second `second`.

The live sentence headline at the top shows exactly what will be stored ("Sometime in May 2020"), with a small Sometime
/ Around / Exactly segment beneath it. 'Sometime' is disabled once a time is set ("sometime at 11:30" is a
contradiction) and auto-swaps to 'Around', restoring itself if the time is removed. **Every change applies immediately**
— there is no Apply step; the footer offers Today / Clear plus Done (popover mode) to close.

```typescript
const fuzzy = OttaDate.createFuzzyDateTimePicker(container, {
    value: {
        timestamp: 1588291200,
        resolution: 'month',
        approximation: 'sometime',
        label: 'Sometime in May 2020',
    },
    onChange: (fuzzyDate) => console.log(fuzzyDate),
    resolutions: ['year', 'month', 'day', 'hour', 'minute', 'second'],
    approximations: ['sometime', 'around', 'exact'],
    inline: true, // Works great inline
});
```

**`resolutions` semantics:** the list bounds the drill-down. The _coarsest_ entry is the required baseline (e.g.
`['month', 'day']` keeps a month always selected), and the _finest_ entry caps how deep the UI goes (e.g.
`['year', 'month', 'day']` never shows the time step).

### `OttaDate.createFuzzyDateTimeCompact(container, options)`

Space-efficient fuzzy date picker for forms and sidebars. Same derived-resolution model, rendered as a **sentence of
native `<select>`s that reads like the stored label**:

```text
[ Sometime ▾ ] [ Any month ▾ ] [ 2020 ▾ ]          → "Sometime in 2020"
[ Sometime ▾ ] [ May ▾ ] [ Any day ▾ ] [ 2020 ▾ ]  → "Sometime in May 2020"
[ Around ▾ ]   [ May ▾ ] [ 20 ▾ ] [ 2020 ▾ ]       → "Around May 20, 2020"
```

Choosing "Any month" / "Any day" keeps the selection coarse; picking a real value refines it. Time inputs cascade in
once a day is set. The year dropdown spans 10 years ahead to 100 years back (fuzzy recall is past-heavy). Footer: Now
(fills the current date-time at the finest allowed depth, approximation 'exact') and Clear. Auto-applies on change.

```typescript
const compact = OttaDate.createFuzzyDateTimeCompact(container, {
    onChange: (fuzzyDate) => console.log(fuzzyDate),
    resolutions: ['year', 'month', 'day'],
    approximations: ['sometime', 'around'],
    inline: true,
});
```

### FuzzyDateTime Object

```typescript
interface FuzzyDateTime {
    timestamp: number; // UTC unix seconds, snapped to resolution start
    resolution: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';
    approximation: 'exact' | 'around' | 'sometime';
    label: string; // "Sometime in May 2020"
}
```

**Resolution behavior:**

| Resolution | Stored timestamp          | Example label                  |
| ---------- | ------------------------- | ------------------------------ |
| `year`     | Jan 1 of that year, UTC   | "Sometime in 2018"             |
| `month`    | 1st of that month, UTC    | "Sometime in May 2020"         |
| `day`      | Start of that day, UTC    | "Sometime on May 20, 2025"     |
| `hour`     | Start of that hour, UTC   | "Around 11:00 on May 20, 2025" |
| `minute`   | Start of that minute, UTC | "May 20, 2025 at 11:30"        |
| `second`   | Exact second, UTC         | "May 20, 2025 at 11:30:45"     |

Label grammar adapts to the resolution: "in" a period (year/month), "on" a day, "at" a time. At time-of-day resolutions
the 'sometime' approximation renders as "Around" — "sometime at 11:30" would be a contradiction.

## Shared Options (all pickers)

| Option              | Type                        | Default          | Description                     |
| ------------------- | --------------------------- | ---------------- | ------------------------------- |
| `timezone`          | `string \| 'auto'`          | `'auto'`         | Timezone for display            |
| `timestampFormat`   | `'unix' \| 'iso' \| 'date'` | `'unix'`         | Format for getter/setter values |
| `locale`            | `string`                    | `'en-US'`        | Locale for date formatting      |
| `firstDayOfWeek`    | `0 \| 1`                    | `1`              | 0 = Sunday, 1 = Monday          |
| `displayFormat`     | `string`                    | `'MMM d, yyyy'`  | date-fns format string          |
| `timeDisplayFormat` | `string`                    | `'HH:mm'`        | Time format string              |
| `classPrefix`       | `string`                    | `'ottadate'`     | CSS class prefix                |
| `inline`            | `boolean`                   | `false`          | Always visible, no popover      |
| `placeholder`       | `string`                    | `'Select date…'` | Placeholder text                |
| `disabled`          | `boolean`                   | `false`          | Disable the picker              |
| `minDate`           | `number \| Date`            | —                | Min selectable date             |
| `maxDate`           | `number \| Date`            | —                | Max selectable date             |

## Programmatic API (all pickers)

Every picker returns an instance with:

```typescript
interface PickerInstance {
    open(): void; // Open popover (no-op when inline)
    close(): void; // Close popover (no-op when inline)
    toggle(): void; // Toggle open/close
    setValue(value): void; // Set value programmatically
    getValue(): value; // Get current value
    setOptions(opts): void; // Update options dynamically
    destroy(): void; // Remove from DOM, clean up listeners
    isOpen(): boolean; // Whether popover is currently open
    element: HTMLElement; // Root container element
}
```

## Sub-path Exports

```typescript
// Full library (pickers + core + fuzzy)
import { OttaDate } from '@ottabase/ottadate';

// Core utilities only (no DOM — safe for SSR/server)
import { toDate, fromDate, formatDate, detectTimezone, resolveTimezone } from '@ottabase/ottadate/core';

// FuzzyDateTime logic only (no DOM)
import { createFuzzyDateTime, snapToResolution, buildFuzzyLabel } from '@ottabase/ottadate/fuzzy';

// Headless fuzzy selection-state controller — the derived-resolution state
// machine both fuzzy pickers render from. Use it to build custom fuzzy UIs.
import { createFuzzySelection } from '@ottabase/ottadate/fuzzy';

// Stylesheet
import '@ottabase/ottadate/styles.css';
```

## Theming

CSS custom properties integrate with shadcn/tailwind theme tokens. Raw HSL channels (e.g. `0 0% 100%`) are wrapped in
`hsl()` automatically. Standalone fallbacks ensure the picker works without any theme:

```css
.ottadate {
    --od-bg: hsl(var(--popover, var(--background, 0 0% 100%)));
    --od-fg: hsl(var(--popover-foreground, var(--foreground, 240 10% 3.9%)));
    --od-primary: hsl(var(--primary, 240 5.9% 10%));
    --od-border: hsl(var(--border, 240 5.9% 90%));
    --od-radius: var(--radius, 0.5rem);
    /* Transitions use brandkit motion tokens when available */
    --od-transition: var(--duration-fast, 100ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1));
}
```

Override any variable on `.ottadate` or a parent element:

```css
.my-theme .ottadate {
    --od-primary: hsl(217 91% 60%);
    --od-radius: 0.25rem;
}
```

Dark mode is automatically supported via `.dark` parent class or `prefers-color-scheme: dark`.

## Usage with React

The pickers are vanilla JS, so mount them in `useEffect` with a ref:

```tsx
import { useEffect, useRef } from 'react';
import { OttaDate } from '@ottabase/ottadate';
import '@ottabase/ottadate/styles.css';

function MyDatePicker({ value, onChange }) {
    const ref = useRef<HTMLDivElement>(null);
    const pickerRef = useRef<ReturnType<typeof OttaDate.createDatePicker>>();

    useEffect(() => {
        if (!ref.current) return;
        pickerRef.current = OttaDate.createDatePicker(ref.current, {
            value,
            onChange,
        });
        return () => pickerRef.current?.destroy();
    }, []);

    useEffect(() => {
        pickerRef.current?.setValue(value);
    }, [value]);

    return <div ref={ref} />;
}
```

## Nuances

- **Timestamps are seconds, not milliseconds.** JS `Date.now()` returns ms; divide by 1000 or use `toDate()` which
  handles both.
- **FuzzyDateTime timestamp is snapped.** For resolution `'month'`, the timestamp points to the 1st of that month at
  00:00 UTC. The `resolution` field tells renderers to only display down to that granularity.
- **Preset mode is opt-in.** Pass `presets` to `createDateRangePicker` to enable the sidebar + Apply/Cancel footer.
  Without it, the picker auto-applies on selection (classic mode). This is fully backward-compatible.
- **Inline mode disables close.** When `inline: true`, `open()` / `close()` are no-ops; the calendar is always rendered.
- **Popover positioning.** The popover uses `position: absolute` relative to the picker root. Ensure the parent
  container has `position: relative` or uses normal flow.
- **No keyboard navigation (yet).** Focus management and arrow-key navigation are planned for a future release.
