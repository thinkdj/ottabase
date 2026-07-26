import type { TokenMotion } from '@ottabase/brand-engine';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Checkbox,
    Label,
    NativeSelect,
    NativeSelectOption,
    Switch,
} from '@ottabase/ui-shadcn';
import { IconPlayerPlayFilled } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface BrandKitMotionTabProps {
    tokensJson: string;
    onTokensChange: (tokensJson: string) => void;
}

const EASING_OPTIONS = [
    { value: 'cubic-bezier(0.4, 0, 0.2, 1)', label: 'Normal (ease-in-out)' },
    { value: 'cubic-bezier(0, 0, 0.2, 1)', label: 'Enter (ease-out)' },
    { value: 'cubic-bezier(0.4, 0, 1, 1)', label: 'Exit (ease-in)' },
    { value: 'linear', label: 'Linear' },
    { value: 'cubic-bezier(0.34, 1.56, 0.64, 1)', label: 'Bouncy' },
];

// Preview keyframes. `left` (not transform) drives the travel rails so a runner
// always stops exactly at the end of its track regardless of the rail's width.
const MOTION_KEYFRAMES = `
@keyframes motion-preview-travel { from { left: 0; } to { left: calc(100% - 0.75rem); } }
@keyframes motion-preview-enter { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes motion-preview-exit { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(-10px) scale(.96); } }
@keyframes motion-preview-grow { from { width: 8%; } to { width: 100%; } }
`;

/**
 * A play-head travelling a timeline hairline. Deliberately not a dot on a filled
 * pill — that reads as a range slider the user can drag, which this is not.
 */
function TravelTrack({
    duration,
    easing,
    runKey,
    label,
    muted,
}: {
    duration: number;
    easing: string;
    runKey: number;
    /** Distinguishes the remount key when several tracks share a parent */
    label: string;
    /** Ghost styling for the linear reference run */
    muted?: boolean;
}) {
    return (
        <div className="relative h-4 w-full">
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
            <span className="absolute left-0 top-1/2 h-2 w-px -translate-y-1/2 bg-border" />
            <span className="absolute right-0 top-1/2 h-2 w-px -translate-y-1/2 bg-border" />
            <IconPlayerPlayFilled
                key={`${label}-${runKey}`}
                className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 ${
                    muted ? 'text-muted-foreground/40' : 'text-primary'
                }`}
                style={{ animation: `motion-preview-travel ${duration}ms ${easing} forwards` }}
            />
        </div>
    );
}

/** Control points of a `cubic-bezier(a, b, c, d)` value; null for keywords like `linear` */
function parseCubicBezier(value: string): [number, number, number, number] | null {
    const match = value.match(/cubic-bezier\(([^)]+)\)/i);
    if (!match) return null;
    const parts = match[1].split(',').map((n) => Number.parseFloat(n.trim()));
    return parts.length === 4 && parts.every((n) => Number.isFinite(n))
        ? (parts as [number, number, number, number])
        : null;
}

/** Plot an easing as its bezier curve, with a runner that travels a rail using that same curve */
function EasingCard({
    title,
    value,
    duration,
    runKey,
}: {
    title: string;
    value: string;
    duration: number;
    runKey: number;
}) {
    const points = parseCubicBezier(value);
    // The unit square maps to 0..100; y is flipped because SVG grows downward.
    const path = points
        ? `M0 100 C ${points[0] * 100} ${100 - points[1] * 100} ${points[2] * 100} ${100 - points[3] * 100} 100 0`
        : 'M0 100 L100 0';
    const label = EASING_OPTIONS.find((o) => o.value === value)?.label ?? value;

    return (
        <div className="flex flex-col gap-2 rounded-lg bg-background p-3 ring-1 ring-border">
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium">{title}</span>
                <span className="truncate text-[10px] text-muted-foreground">{label}</span>
            </div>
            {/* Curve: steep = fast, flat = slow. Overshoot (bouncy) escapes the dashed unit square. */}
            <svg viewBox="-8 -34 116 168" className="h-16 w-full" aria-hidden="true">
                <rect
                    x="0"
                    y="0"
                    width="100"
                    height="100"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    className="text-border"
                />
                <path d={path} fill="none" stroke="currentColor" strokeWidth="3" className="text-primary" />
            </svg>
            {/* Same curve, felt instead of read: eased run on top, linear ghost below */}
            <div className="space-y-0.5">
                <TravelTrack duration={duration} easing={value} runKey={runKey} label={`eased-${title}`} />
                <TravelTrack duration={duration} easing="linear" runKey={runKey} label={`linear-${title}`} muted />
                <p className="text-[10px] text-muted-foreground">vs linear · {duration}ms</p>
            </div>
        </div>
    );
}

interface MotionPreviewProps {
    durations: { fast: number; normal: number; slow: number };
    easing: string;
    easingEnter: string;
    easingExit: string;
    disabled: boolean;
}

/**
 * Motion preview: three things the tokens actually control, shown together —
 * how the durations compare, what each easing curve does, and how they read on
 * real UI. Everything replays in sync, and re-runs whenever a token changes.
 */
function MotionPreview({ durations, easing, easingEnter, easingExit, disabled }: MotionPreviewProps) {
    const [runKey, setRunKey] = useState(0);
    const { fast, normal, slow } = durations;

    // Re-run on every token tweak so dragging a slider is immediately felt
    useEffect(() => {
        setRunKey((k) => k + 1);
    }, [fast, normal, slow, easing, easingEnter, easingExit, disabled]);

    const dur = (ms: number) => (disabled ? 0 : ms);
    const tracks = [
        { name: 'Fast', ms: fast, hint: 'hovers, toggles, ripples' },
        { name: 'Normal', ms: normal, hint: 'dropdowns, tabs, toasts' },
        { name: 'Slow', ms: slow, hint: 'drawers, modals, page moves' },
    ];

    return (
        <div className="space-y-3 rounded-lg bg-background p-4 ring-1 ring-border">
            <style>{MOTION_KEYFRAMES}</style>
            <div className="flex items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-medium">Preview</p>
                    <p className="text-xs text-muted-foreground">
                        {disabled
                            ? 'Animations are disabled — everything snaps to its end state.'
                            : 'All three tracks start together, so the gaps are the durations.'}
                    </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setRunKey((k) => k + 1)}>
                    <IconPlayerPlayFilled className="mr-1 h-3 w-3" />
                    Replay
                </Button>
            </div>

            {/* 1. Durations, raced side by side */}
            <div className="space-y-2 rounded-md bg-muted/40 p-3">
                {tracks.map((track) => (
                    <div key={track.name} className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-[11px] font-medium">{track.name}</span>
                        <div className="flex-1">
                            <TravelTrack duration={dur(track.ms)} easing={easing} runKey={runKey} label={track.name} />
                        </div>
                        <span className="w-32 shrink-0 text-right text-[10px] text-muted-foreground">
                            {track.ms}ms · {track.hint}
                        </span>
                    </div>
                ))}
            </div>

            {/* 2. The easing curves themselves */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <EasingCard title="Default" value={easing} duration={dur(normal)} runKey={runKey} />
                <EasingCard title="Enter" value={easingEnter} duration={dur(normal)} runKey={runKey} />
                <EasingCard title="Exit" value={easingExit} duration={dur(normal)} runKey={runKey} />
            </div>

            {/* 3. The same tokens on real UI */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-md bg-muted/40 p-3">
                    <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Toast enters · normal + enter
                    </p>
                    <div
                        key={`enter-${runKey}`}
                        className="rounded-md bg-background px-2 py-1.5 text-xs shadow-sm ring-1 ring-border"
                        style={{ animation: `motion-preview-enter ${dur(normal)}ms ${easingEnter} both` }}
                    >
                        Changes saved
                    </div>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                    <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Banner leaves · fast + exit
                    </p>
                    <div
                        key={`exit-${runKey}`}
                        className="rounded-md bg-background px-2 py-1.5 text-xs shadow-sm ring-1 ring-border"
                        style={{ animation: `motion-preview-exit ${dur(fast)}ms ${easingExit} 600ms both` }}
                    >
                        Dismissing…
                    </div>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                    <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Progress fills · slow + default
                    </p>
                    <div className="h-6 overflow-hidden rounded-md bg-background ring-1 ring-border">
                        <div
                            key={`grow-${runKey}`}
                            className="h-full rounded-md bg-primary/80"
                            style={{ animation: `motion-preview-grow ${dur(slow)}ms ${easing} forwards` }}
                        />
                    </div>
                </div>
            </div>

            {/* 4. Hover target — transitions, not keyframes, are what most UI actually uses */}
            <div className="group flex items-center justify-between gap-3 rounded-md bg-muted/40 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Hover me · fast + default easing
                </p>
                <span
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm group-hover:-translate-y-0.5 group-hover:shadow-md"
                    style={{ transition: `transform ${dur(fast)}ms ${easing}, box-shadow ${dur(fast)}ms ${easing}` }}
                >
                    Button content
                </span>
            </div>
        </div>
    );
}

export function BrandKitMotionTab({ tokensJson, onTokensChange }: BrandKitMotionTabProps) {
    // Parse the current motion token from JSON
    const parsed = useMemo(() => {
        try {
            const p = JSON.parse(tokensJson || '{}') as { motion?: any };
            return p.motion || {};
        } catch {
            return {};
        }
    }, [tokensJson]);

    // Check if motion is split into light/dark mode
    const isSplitMode = useMemo(() => {
        return Boolean(parsed.light || parsed.dark);
    }, [parsed]);

    const activeLight = isSplitMode ? parsed.light || {} : parsed;
    const activeDark = isSplitMode ? parsed.dark || activeLight : activeLight;

    const handleOverrideToggle = useCallback(
        (enabled: boolean) => {
            if (!enabled) {
                // Revert back to single unified mode. Take light as the source of truth.
                try {
                    const p = JSON.parse(tokensJson || '{}');
                    const lightConfig = p.motion?.light || {};
                    p.motion = { ...lightConfig };
                    onTokensChange(JSON.stringify(p, null, 2));
                } catch {
                    onTokensChange('{}');
                }
            } else {
                // Split into light and dark
                try {
                    const p = JSON.parse(tokensJson || '{}');
                    const baseConfig = p.motion || {};
                    p.motion = {
                        light: { ...baseConfig },
                        dark: { ...baseConfig },
                    };
                    onTokensChange(JSON.stringify(p, null, 2));
                } catch {
                    onTokensChange('{}');
                }
            }
        },
        [tokensJson, onTokensChange],
    );

    const handleUpdate = (mode: 'light' | 'dark' | 'shared', updates: Partial<TokenMotion>) => {
        try {
            const p = JSON.parse(tokensJson || '{}');
            p.motion = p.motion || {};

            if (mode === 'shared') {
                p.motion = { ...p.motion, ...updates };
            } else {
                p.motion[mode] = { ...(p.motion[mode] || {}), ...updates };
            }
            onTokensChange(JSON.stringify(p, null, 2));
        } catch {
            // Ignore parse errors on manual input
        }
    };

    const renderControls = (mode: 'light' | 'dark' | 'shared', config: Partial<TokenMotion>) => {
        const dFast = parseInt(config.durationFast || '100', 10);
        const dNormal = parseInt(config.durationNormal || '200', 10);
        const dSlow = parseInt(config.durationSlow || '400', 10);
        const easing = config.easing || 'cubic-bezier(0.4, 0, 0.2, 1)';
        const easingEnter = config.easingEnter || 'cubic-bezier(0, 0, 0.2, 1)';
        const easingExit = config.easingExit || 'cubic-bezier(0.4, 0, 1, 1)';
        const disableAnimations = Boolean(config.disableAnimations);

        return (
            <div className="space-y-4 rounded-lg bg-background p-4 ring-1 ring-border">
                {mode !== 'shared' && <h3 className="font-semibold text-sm capitalize mb-2">{mode} Mode Overrides</h3>}

                <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
                    <Checkbox
                        id={`disable-animations-${mode}`}
                        checked={disableAnimations}
                        onCheckedChange={(c) => handleUpdate(mode, { disableAnimations: c === true })}
                        className="mt-0.5"
                    />
                    <div className="grid gap-1">
                        <Label htmlFor={`disable-animations-${mode}`} className="cursor-pointer text-sm">
                            Disable animations
                        </Label>
                        <p className="text-xs text-muted-foreground">Sets duration vars to 0s for reduced motion.</p>
                    </div>
                </div>

                {/* Disabling animations makes every duration 0 — dim and lock the tokens they'd control */}
                <fieldset
                    disabled={disableAnimations}
                    className={`space-y-4 border-0 p-0 ${disableAnimations ? 'pointer-events-none opacity-50' : ''}`}
                >
                    {/* Preview sits above the controls so a slider drag is felt without scrolling */}
                    <MotionPreview
                        durations={{ fast: dFast, normal: dNormal, slow: dSlow }}
                        easing={easing}
                        easingEnter={easingEnter}
                        easingExit={easingExit}
                        disabled={disableAnimations}
                    />

                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Fast Duration ({dFast}ms)</Label>
                        <input
                            type="range"
                            min="50"
                            max="500"
                            step="10"
                            value={dFast}
                            onChange={(e) => handleUpdate(mode, { durationFast: `${e.target.value}ms` })}
                            className="w-full accent-primary"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Normal Duration ({dNormal}ms)</Label>
                        <input
                            type="range"
                            min="100"
                            max="1000"
                            step="10"
                            value={dNormal}
                            onChange={(e) => handleUpdate(mode, { durationNormal: `${e.target.value}ms` })}
                            className="w-full accent-primary"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Slow Duration ({dSlow}ms)</Label>
                        <input
                            type="range"
                            min="200"
                            max="2000"
                            step="10"
                            value={dSlow}
                            onChange={(e) => handleUpdate(mode, { durationSlow: `${e.target.value}ms` })}
                            className="w-full accent-primary"
                        />
                    </div>
                    <div className="space-y-2 pt-2">
                        <Label className="text-muted-foreground">Default Easing</Label>
                        <NativeSelect
                            value={easing}
                            onChange={(e) => handleUpdate(mode, { easing: e.target.value })}
                            wrapperClassName="w-full"
                        >
                            {EASING_OPTIONS.map((opt) => (
                                <NativeSelectOption key={opt.value} value={opt.value}>
                                    {opt.label}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Enter Easing</Label>
                        <NativeSelect
                            value={easingEnter}
                            onChange={(e) => handleUpdate(mode, { easingEnter: e.target.value })}
                            wrapperClassName="w-full"
                        >
                            {EASING_OPTIONS.map((opt) => (
                                <NativeSelectOption key={opt.value} value={opt.value}>
                                    {opt.label}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">Exit Easing</Label>
                        <NativeSelect
                            value={easingExit}
                            onChange={(e) => handleUpdate(mode, { easingExit: e.target.value })}
                            wrapperClassName="w-full"
                        >
                            {EASING_OPTIONS.map((opt) => (
                                <NativeSelectOption key={opt.value} value={opt.value}>
                                    {opt.label}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>
                </fieldset>
            </div>
        );
    };

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Motion &amp; Animation</CardTitle>
                <CardDescription className="leading-relaxed">
                    Configure transition speeds and easing curves across the UI. You can define a separate set of
                    animation tokens specifically for users in dark mode.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg bg-background p-4 ring-1 ring-border">
                    <div>
                        <Label>Different for dark mode</Label>
                        <p className="text-xs text-muted-foreground">
                            Define entirely separate motion configs for light vs dark mode environments.
                        </p>
                    </div>
                    <Switch checked={isSplitMode} onCheckedChange={handleOverrideToggle} />
                </div>

                {!isSplitMode ? (
                    renderControls('shared', activeLight)
                ) : (
                    // Stacked, not side by side — each preview needs the full width to read
                    <div className="grid grid-cols-1 gap-4">
                        {renderControls('light', activeLight)}
                        {renderControls('dark', activeDark)}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
