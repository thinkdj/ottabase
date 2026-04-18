# @ottabase/ottadate

Framework-agnostic date picker library with range, datetime, and fuzzy date support. Works with any framework or vanilla
JS — no React, Vue, or Angular required.

## Features

- **DatePicker** — Single date selection with calendar popover or inline mode
- **DateRangePicker** — Two-calendar layout for start/end range selection
- **DateRangePicker (with Presets)** — Sidebar with quick-select presets + Apply/Cancel footer
- **DateTimePicker** — Calendar + time inputs (hours, minutes, optional seconds, 12h/24h toggle)
- **FuzzyDateTimePicker** — Approximate dates with chip-based year/month/day grids and resolution levels
- **FuzzyDateTimeCompact** — Space-efficient fuzzy picker using native `<select>` dropdowns
- **UTC-first** — Getter/setter uses UTC unix timestamps (seconds) by default; configurable to ISO strings or Date
  objects
- **Auto timezone** — Displays dates in user's detected timezone automatically
- **Inline or popover** — Both modes supported for all picker variants
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

For dates the user doesn't fully remember. Uses chip-based grids for year, month, day, and time selection at varying
resolution levels.

```typescript
const fuzzy = OttaDate.createFuzzyDateTimePicker(container, {
    value: {
        timestamp: 1588291200,
        resolution: 'month',
        approximation: 'sometime',
        label: 'Sometime in May 2020',
    },
    onChange: (fuzzyDate) => console.log(fuzzyDate),
    resolutions: ['year', 'month', 'day', 'hour', 'minute', 'second'], // Allowed levels
    approximations: ['exact', 'around', 'sometime'], // Allowed modes
    inline: true, // Works great inline
});
```

### `OttaDate.createFuzzyDateTimeCompact(container, options)`

Space-efficient fuzzy date picker using native `<select>` dropdowns instead of chip grids. Ideal for forms, sidebars,
and compact inline usage.

```typescript
const compact = OttaDate.createFuzzyDateTimeCompact(container, {
    onChange: (fuzzyDate) => console.log(fuzzyDate),
    resolutions: ['year', 'month', 'day'],
    approximations: ['sometime', 'around'],
    inline: true,
});
```

Layout: two side-by-side selects for approximation (Exact / Around / Sometime in) + resolution (Year / Month / Day /
etc.), native selects for date parts (shown based on resolution), time inputs (if resolution ≥ hour), live preview
label, and Now/Clear footer.

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

| Resolution | Stored timestamp          | Example label                |
| ---------- | ------------------------- | ---------------------------- |
| `year`     | Jan 1 of that year, UTC   | "Sometime in 2018"           |
| `month`    | 1st of that month, UTC    | "Sometime in May 2020"       |
| `day`      | Start of that day, UTC    | "Around May 20, 2025"        |
| `hour`     | Start of that hour, UTC   | "Around 11:00, May 20, 2025" |
| `minute`   | Start of that minute, UTC | "May 20, 2025 at 11:30"      |
| `second`   | Exact second, UTC         | "May 20, 2025 at 11:30:45"   |

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
