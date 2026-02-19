import { createContext, useContext } from 'react';
import type { SpotlightContextValue } from './types';

export const SpotlightContext = createContext<SpotlightContextValue | null>(null);

export function useSpotlightContext() {
    const context = useContext(SpotlightContext);
    if (!context) {
        throw new Error('useSpotlight must be used within SpotlightProvider');
    }
    return context;
}
