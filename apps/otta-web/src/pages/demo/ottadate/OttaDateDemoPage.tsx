/**
 * OttaDate Demo Page
 *
 * Showcases all @ottabase/ottadate picker variants:
 * - DatePicker (single date)
 * - DateRangePicker
 * - DateTimePicker
 * - FuzzyDateTimePicker
 *
 * Each picker is mounted as a vanilla JS widget inside React refs.
 */

import {
    OttaDate,
    encodeFuzzyDateTime,
    getDefaultRangePresets,
    parseFuzzyInput,
    type DatePickerInstance,
    type DateRange,
    type FuzzyDateTime,
} from '@ottabase/ottadate';
import { Input } from '@ottabase/ui-shadcn/input';
import { Button } from '@ottabase/ui-shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn/card';
import { useEffect, useRef, useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';
// Styles are imported once at the app level or here
import '@ottabase/ottadate/styles.css';

// ---------------------------------------------------------------------------
// Reusable hook: mount a vanilla JS picker into a React ref
// ---------------------------------------------------------------------------

function usePickerMount<T>(
    factory: (container: HTMLElement) => T,
    deps: any[] = [],
): { ref: React.RefObject<HTMLDivElement | null>; instance: T | null } {
    const ref = useRef<HTMLDivElement | null>(null);
    const instanceRef = useRef<T | null>(null);

    useEffect(() => {
        if (!ref.current) return;
        // Clean previous instance
        ref.current.innerHTML = '';
        const inst = factory(ref.current);
        instanceRef.current = inst;
        return () => {
            (inst as any)?.destroy?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { ref, instance: instanceRef.current };
}

// ---------------------------------------------------------------------------
// Demo sections
// ---------------------------------------------------------------------------

function DatePickerDemo() {
    const [value, setValue] = useState<number | string | Date | null>(null);

    const { ref } = usePickerMount(
        (el) =>
            OttaDate.createDatePicker(el, {
                placeholder: 'Pick a date…',
                onChange: (v) => setValue(v),
            }),
        [],
    );

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Date Picker</CardTitle>
                <CardDescription>Single date selection. Returns UTC unix timestamp by default.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                <pre className="overflow-auto rounded-lg bg-background p-3 font-mono text-xs ring-1 ring-border">
                    {JSON.stringify({ value, type: typeof value }, null, 2)}
                </pre>
            </CardContent>
        </Card>
    );
}

function DatePickerInlineDemo() {
    const [value, setValue] = useState<number | string | Date | null>(null);

    const { ref } = usePickerMount(
        (el) =>
            OttaDate.createDatePicker(el, {
                inline: true,
                onChange: (v) => setValue(v),
            }),
        [],
    );

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Inline Date Picker</CardTitle>
                <CardDescription>Always-visible calendar, no popover trigger.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                <pre className="overflow-auto rounded-lg bg-background p-3 font-mono text-xs ring-1 ring-border">
                    {value != null ? `Selected: ${value} (unix)` : 'No date selected'}
                </pre>
            </CardContent>
        </Card>
    );
}

function DateRangeDemo() {
    const [range, setRange] = useState<DateRange>({ start: null, end: null });

    const { ref } = usePickerMount(
        (el) =>
            OttaDate.createDateRangePicker(el, {
                placeholder: 'Select a date range…',
                onChange: (r) => setRange(r),
            }),
        [],
    );

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Date Range Picker</CardTitle>
                <CardDescription>
                    Two-calendar layout for start/end selection. Click once for start, again for end.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                <pre className="overflow-auto rounded-lg bg-background p-3 font-mono text-xs ring-1 ring-border">
                    {JSON.stringify(range, null, 2)}
                </pre>
            </CardContent>
        </Card>
    );
}

/** Date Range with preset sidebar + Apply/Cancel flow */
function DateRangePresetsDemo() {
    const [range, setRange] = useState<DateRange>({ start: null, end: null });

    const { ref } = usePickerMount(
        (el) =>
            OttaDate.createDateRangePicker(el, {
                placeholder: 'Pick a range…',
                presets: getDefaultRangePresets(),
                onChange: (r) => setRange(r),
            }),
        [],
    );

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Date Range — Presets</CardTitle>
                <CardDescription>
                    Sidebar with quick-select presets (Today, Last 7 days, etc.) plus Apply / Cancel flow.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                <pre className="overflow-auto rounded-lg bg-background p-3 font-mono text-xs ring-1 ring-border">
                    {JSON.stringify(range, null, 2)}
                </pre>
            </CardContent>
        </Card>
    );
}

function DateTimeDemo() {
    const [value, setValue] = useState<number | string | Date | null>(null);

    const { ref } = usePickerMount(
        (el) =>
            OttaDate.createDateTimePicker(el, {
                placeholder: 'Select date and time…',
                showSeconds: false,
                onChange: (v) => setValue(v),
            }),
        [],
    );

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">DateTime Picker</CardTitle>
                <CardDescription>Calendar with time inputs. Combines date and time selection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                <pre className="overflow-auto rounded-lg bg-background p-3 font-mono text-xs ring-1 ring-border">
                    {value != null
                        ? JSON.stringify(
                              {
                                  unix: value,
                                  readable: new Date((value as number) * 1000).toISOString(),
                              },
                              null,
                              2,
                          )
                        : 'No datetime selected'}
                </pre>
            </CardContent>
        </Card>
    );
}

function FuzzyDateTimeDemo() {
    const [fuzzy, setFuzzy] = useState<FuzzyDateTime | null>(null);

    const { ref } = usePickerMount(
        (el) =>
            OttaDate.createFuzzyDateTimePicker(el, {
                placeholder: 'Select an approximate date…',
                onChange: (v) => setFuzzy(v),
            }),
        [],
    );

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Fuzzy DateTime Picker</CardTitle>
                <CardDescription>
                    For dates you only partially remember. Each step asks "when in X?" — name the sub-unit, pick a part
                    chip (early/mid/late, seasons, day-parts), or stop. Precision is derived from how deep you go, and
                    the stored value carries a queryable [earliest, latest] interval. Every change applies immediately.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                {fuzzy && (
                    <div className="space-y-2">
                        <div className="rounded-lg bg-background p-3 text-center text-sm italic ring-1 ring-border">
                            "{fuzzy.label}"
                        </div>
                        <pre className="overflow-auto rounded-lg bg-background p-3 font-mono text-xs ring-1 ring-border">
                            {JSON.stringify(fuzzy, null, 2)}
                        </pre>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function FuzzyDateTimeInlineDemo() {
    const [fuzzy, setFuzzy] = useState<FuzzyDateTime | null>(null);

    const { ref } = usePickerMount(
        (el) =>
            OttaDate.createFuzzyDateTimePicker(el, {
                inline: true,
                onChange: (v) => setFuzzy(v),
                resolutions: ['decade', 'year', 'month', 'day'],
            }),
        [],
    );

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Fuzzy DateTime (Inline, Decades)</CardTitle>
                <CardDescription>
                    Inline "memory mode": decade opt-in via resolutions, capped at day. Try "Early 1990s", "Summer
                    1998", or "Late May 2010" — part chips are the coarse answer to each "when in X?" step, and the ~
                    toggle marks the whole thing as rough.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                {fuzzy && (
                    <pre className="overflow-auto rounded-lg bg-background p-3 font-mono text-xs ring-1 ring-border">
                        {JSON.stringify(fuzzy, null, 2)}
                    </pre>
                )}
            </CardContent>
        </Card>
    );
}

function FuzzyCompactDemo() {
    const [fuzzy, setFuzzy] = useState<FuzzyDateTime | null>(null);

    const { ref } = usePickerMount(
        (el) =>
            OttaDate.createFuzzyDateTimeCompact(el, {
                placeholder: 'FuzzyDateTime',
                onChange: (v) => setFuzzy(v),
            }),
        [],
    );

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Fuzzy DateTime (Compact)</CardTitle>
                <CardDescription>
                    Sentence-style native selects that read like the stored label — "Summer · 1998", "Late · May ·
                    2010". "Sometime" is the no-part state; "Any month" / "Any day" stay coarse; the ~ chip marks it
                    rough. Space-efficient for forms and sidebars; auto-applies on change.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} className="max-w-xs" />
                {fuzzy && (
                    <div className="space-y-2">
                        <div className="rounded-lg bg-background p-3 text-center text-sm italic ring-1 ring-border">
                            "{fuzzy.label}"
                        </div>
                        <pre className="overflow-auto rounded-lg bg-background p-3 font-mono text-xs ring-1 ring-border">
                            {JSON.stringify(fuzzy, null, 2)}
                        </pre>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function FuzzyCompactInlineDemo() {
    const [fuzzy, setFuzzy] = useState<FuzzyDateTime | null>(null);

    const { ref } = usePickerMount(
        (el) =>
            OttaDate.createFuzzyDateTimeCompact(el, {
                inline: true,
                onChange: (v) => setFuzzy(v),
                resolutions: ['year', 'month', 'day'],
            }),
        [],
    );

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Fuzzy Compact (Inline)</CardTitle>
                <CardDescription>
                    Inline compact mode capped at day resolution. Minimal footprint for embedded forms.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} className="max-w-xs" />
                {fuzzy && (
                    <pre className="overflow-auto rounded-lg bg-background p-3 font-mono text-xs ring-1 ring-border">
                        {JSON.stringify(fuzzy, null, 2)}
                    </pre>
                )}
            </CardContent>
        </Card>
    );
}

/** Type-to-parse: free-text memories → FuzzyDateTime via parseFuzzyInput */
function FuzzyParseDemo() {
    const [input, setInput] = useState('early 90s');
    const parsed = parseFuzzyInput(input);

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Type a Memory (parseFuzzyInput)</CardTitle>
                <CardDescription>
                    Free-text front-end to the same vocabulary — try "early 90s", "summer 98", "late may 2010", "21 july
                    2026 9pm", "1996ish", "last night". Strict: anything unrecognized returns null instead of guessing.
                    The full fuzzy picker embeds this as its quick-entry field.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="early 90s · summer 98 · 21 jul 2010…"
                    className="max-w-sm"
                />
                {parsed ? (
                    <div className="space-y-2">
                        <div className="rounded-lg bg-background p-3 text-center text-sm italic ring-1 ring-border">
                            "{parsed.label}" <span className="not-italic text-muted-foreground">·</span>{' '}
                            <code className="not-italic text-xs text-muted-foreground">
                                {encodeFuzzyDateTime(parsed)}
                            </code>
                        </div>
                        <pre className="overflow-auto rounded-lg bg-background p-3 font-mono text-xs ring-1 ring-border">
                            {JSON.stringify(parsed, null, 2)}
                        </pre>
                    </div>
                ) : (
                    <div className="rounded-lg bg-background p-3 text-sm text-muted-foreground ring-1 ring-border">
                        {input.trim() ? 'Could not parse that memory.' : 'Type something…'}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ProgrammaticApiDemo() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const pickerRef = useRef<DatePickerInstance | null>(null);
    const [log, setLog] = useState<string[]>([]);

    useEffect(() => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';
        pickerRef.current = OttaDate.createDatePicker(containerRef.current, {
            onChange: (v) => {
                setLog((prev) => [...prev.slice(-4), `onChange: ${v}`]);
            },
        });
        return () => {
            pickerRef.current?.destroy();
        };
    }, []);

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Programmatic API</CardTitle>
                <CardDescription>Control the picker via JavaScript: open, close, setValue, getValue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                    <div ref={containerRef} className="flex-1" />
                    <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button variant="outline" size="sm" onClick={() => pickerRef.current?.open()}>
                            Open
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => pickerRef.current?.close()}>
                            Close
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                // Set to Jan 1 2025 00:00 UTC
                                pickerRef.current?.setValue(1735689600);
                                setLog((prev) => [...prev.slice(-4), 'setValue(1735689600) — Jan 1 2025']);
                            }}
                        >
                            Set Jan 1, 2025
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const val = pickerRef.current?.getValue();
                                setLog((prev) => [...prev.slice(-4), `getValue(): ${val}`]);
                            }}
                        >
                            Get Value
                        </Button>
                    </div>
                </div>
                <pre className="max-h-32 overflow-auto rounded-lg bg-background p-3 font-mono text-xs ring-1 ring-border">
                    {log.length ? log.join('\n') : 'Interact with the buttons above…'}
                </pre>
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Main demo page
// ---------------------------------------------------------------------------

export function OttaDateDemoPage() {
    return (
        <div className="space-y-8 max-w-4xl">
            <DemoPageHeader
                title="OttaDate"
                description="Framework-agnostic date picker with range, datetime, and fuzzy date support. All values are UTC unix timestamps by default."
            />

            {/* Date Picker */}
            <DatePickerDemo />

            {/* Inline Date Picker */}
            <DatePickerInlineDemo />

            {/* Date Range Picker */}
            <DateRangeDemo />

            {/* Date Range with Presets */}
            <DateRangePresetsDemo />

            {/* DateTime Picker */}
            <DateTimeDemo />

            {/* Fuzzy DateTime Picker */}
            <FuzzyDateTimeDemo />

            {/* Fuzzy Inline with Limited Options */}
            <FuzzyDateTimeInlineDemo />

            {/* Fuzzy Compact (dropdown-based) */}
            <FuzzyCompactDemo />

            {/* Fuzzy Compact Inline */}
            <FuzzyCompactInlineDemo />

            {/* Type-to-parse */}
            <FuzzyParseDemo />

            {/* Programmatic API */}
            <ProgrammaticApiDemo />
        </div>
    );
}
