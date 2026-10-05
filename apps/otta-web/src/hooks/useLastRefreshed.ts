import { useEffect, useState } from 'react';

/**
 * Returns a human-readable relative time string for a Unix ms timestamp.
 * Exported for use in other contexts (e.g. audit log entry times).
 */
export function timeAgo(ms: number): string {
    const seconds = Math.floor((Date.now() - ms) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

/** "in 5m", "in 2h", "in 3d" for a future Unix ms timestamp; a past one reads as timeAgo. */
export function timeUntil(ms: number): string {
    const seconds = Math.floor((ms - Date.now()) / 1000);
    if (seconds < 0) return timeAgo(ms);
    if (seconds < 60) return 'in under a minute';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `in ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `in ${days}d`;
    return `in ${Math.floor(days / 30)}mo`;
}

/**
 * Tracks when data was last refreshed and provides a live "Last refreshed X ago" label.
 *
 * - Ticks every 60 seconds (not every second) to keep re-renders minimal.
 * - Call `touch()` after a successful refetch to update the timestamp.
 * - Pass `isReady` (e.g. `!isLoading && !error`) to auto-set the timestamp on first load.
 *
 * @example
 * const { label, touch } = useLastRefreshed({ isReady: !isLoading && !error });
 * const handleRefresh = async () => { await refetch(); touch(); };
 */
export function useLastRefreshed({ isReady = false }: { isReady?: boolean } = {}) {
    const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
    // Tick state used only to trigger a re-render so the label stays up-to-date.
    const [, setTick] = useState(() => Date.now());

    // Auto-stamp on first successful load.
    useEffect(() => {
        if (isReady && lastRefreshedAt === null) {
            setLastRefreshedAt(Date.now());
        }
    }, [isReady, lastRefreshedAt]);

    // Re-render every minute so the relative label updates.
    useEffect(() => {
        const interval = setInterval(() => setTick(Date.now()), 60_000);
        return () => clearInterval(interval);
    }, []);

    /** Call after a manual refetch to stamp the new refresh time. */
    const touch = () => setLastRefreshedAt(Date.now());

    const label = lastRefreshedAt ? `Last refreshed ${timeAgo(lastRefreshedAt)}` : 'Not refreshed yet';

    return { lastRefreshedAt, label, touch };
}
