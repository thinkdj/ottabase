import { describe, expect, it, vi } from 'vitest';
import { REFERRAL_EXPIRY_MS, isReferralExpired, validateReferralUsername } from '../src/validation';

describe('validateReferralUsername', () => {
    it.each(['abc', 'a_b_9', 'x'.repeat(20), '  padded  '])('accepts %j', (name) => {
        expect(validateReferralUsername(name)).toEqual({ valid: true });
    });

    it.each([
        ['', /required/],
        ['   ', /required/],
        ['ab', /at least 3/],
        ['x'.repeat(21), /at most 20/],
        ['bad-name', /letters, numbers, and underscores/],
        ['<script>', /letters, numbers, and underscores/],
    ])('rejects %j', (name, error) => {
        const result = validateReferralUsername(name);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(error);
    });
});

describe('isReferralExpired', () => {
    it('expires only after the 90-day window', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000_000_000_000);
        try {
            expect(isReferralExpired(Date.now() - REFERRAL_EXPIRY_MS)).toBe(false);
            expect(isReferralExpired(Date.now() - REFERRAL_EXPIRY_MS - 1)).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });
});
