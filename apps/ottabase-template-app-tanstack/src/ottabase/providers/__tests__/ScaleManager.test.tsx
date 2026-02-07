import { act, render } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the scaleAtom module before importing ScaleManager
// vi.hoisted ensures the atom is created before vi.mock (which is hoisted)
// ---------------------------------------------------------------------------

const { testScaleAtom } = vi.hoisted(() => {
    // We need a dynamic import-like atom; jotai's atom is simple enough to inline
    const { atom: createAtom } = require('jotai');
    return { testScaleAtom: createAtom(1.0) };
});

vi.mock('@/ottabase/state/appState', () => ({
    scaleAtom: testScaleAtom,
}));

import { ScaleManager } from '../ScaleManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCALE_STORAGE_KEY = 'ottabase-ui-scale';

function renderWithStore(initialScale = 1.0) {
    const store = createStore();
    store.set(testScaleAtom, initialScale);

    const result = render(
        <Provider store={store}>
            <ScaleManager />
        </Provider>,
    );
    return { ...result, store };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScaleManager', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.style.fontSize = '';
    });

    afterEach(() => {
        document.documentElement.style.fontSize = '';
    });

    it('returns null (renders nothing)', () => {
        const { container } = renderWithStore();
        expect(container.innerHTML).toBe('');
    });

    it('applies default scale (100%) to document root font-size', () => {
        renderWithStore(1.0);
        expect(document.documentElement.style.fontSize).toBe('100%');
    });

    it('applies custom scale to document root font-size', () => {
        renderWithStore(0.75);
        expect(document.documentElement.style.fontSize).toBe('75%');
    });

    it('applies 125% scale', () => {
        renderWithStore(1.25);
        expect(document.documentElement.style.fontSize).toBe('125%');
    });

    it('removes localStorage key when scale is 1.0 (default)', () => {
        // Don't pre-set a stored value — the hydration effect would override 1.0
        renderWithStore(1.0);
        expect(localStorage.getItem(SCALE_STORAGE_KEY)).toBeNull();
    });

    it('persists non-default scale to localStorage', () => {
        renderWithStore(0.8);
        expect(localStorage.getItem(SCALE_STORAGE_KEY)).toBe('0.8');
    });

    it('hydrates scale from localStorage on mount', async () => {
        localStorage.setItem(SCALE_STORAGE_KEY, '1.5');

        const store = createStore();
        store.set(testScaleAtom, 1.0);

        await act(async () => {
            render(
                <Provider store={store}>
                    <ScaleManager />
                </Provider>,
            );
        });

        // The atom should have been updated from localStorage
        expect(store.get(testScaleAtom)).toBe(1.5);
        expect(document.documentElement.style.fontSize).toBe('150%');
    });

    it('ignores invalid localStorage values', async () => {
        localStorage.setItem(SCALE_STORAGE_KEY, 'not-a-number');

        const store = createStore();
        store.set(testScaleAtom, 1.0);

        await act(async () => {
            render(
                <Provider store={store}>
                    <ScaleManager />
                </Provider>,
            );
        });

        // Should stay at default
        expect(store.get(testScaleAtom)).toBe(1.0);
    });

    it('ignores out-of-range localStorage values (too small)', async () => {
        localStorage.setItem(SCALE_STORAGE_KEY, '0.1');

        const store = createStore();
        store.set(testScaleAtom, 1.0);

        await act(async () => {
            render(
                <Provider store={store}>
                    <ScaleManager />
                </Provider>,
            );
        });

        expect(store.get(testScaleAtom)).toBe(1.0);
    });

    it('ignores out-of-range localStorage values (too large)', async () => {
        localStorage.setItem(SCALE_STORAGE_KEY, '5.0');

        const store = createStore();
        store.set(testScaleAtom, 1.0);

        await act(async () => {
            render(
                <Provider store={store}>
                    <ScaleManager />
                </Provider>,
            );
        });

        expect(store.get(testScaleAtom)).toBe(1.0);
    });

    it('resets font-size on unmount', () => {
        const { unmount } = renderWithStore(1.25);
        expect(document.documentElement.style.fontSize).toBe('125%');

        unmount();
        expect(document.documentElement.style.fontSize).toBe('');
    });

    it('updates font-size when scale atom changes', async () => {
        const store = createStore();
        store.set(testScaleAtom, 1.0);

        render(
            <Provider store={store}>
                <ScaleManager />
            </Provider>,
        );

        expect(document.documentElement.style.fontSize).toBe('100%');

        await act(async () => {
            store.set(testScaleAtom, 0.9);
        });

        expect(document.documentElement.style.fontSize).toBe('90%');
    });

    it('rounds percentage to nearest integer', () => {
        renderWithStore(0.833);
        expect(document.documentElement.style.fontSize).toBe('83%');
    });
});
