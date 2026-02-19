import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { SpotlightContext, useSpotlightContext } from '../context';

describe('SpotlightContext', () => {
    it('useSpotlightContext throws when used outside provider', () => {
        expect(() => {
            renderHook(() => useSpotlightContext());
        }).toThrow('useSpotlight must be used within SpotlightProvider');
    });

    it('useSpotlightContext returns value when inside provider', () => {
        const value = {
            open: false,
            setOpen: () => {},
            toggle: () => {},
        };
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <SpotlightContext.Provider value={value}>{children}</SpotlightContext.Provider>
        );
        const { result } = renderHook(() => useSpotlightContext(), { wrapper });
        expect(result.current).toBe(value);
        expect(result.current.open).toBe(false);
        expect(typeof result.current.setOpen).toBe('function');
        expect(typeof result.current.toggle).toBe('function');
    });
});
