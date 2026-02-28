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
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
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
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Date Picker</CardTitle>
                <CardDescription>Single date selection. Returns UTC unix timestamp by default.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto">
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
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Inline Date Picker</CardTitle>
                <CardDescription>Always-visible calendar, no popover trigger.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto">
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
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Date Range Picker</CardTitle>
                <CardDescription>
                    Two-calendar layout for start/end selection. Click once for start, again for end.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto">
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
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Date Range — Presets</CardTitle>
                <CardDescription>
                    Sidebar with quick-select presets (Today, Last 7 days, etc.) plus Apply / Cancel flow.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto">
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
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">DateTime Picker</CardTitle>
                <CardDescription>Calendar with time inputs. Combines date and time selection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto">
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
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Fuzzy DateTime Picker</CardTitle>
                <CardDescription>
                    For dates you don't remember exactly. Choose resolution (year, month, day, hour…) and approximation
                    (exact, around, sometime).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                {fuzzy && (
                    <div className="space-y-2">
                        <div className="rounded-md bg-muted p-3 text-sm italic text-center">"{fuzzy.label}"</div>
                        <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto">
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
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Fuzzy DateTime (Inline, Limited Options)</CardTitle>
                <CardDescription>
                    Inline mode with restricted resolutions (year/month/day) and approximations (sometime/around).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} />
                {fuzzy && (
                    <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto">
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
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Fuzzy DateTime (Compact)</CardTitle>
                <CardDescription>
                    Native &lt;select&gt; based layout — space-efficient for forms and sidebars. Auto-applies on change.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} className="max-w-xs" />
                {fuzzy && (
                    <div className="space-y-2">
                        <div className="rounded-md bg-muted p-3 text-sm italic text-center">"{fuzzy.label}"</div>
                        <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto">
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
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Fuzzy Compact (Inline)</CardTitle>
                <CardDescription>
                    Inline compact mode with limited resolutions. Minimal footprint for embedded forms.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div ref={ref} className="max-w-xs" />
                {fuzzy && (
                    <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto">
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
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Programmatic API</CardTitle>
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
                <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto max-h-32">
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
            {/* Header */}
            <div>
                <Link to="/demo" className="text-sm text-muted-foreground hover:underline mb-2 inline-block">
                    ← Back to Demo Gallery
                </Link>
                <h1 className="text-2xl font-bold tracking-tight">OttaDate</h1>
                <p className="text-muted-foreground mt-1">
                    Framework-agnostic date picker with range, datetime, and fuzzy date support. All values are UTC unix
                    timestamps by default.
                </p>
            </div>

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
