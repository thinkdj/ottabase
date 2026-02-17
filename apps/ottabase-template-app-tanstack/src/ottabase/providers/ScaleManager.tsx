/**
 * Scale Manager
 *
 * Applies the scaleAtom value to document.documentElement.style.fontSize
 * so that all rem-based sizing scales proportionally across the app.
 *
 * scale 1.0  → font-size: 100% (16px default)
 * scale 0.75 → font-size: 75%  (12px)
 * scale 1.25 → font-size: 125% (20px)
 *
 * Also persists the scale to localStorage so it survives page reloads.
 */
import { scaleAtom } from '@/ottabase/state/appState';
import { useAtom } from 'jotai';
import { useEffect } from 'react';

const SCALE_STORAGE_KEY = 'ottabase.ui-scale';

export function ScaleManager(): null {
    const [scale, setScale] = useAtom(scaleAtom);

    // Hydrate from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(SCALE_STORAGE_KEY);
            if (stored) {
                const parsed = parseFloat(stored);
                if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2) {
                    setScale(parsed);
                }
            }
        } catch {
            // storage unavailable
        }
    }, [setScale]);

    // Apply scale to document root and persist
    useEffect(() => {
        const pct = Math.round(scale * 100);
        document.documentElement.style.fontSize = `${pct}%`;

        try {
            if (scale === 1.0) {
                localStorage.removeItem(SCALE_STORAGE_KEY);
            } else {
                localStorage.setItem(SCALE_STORAGE_KEY, String(scale));
            }
        } catch {
            // storage full
        }

        return () => {
            // Reset on unmount (e.g. HMR)
            document.documentElement.style.fontSize = '';
        };
    }, [scale]);

    return null;
}
