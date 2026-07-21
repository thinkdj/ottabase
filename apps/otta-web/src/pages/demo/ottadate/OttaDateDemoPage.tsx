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
    getDefaultRangePresets,
    type DatePickerInstance,
    type DateRange,
    type FuzzyDateTime,
} from '@ottabase/ottadate';
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
                    For dates you only partially remember. Fill in what you know — year, then optionally month, day, and
                    time — and the precision is derived from how deep you go. Re-tap a level to clear it. Every change
                    applies immediately.
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
                resolutions: ['year', 'month', 'day'],
                approximations: ['sometime', 'around'],
            }),
        [],
    );

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">
                    Fuzzy DateTime (Inline, Limited Options)
                </CardTitle>
                <CardDescription>
                    Inline mode with the drill-down capped at day resolution and approximations limited to
                    sometime/around — the time step never appears.
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
                    Sentence-style native selects that read like the stored label — "Sometime · May · 2020". Pick "Any
                    month" / "Any day" to stay coarse. Space-efficient for forms and sidebars; auto-applies on change.
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
                approximations: ['sometime', 'around'],
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

            {/* Programmatic API */}
            <ProgrammaticApiDemo />
        </div>
    );
}
