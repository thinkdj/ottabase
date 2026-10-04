/**
 * Fuzzy date playground for the OttaDate demo page.
 *
 * One live picker with switches for the variants (zoom / compact, panel / form
 * field, decades on / off), one-tap example memories, and a live readout of
 * exactly what gets stored. Every switch remounts the vanilla picker with the
 * current value, so the value survives switching.
 */

import {
    DEFAULT_RESOLUTIONS,
    encodeFuzzyDateTime,
    formatFuzzyRange,
    OttaDate,
    parseFuzzyInput,
    type FuzzyDateTime,
    type FuzzyDateTimePickerInstance,
} from '@ottabase/ottadate';
import { Badge, Button, ToggleGroup, ToggleGroupItem } from '@ottabase/ui-shadcn';
import { useEffect, useRef, useState } from 'react';
import '@ottabase/ottadate/styles.css';

type PickerStyle = 'zoom' | 'compact';
type PickerDisplay = 'panel' | 'field';

const EXAMPLES = [
    'early 90s',
    'summer 98',
    'late may 2010',
    '1996ish',
    'last night',
    '21 july 2026 9pm',
    'winter 2001',
];

const RULES: [string, string][] = [
    ['Browse freely.', 'The title zooms out and the arrows page. Neither changes the value.'],
    ['Tap a cell to name it.', 'A year, month or day becomes the value and the panel zooms into it.'],
    [
        'Chips say how sure you are.',
        'Sometime keeps the whole period. Early, Summer or Night narrow it, drawn as a band.',
    ],
    ['~ Roughly softens the edges.', 'The stored range widens, and the grid hatches the extra time.'],
];

const sectionLabel = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground';

const stamp = (sec: number) => {
    const iso = new Date(sec * 1000).toISOString();
    return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
};

function OptionRow<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: [T, string][];
    onChange: (value: T) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{label}</span>
            <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={value}
                // Radix reports '' when the active item is pressed again; keep the current choice
                onValueChange={(next) => next && onChange(next as T)}
                aria-label={label}
            >
                {options.map(([v, text]) => (
                    <ToggleGroupItem key={v} value={v} className="px-3">
                        {text}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
        </div>
    );
}

function StoredValue({ value }: { value: FuzzyDateTime | null }) {
    const part = value?.part ? value.part.charAt(0).toUpperCase() + value.part.slice(1) : null;
    const rows: [string, string][] = [
        ['Saved as', value ? encodeFuzzyDateTime(value) : 'Not set'],
        ['Earliest', value ? stamp(value.earliest) : 'Not set'],
        ['Latest', value ? stamp(value.latest) : 'Not set'],
    ];

    return (
        <div className="space-y-4 rounded-xl bg-background p-5 ring-1 ring-border" aria-live="polite">
            <div className="space-y-1">
                <p
                    className={`text-balance text-2xl font-semibold tracking-tight ${value ? '' : 'text-muted-foreground'}`}
                >
                    {value ? value.label : 'Nothing picked yet'}
                </p>
                <p className="text-sm tabular-nums text-muted-foreground">
                    {value ? formatFuzzyRange(value) : 'Pick or type something in the picker.'}
                </p>
            </div>

            {value && (
                <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">Precise to {value.resolution}</Badge>
                    <Badge variant={part ? 'default' : 'secondary'}>{part ?? 'No part'}</Badge>
                    <Badge variant={value.approximate ? 'default' : 'secondary'}>
                        {value.approximate ? 'Roughly' : 'Exact edges'}
                    </Badge>
                </div>
            )}

            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                {rows.map(([term, detail]) => (
                    <div key={term} className="contents">
                        <dt className="text-muted-foreground">{term}</dt>
                        <dd className="break-all font-mono text-xs leading-5 tabular-nums">{detail}</dd>
                    </div>
                ))}
            </dl>

            <details>
                <summary className="cursor-pointer text-sm text-muted-foreground">Full value (JSON)</summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/60 p-3 font-mono text-xs">
                    {JSON.stringify(value, null, 2)}
                </pre>
            </details>
        </div>
    );
}

export function FuzzyPlayground() {
    const [style, setStyle] = useState<PickerStyle>('zoom');
    const [display, setDisplay] = useState<PickerDisplay>('panel');
    const [decades, setDecades] = useState(true);
    const [value, setValue] = useState<FuzzyDateTime | null>(() => parseFuzzyInput('summer 98'));

    const hostRef = useRef<HTMLDivElement>(null);
    const pickerRef = useRef<FuzzyDateTimePickerInstance | null>(null);
    // Latest value for (re)mounting; synced before the mount effect below runs
    const valueRef = useRef(value);
    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        const create = style === 'compact' ? OttaDate.createFuzzyDateTimeCompact : OttaDate.createFuzzyDateTimePicker;
        const picker = create(hostRef.current!, {
            inline: display === 'panel',
            value: valueRef.current,
            placeholder: 'When was it?',
            resolutions: decades ? ['decade', ...DEFAULT_RESOLUTIONS] : undefined,
            onChange: setValue,
        });
        pickerRef.current = picker;
        return () => {
            picker.destroy();
            pickerRef.current = null;
        };
    }, [style, display, decades]);

    const toggleDecades = (on: boolean) => {
        // A decade can't live in a year-based field
        if (!on && value?.resolution === 'decade') setValue(null);
        setDecades(on);
    };

    const tryExample = (text: string) => {
        const parsed = parseFuzzyInput(text);
        if (!parsed) return;
        setValue(parsed);
        if (parsed.resolution === 'decade' && !decades)
            setDecades(true); // remounts with the new value
        else pickerRef.current?.setValue(parsed);
    };

    return (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-5">
                <div className="space-y-2">
                    <OptionRow
                        label="Picker"
                        value={style}
                        options={[
                            ['zoom', 'Zoom'],
                            ['compact', 'Compact'],
                        ]}
                        onChange={setStyle}
                    />
                    <OptionRow
                        label="Show as"
                        value={display}
                        options={[
                            ['panel', 'Panel'],
                            ['field', 'Form field'],
                        ]}
                        onChange={setDisplay}
                    />
                    <OptionRow
                        label="Decades"
                        value={decades ? 'on' : 'off'}
                        options={[
                            ['on', 'Allowed'],
                            ['off', 'Off'],
                        ]}
                        onChange={(v) => toggleDecades(v === 'on')}
                    />
                </div>

                {/* The vanilla picker owns this node; React never renders children into it */}
                <div ref={hostRef} className="min-h-10" />

                <div className="space-y-2.5">
                    <p className={sectionLabel}>Try a memory</p>
                    <div className="flex flex-wrap gap-2">
                        {EXAMPLES.map((text) => (
                            <Button
                                key={text}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-full border-dashed font-mono text-xs"
                                onClick={() => tryExample(text)}
                            >
                                {text}
                            </Button>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Tapping one loads it as if typed. You can also type into the picker&apos;s own field.
                    </p>
                </div>
            </div>

            <div className="min-w-0 space-y-6">
                <div className="space-y-2.5">
                    <p className={sectionLabel}>What gets stored</p>
                    <StoredValue value={value} />
                </div>

                <div className="space-y-2.5">
                    <p className={sectionLabel}>How it works</p>
                    <ul className="space-y-3">
                        {RULES.map(([lead, text]) => (
                            <li key={lead} className="text-sm">
                                <span className="font-semibold">{lead}</span>{' '}
                                <span className="text-muted-foreground">{text}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
