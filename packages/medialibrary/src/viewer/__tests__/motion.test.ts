import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion } from '../motion';

function stubMatchMedia(reduce: boolean) {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce') }));
}

describe('prefersReducedMotion', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.documentElement.style.removeProperty('--motion-duration-normal');
    });

    it('follows the OS reduced-motion preference', () => {
        stubMatchMedia(true);
        expect(prefersReducedMotion()).toBe(true);
    });

    it('follows a brand kit that zeroes the motion tokens', () => {
        stubMatchMedia(false);
        document.documentElement.style.setProperty('--motion-duration-normal', '0s');
        expect(prefersReducedMotion()).toBe(true);
    });

    it('animates when the token is unset or non-zero', () => {
        stubMatchMedia(false);
        expect(prefersReducedMotion()).toBe(false);
        document.documentElement.style.setProperty('--motion-duration-normal', '200ms');
        expect(prefersReducedMotion()).toBe(false);
    });
});
