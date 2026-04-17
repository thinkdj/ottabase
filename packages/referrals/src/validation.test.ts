import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    REFERRAL_EXPIRY_MS,
    REFERRAL_USERNAME_MAX_LENGTH,
    REFERRAL_USERNAME_MIN_LENGTH,
    isReferralExpired,
    validateReferralUsername,
} from './validation';

describe('referral validation', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('accepts valid usernames including trimmed values', () => {
        expect(validateReferralUsername('valid_user123')).toEqual({ valid: true });
        expect(validateReferralUsername('  valid_user123  ')).toEqual({ valid: true });
    });

    it('rejects empty or whitespace-only usernames', () => {
        expect(validateReferralUsername('')).toEqual({
            valid: false,
            error: 'Referral username is required',
        });
        expect(validateReferralUsername('   ')).toEqual({
            valid: false,
            error: 'Referral username is required',
        });
    });

    it('rejects usernames shorter than the minimum length', () => {
        const tooShort = 'a'.repeat(REFERRAL_USERNAME_MIN_LENGTH - 1);
        expect(validateReferralUsername(tooShort)).toEqual({
            valid: false,
            error: `Referral username must be at least ${REFERRAL_USERNAME_MIN_LENGTH} characters`,
        });
    });

    it('rejects usernames longer than the maximum length', () => {
        const tooLong = 'a'.repeat(REFERRAL_USERNAME_MAX_LENGTH + 1);
        expect(validateReferralUsername(tooLong)).toEqual({
            valid: false,
            error: `Referral username must be at most ${REFERRAL_USERNAME_MAX_LENGTH} characters`,
        });
    });

    it('rejects usernames with unsupported characters', () => {
        expect(validateReferralUsername('invalid-user')).toEqual({
            valid: false,
            error: 'Referral username can only contain letters, numbers, and underscores',
        });
        expect(validateReferralUsername('invalid user')).toEqual({
            valid: false,
            error: 'Referral username can only contain letters, numbers, and underscores',
        });
    });
});

describe('referral expiry', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns false when timestamp is exactly at the expiry boundary', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
        expect(isReferralExpired(1_000_000 - REFERRAL_EXPIRY_MS)).toBe(false);
    });

    it('returns true when timestamp is older than expiry window', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
        expect(isReferralExpired(1_000_000 - REFERRAL_EXPIRY_MS - 1)).toBe(true);
    });
});
