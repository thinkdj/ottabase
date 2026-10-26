// ---------------------------------------------------------------------------
// Status language (Design System v1)
//
// One map from every enum the platform ships to a tone, a label and an icon.
// Markup never names a colour: it names the state, and every surface (the
// admin, a package's settings panel, a table cell) reads this map.
//
//   green   healthy, active, done        amber  grace, waiting, degraded
//   red     failed, expired, unreachable blue   running, in progress
//   smoke   quiet (disabled, unlicensed, never polled, token unset)
//   neutral no state                     brand  a flag worth noticing
// ---------------------------------------------------------------------------

import {
    BadgeCheck,
    CircleCheck,
    CircleDashed,
    CircleX,
    Clock,
    LoaderCircle,
    Pause,
    RotateCcw,
    TriangleAlert,
    WifiOff,
    type LucideIcon,
} from 'lucide-react';

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'smoke' | 'neutral' | 'brand';

export interface StatusEntry {
    tone: Tone;
    label: string;
    icon: LucideIcon;
}

const entry = (tone: Tone, label: string, icon: LucideIcon): StatusEntry => ({ tone, label, icon });

export const STATUS_LANGUAGE = {
    /** A Premium Package's license (`PremiumState`). */
    license: {
        active: entry('green', 'Active', BadgeCheck),
        grace: entry('amber', 'In grace', Clock),
        expired: entry('red', 'Expired', CircleX),
        invalid: entry('red', 'Invalid key', TriangleAlert),
        unlicensed: entry('smoke', 'Unlicensed', CircleDashed),
        disabled: entry('smoke', 'Disabled', CircleDashed),
    },
    /** A health check, or the whole report. */
    health: {
        ok: entry('green', 'Healthy', CircleCheck),
        fail: entry('red', 'Failing', CircleX),
        unknown: entry('smoke', 'Not reported', CircleDashed),
    },
    /** A cron task's last run. */
    cron: {
        success: entry('green', 'Succeeded', CircleCheck),
        failed: entry('red', 'Failed', CircleX),
        running: entry('blue', 'Running', LoaderCircle),
        paused: entry('smoke', 'Paused', Pause),
        never: entry('neutral', 'Never run', CircleDashed),
    },
    /** An app on the board, as it last answered. */
    fleet: {
        ok: entry('green', 'OK', CircleCheck),
        degraded: entry('amber', 'Degraded', TriangleAlert),
        unreachable: entry('red', 'Unreachable', WifiOff),
        never: entry('smoke', 'Never polled', CircleDashed),
    },
    /** A queue job. */
    job: {
        queued: entry('neutral', 'Queued', Clock),
        running: entry('blue', 'Running', LoaderCircle),
        done: entry('green', 'Done', CircleCheck),
        retrying: entry('amber', 'Retrying', RotateCcw),
        failed: entry('red', 'Failed', CircleX),
    },
    /** A subscription or plan. */
    billing: {
        trial: entry('blue', 'Trial', Clock),
        active: entry('green', 'Active', BadgeCheck),
        canceled: entry('amber', 'Canceled', Clock),
        expired: entry('red', 'Expired', CircleX),
    },
} as const satisfies Record<string, Record<string, StatusEntry>>;

export type StatusDomain = keyof typeof STATUS_LANGUAGE;
export type StatusValue<D extends StatusDomain> = keyof (typeof STATUS_LANGUAGE)[D] & string;

/** Look a state up; an unknown value renders as neutral with the raw value as its label. */
export function statusOf<D extends StatusDomain>(domain: D, value: StatusValue<D> | string): StatusEntry {
    const domainMap = STATUS_LANGUAGE[domain] as Record<string, StatusEntry>;
    return domainMap[value] ?? entry('neutral', value, CircleDashed);
}
