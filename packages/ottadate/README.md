# @ottabase/ottadate

Framework-agnostic date picker library with range, datetime, and fuzzy date support. Works with any framework or vanilla
JS — no React, Vue, or Angular required.

## Features

- **DatePicker** — Single date selection with calendar popover or inline mode
- **DateRangePicker** — Two-calendar layout for start/end range selection
- **DateRangePicker (with Presets)** — Sidebar with quick-select presets + Apply/Cancel footer
- **DateTimePicker** — Calendar + time inputs (hours, minutes, optional seconds, 12h/24h toggle)
- **FuzzyDateTimePicker** — Half-remembered dates ("Early 1990s", "Summer 1998", "Late May 2010") via a recursive "when
  in X?" drill-down: precision is derived from how deep the user goes, part chips give the coarse human answers, and
  every value stores a queryable `[earliest, latest]` interval
- **FuzzyDateTimeCompact** — Space-efficient fuzzy picker: sentence-style native `<select>`s that read like the stored
  label ("Summer · 1998", "Late · May · 2010")
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

For dates the user only partially remembers — "early 90s", "1996", "Summer 1998", "Late May 2010", "21 July 2026 at
14:30". There is no upfront "pick your precision" step. Every section asks the same recursive question — **"when in
X?"** — answerable at three fidelities:

1. **Name the sub-unit** (pick a year / month / day / time) — drills one level deeper.
2. **Pick a part chip** — the coarse terminal answer: early / mid / late (decades, years, months), seasons (years),
   morning / afternoon / evening / night (days). A part is terminal: naming a deeper unit clears it.
3. **Stop** — the resolution is simply the deepest level filled.

The live sentence headline shows exactly what will be stored ("Early 1990s", "Sometime in May 2010"), next to a single
**~ Roughly** toggle that marks the boundary itself as soft ("Around 1996" → could be 1995 or 1997). Tapping an active
month/day/part again clears it; time is a cascading `hh : mm : ss` row where blank means "don't remember". **Every
change applies immediately**; the footer offers Today / Clear plus Done (popover mode).

```typescript
const fuzzy = OttaDate.createFuzzyDateTimePicker(container, {
    onChange: (fuzzyDate) => console.log(fuzzyDate),
    resolutions: ['decade', 'year', 'month', 'day'], // decade is opt-in; default is year → second
    parts: true, // part chips (default: true)
    allowApproximate: true, // the ~ Roughly toggle (default: true)
    hemisphere: 'north', // season → month mapping (default: 'north')
    inline: true, // Works great inline
});
```

Apps can re-voice labels without touching internals via `formatLabel`, which receives everything but the label:

```typescript
import { buildFuzzyLabel } from '@ottabase/ottadate/fuzzy';

const journal = OttaDate.createFuzzyDateTimePicker(container, {
    formatLabel: (f) =>
        `Watched ${buildFuzzyLabel(new Date(f.timestamp * 1000), f.resolution, {
            part: f.part,
            approximate: f.approximate,
        }).toLowerCase()}`,
    onChange: console.log,
});
```

**`resolutions` semantics:** the list bounds the drill-down. The _coarsest_ entry is the required baseline (e.g.
`['month', 'day']` keeps a month always selected), and the _finest_ entry caps how deep the UI goes (e.g.
`['year', 'month', 'day']` never shows the time step). Pass `'decade'` to start the drill-down at decades.

### `OttaDate.createFuzzyDateTimeCompact(container, options)`

Space-efficient fuzzy date picker for forms and sidebars. Same derived-resolution model, rendered as a **sentence of
native `<select>`s that reads like the stored label** — the first select is the part ("Sometime" = none), and a small
`~` chip marks the value as approximate:

```text
[ Sometime ▾ ] [ Any month ▾ ] [ 2020 ▾ ]        → "Sometime in 2020"
[ Summer ▾ ]   [ Any month ▾ ] [ 1998 ▾ ]        → "Summer 1998"
[ Late ▾ ] [ May ▾ ] [ Any day ▾ ] [ 2010 ▾ ]    → "Late May 2010"
[ Sometime ▾ ] [ 1990s ▾ ] [ Any year ▾ ]        → "Sometime in the 1990s"  (decade mode)
```

Choosing "Any month" / "Any day" / "Any year" keeps the selection coarse; picking a real value refines it. Time inputs
cascade in once a day is set. The year dropdown spans 10 years ahead to 100 years back (fuzzy recall is past-heavy); in
decade mode the decade select pages the year select. Footer: Now (current date-time at the finest allowed depth, not
approximate) and Clear. Auto-applies on change.

```typescript
const compact = OttaDate.createFuzzyDateTimeCompact(container, {
    onChange: (fuzzyDate) => console.log(fuzzyDate),
    resolutions: ['year', 'month', 'day'],
    inline: true,
});
```

### FuzzyDateTime Object

```typescript
interface FuzzyDateTime {
    timestamp: number; // UTC unix seconds — start of the (part-narrowed) core window; stable sort anchor
    resolution: 'decade' | 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';
    part?: DatePart; // terminal refinement: early/mid/late, seasons, day-parts
    approximate?: boolean; // "~ish" — soft boundary
    earliest: number; // inclusive interval bounds (UTC unix seconds) —
    latest: number; //   the machine-usable truth: range queries, timeline bands
    label: string; // "Early 1990s", "Summer 1998", "Sometime in May 2010"
}
```

**Interval behavior (the machine-usable core):** every value carries `[earliest, latest]`. Sort a journal by
`timestamp`, filter "everything in the 90s" with an overlap query (`earliest <= rangeEnd AND latest >= rangeStart`),
render precise entries as points and fuzzy ones as bands.

| Selection        | Label                          | Interval                        |
| ---------------- | ------------------------------ | ------------------------------- |
| decade           | "Sometime in the 1990s"        | 1990-01-01 → 1999-12-31         |
| decade + `early` | "Early 1990s"                  | 1990 → 1993 (mid 4–6, late 7–9) |
| year             | "Sometime in 1996"             | the calendar year               |
| year + `summer`  | "Summer 1998"                  | Jun–Aug (north; south Dec–Feb)  |
| year + `~`       | "Around 1996"                  | 1995 → 1997 (±1 year)           |
| month + `late`   | "Late May 2010"                | May 21 → May 31                 |
| day + `night`    | "Night of May 21, 2010"        | 21:00 → 23:59                   |
| minute           | "May 21, 2010 at 14:30"        | that minute                     |
| minute + `~`     | "Around 14:30 on May 21, 2010" | ±15 minutes                     |

Part conventions: decade thirds are 0–3 / 4–6 / 7–9; year thirds are Jan–Apr / May–Aug / Sep–Dec; month thirds are 1–10
/ 11–20 / 21–end; day-parts are morning 05–11, afternoon 12–16, evening 17–20, night 21–23 (same date). "Winter 1998"
belongs to the year it starts in (Dec 1998 – Feb 1999). The `approximate` widening table: decade ±3y (±1y with a part),
year ±1y (±1mo), month ±1mo (±3d), day ±1d (±2h), hour ±1h, minute/second ±15.

### Serialization

A compact canonical string encoding (EDTF-inspired) for storing a fuzzy date in one column and round-tripping it:

```typescript
import { encodeFuzzyDateTime, decodeFuzzyDateTime } from '@ottabase/ottadate/fuzzy';

encodeFuzzyDateTime(fuzzy); // "199X:early~", "1998:summer", "2010-05:late", "2010-05-21T14:30"
decodeFuzzyDateTime('1998:summer'); // full FuzzyDateTime with label + interval, or null if malformed
```

`199X` is a decade, `:part` suffixes the named period, a trailing `~` marks approximate, and `T` starts a time (parts
never apply at time resolutions).

### Type-to-parse

`parseFuzzyInput` turns typed memories into FuzzyDateTime values — the text front-end to the same vocabulary. The full
fuzzy picker embeds it as a quick-entry field at the top (disable with `quickEntry: false`):

```typescript
import { parseFuzzyInput } from '@ottabase/ottadate/parse';

parseFuzzyInput('early 90s'); // "Early 1990s" (decade + part)
parseFuzzyInput('summer 98'); // "Summer 1998"
parseFuzzyInput('late may 2010'); // "Late May 2010"
parseFuzzyInput('21 july 2026 9pm'); // "July 21, 2026 at 21:00"
parseFuzzyInput('1996ish'); // "Around 1996" (approximate)
parseFuzzyInput('last night'); // "Night of <yesterday>"
parseFuzzyInput('banana'); // null — strict: unknown tokens never guess
```

Conventions: English-only for now; "may 10" reads as May 10 of the current year (a day, not 2010); 2-digit years and
decades resolve to the most recent past occurrence ("98" → 1998, "30s" → 1930s); relative words (today, yesterday,
tonight, last night, this morning) cover the journaling hot path; a time requires a full date. Pass `{ now }` for a
deterministic reference date.

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

// Type-to-parse (no DOM): "early 90s" / "summer 98" → FuzzyDateTime
import { parseFuzzyInput } from '@ottabase/ottadate/parse';

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
