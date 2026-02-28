import { useCallback, useState } from 'react';

/**
 * Safe localStorage access: only runs in browser (typeof window !== 'undefined').
 * Use this hook to avoid duplication and make localStorage usage testable.
 */
function isBrowser(): boolean {
    return typeof window !== 'undefined';
}

export function getLocalStorageItem(key: string): string | null {
    if (!isBrowser()) return null;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function setLocalStorageItem(key: string, value: string): void {
    if (!isBrowser()) return;
    try {
        localStorage.setItem(key, value);
    } catch {
        // ignore
    }
}

/**
 * Hook to sync state with localStorage. Safe for SSR (returns initial value until mount).
 */
export function useLocalStorage<T extends string>(
    key: string,
    initialValue: T | undefined = undefined,
): [T | undefined, (value: T | undefined) => void] {
    const [value, setValue] = useState<T | undefined>(() => {
        const stored = getLocalStorageItem(key);
        return (stored as T) ?? initialValue;
    });

    const setStored = useCallback(
        (next: T | undefined) => {
            setValue(next);
            if (next !== undefined && next !== null) {
                setLocalStorageItem(key, next);
            } else if (isBrowser()) {
                try {
                    localStorage.removeItem(key);
                } catch {
                    // ignore
                }
            }
        },
        [key],
    );

    return [value, setStored];
}
