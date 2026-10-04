# @ottabase/ottadate

Framework-agnostic date picker library with range, datetime, and fuzzy date support. Works with any framework or vanilla
JS — no React, Vue, or Angular required.

## Features

- **DatePicker** — Single date selection with calendar popover or inline mode
- **DateRangePicker** — Two-calendar layout for start/end range selection
- **DateRangePicker (with Presets)** — Sidebar with quick-select presets + Apply/Cancel footer
- **DateTimePicker** — Calendar + time inputs (hours, minutes, optional seconds, 12h/24h toggle)
- **FuzzyDateTimePicker**: half-remembered dates ("Early 1990s", "Summer 1998", "Late May 2010") in one fixed-size panel
  that zooms like a map (decades → years → months → days → hours). Tap what you remember, as roughly as you like; parts
  and "~ Roughly" are drawn as bands on the grid, and the panel spells out the stored range
- **FuzzyDateTimeCompact**: same shell with native `<select>`s in label order ("Late · May · 2010"): the smallest
  footprint, and the OS wheel on phones
- **Type it**: both fuzzy pickers take typed memories ("summer 98", "early 90s", "last night") with a live preview
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

For dates the user only partly remembers: "early 90s", "1996", "Summer 1998", "Late May 2010", "21 July 2026 at 14:30".
One panel, one grid at a time, zooming like a map:

```text
 Type it: summer 98, early 90s…        ← type a memory (live preview, Enter to apply)
 ‹            1998 ⌃            ›      ← title zooms out, arrows browse
 [Sometime][Early ][ Mid  ][ Late ]    ← how sure you are about 1998
 [Spring  ][Summer][Autumn][Winter]
   Jan    Feb    Mar    Apr            ← or name a month to zoom in
  ░May░  [Jun]  [Jul]  [Aug]           ← "Summer" as a band, "~ Roughly" hatched
  ░Sep░   Oct    Nov    Dec
 Around summer 1998       [~ Roughly]  ← what will be stored
 May 1 to Sep 30, 1998
 Today  Clear                    Done
```

The whole interaction model is four rules:

1. **Browse freely.** The title (zoom out) and the ‹ › arrows never change the value.
2. **Tap a cell** to name that period and zoom into it (1998 → its months → May's calendar → May 21's hours). Tapping a
   cell already on the value's path just zooms in, so going back up never loses detail.
3. **Tap a chip** to answer for the period on screen: a part (early / mid / late, seasons, morning … night) or
   **Sometime** / **All day** ("just this period"), which is how you become less precise. Tap an active part to drop it.
   A part is terminal: naming a finer unit replaces it.
4. **~ Roughly** marks the edges as soft ("Around 1996" → 1995 to 1997).

Parts are drawn as a solid band over the grid and the "~ Roughly" spill as a hatched band, and the result line spells
out the stored range ("Jun 1 to Aug 31, 1998", or "Precise to the month" for plain values). Days use a real calendar
with weekdays (a strong memory cue: "it was a Saturday"). Every change applies immediately; the footer offers Today /
Clear plus Done (popover mode).

```typescript
const fuzzy = OttaDate.createFuzzyDateTimePicker(container, {
    onChange: (fuzzyDate) => console.log(fuzzyDate),
    resolutions: ['decade', 'year', 'month', 'day'], // decade is opt-in; default is year → second
    parts: true, // part chips (default: true)
    allowApproximate: true, // the ~ Roughly toggle (default: true)
    quickEntry: true, // the "Type it" field (default: true)
    hemisphere: 'north', // season → month mapping (default: 'north')
    inline: true,
});
```

**Opening view:** with a value, the panel opens inside its deepest named period ("Summer 1998" opens on 1998's months
with Summer active). Empty, it opens on the grid of the coarsest allowed level: the decades grid in decade mode, else
this decade's years. Nothing is pre-filled, so what you see selected is exactly what is stored.

**Narrow hosts:** an inline panel shrinks to its container, and when it gets narrower than its default width the chips
size to their words and wrap (a CSS container query), so no label is ever cut.

**Keyboard:** one tab stop per grid (the selected cell, else today), arrow keys move within it, Home / End jump, PageUp
/ PageDown browse, Escape clears typed text first and then closes. On desktop the "Type it" field is focused on open, so
click → type "summer 98" → Enter is the fastest path; on touch it is not, so the keyboard never covers the grid.

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
`['year', 'month', 'day']` never shows hours; a day then offers only its day-part chips). Pass `'decade'` to let a value
stop at a decade.

### `OttaDate.createFuzzyDateTimeCompact(container, options)`

Same options, same shell (type-it field, result line, ~ Roughly, footer), with a body of native `<select>`s in the order
the label reads, two per row:

```text
[ Sometime ▾ ] [ Year     ▾ ]          → nothing picked yet
[ Summer   ▾ ] [ Any month▾ ]          → "Summer 1998"
[ 1998     ▾ ]
[ Late     ▾ ] [ May      ▾ ]          → "Late May 2010"
[ Any day  ▾ ] [ 2010     ▾ ]
```

"Sometime" is the no-part answer and "Any month" / "Any day" keep it coarse. The year list is grouped by decade (10
years ahead to 100 back); in decade mode each group starts with the decade itself ("1990s"). Changing the year keeps the
rest ("Summer 1998" → "Summer 1997"). Time inputs cascade in once a day is named.

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
render precise entries as points and fuzzy ones as bands. `formatFuzzyRange(fuzzy)` turns the interval into text ("1990
to 1993", "Jun 1 to Aug 31, 1998", "May 21, 2010, 21:00 to 23:59") for lists and tooltips.

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

`parseFuzzyInput` turns typed memories into FuzzyDateTime values, the text front-end to the same vocabulary. Both fuzzy
pickers embed it as the "Type it" field (disable with `quickEntry: false`), and every built-in label parses back to the
same value, so stored labels can be pasted or re-typed:

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
import { createFuzzyDateTime, snapToResolution, buildFuzzyLabel, formatFuzzyRange } from '@ottabase/ottadate/fuzzy';

// Headless fuzzy selection-state controller: the derived-resolution state
// machine both fuzzy pickers render from. Use it to build custom fuzzy UIs.
// `select(level, at)` names a period exactly (the one move a zoomable UI needs).
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
- **Popover positioning.** `DatePicker`, `DateTimePicker` and both fuzzy pickers use `position: fixed` with viewport
  clamping, so scroll panes never clip them. `DateRangePicker` uses `position: absolute` relative to the picker root;
  give its parent `position: relative` or normal flow.
- **Keyboard navigation.** The fuzzy pickers are fully keyboard-driven (see above). The calendar pickers (`DatePicker`,
  `DateRangePicker`, `DateTimePicker`) do not have arrow-key navigation yet.
