import { parseDate, type TimeStep } from './data';
import type { Formatter } from './types';

// One Intl.NumberFormat per option set: constructing them is the expensive part.
const cache = new Map<string, Intl.NumberFormat>();
function nf(options: Intl.NumberFormatOptions, locale?: string): Intl.NumberFormat {
    const id = `${locale ?? ''}|${JSON.stringify(options)}`;
    let f = cache.get(id);
    if (!f) {
        f = new Intl.NumberFormat(locale, options);
        cache.set(id, f);
    }
    return f;
}

/** 1234 → "1,234". */
export function formatNumber(value: number, locale?: string): string {
    return nf({ maximumFractionDigits: 2 }, locale).format(value);
}

/** 12_400 → "12.4K", 3_000_000 → "3M". The default axis and tooltip format. */
export function formatCompact(value: number, locale?: string): string {
    return nf({ notation: 'compact', maximumFractionDigits: 1 }, locale).format(value);
}

/** A ratio, not a percentage: 0.125 → "12.5%". */
export function formatPercent(ratio: number, digits = 1, locale?: string): string {
    return nf({ style: 'percent', maximumFractionDigits: digits }, locale).format(ratio);
}

/** 1234.5 → "$1,234.50" (or "$1.2K" with `compact`). */
export function formatCurrency(value: number, currency = 'USD', compact = false, locale?: string): string {
    return nf(
        compact
            ? { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }
            : { style: 'currency', currency },
        locale,
    ).format(value);
}

/** Bind a currency into a `Formatter` for a chart's `valueFormatter`. */
export function currencyFormatter(currency = 'USD', compact = false, locale?: string): Formatter {
    return (value) => formatCurrency(value, currency, compact, locale);
}

const DATE_PARTS: Record<TimeStep, Intl.DateTimeFormatOptions> = {
    hour: { hour: 'numeric' },
    day: { month: 'short', day: 'numeric' },
    week: { month: 'short', day: 'numeric' },
    month: { month: 'short', year: '2-digit' },
};

/**
 * An `indexFormatter` for date columns: "Oct 25", "2 PM", "Oct 26". Defaults to UTC to
 * match the buckets `fillTimeSeries` builds; pass the user's zone for raw timestamps.
 */
export function dateFormatter(
    step: TimeStep = 'day',
    { locale, timeZone = 'UTC' }: { locale?: string; timeZone?: string } = {},
): (value: string) => string {
    const df = new Intl.DateTimeFormat(locale, { ...DATE_PARTS[step], timeZone });
    return (value) => {
        const d = parseDate(value);
        return Number.isNaN(d.getTime()) ? value : df.format(d);
    };
}

/** Change between two readings. `ratio` is null when there is no baseline to divide by. */
export interface Delta {
    change: number;
    ratio: number | null;
    direction: 'up' | 'down' | 'flat';
}

export function delta(current: number, previous: number): Delta {
    const change = current - previous;
    return {
        change,
        ratio: previous === 0 ? null : change / Math.abs(previous),
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    };
}

/** "+12.5%", "−3%", "0%", or "New" when the previous reading was zero. */
export function formatDelta(d: Delta, digits = 1, locale?: string): string {
    if (d.ratio === null) return d.change === 0 ? formatPercent(0, digits, locale) : 'New';
    const text = formatPercent(Math.abs(d.ratio), digits, locale);
    return d.direction === 'up' ? `+${text}` : d.direction === 'down' ? `−${text}` : text;
}
