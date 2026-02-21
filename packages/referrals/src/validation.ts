/**
 * Referral-specific validation and username generation helpers.
 *
 * Core username validation has been moved to `@ottabase/utils/user`.
 * This module re-exports it for backward compatibility and adds the
 * referral-domain helpers (generation, expiry).
 */
export type { UsernameValidationResult as ValidationResult } from '@ottabase/utils/user';
export {
    validateUsername,
    USERNAME_MIN_LENGTH as REFERRAL_USERNAME_MIN_LENGTH,
    USERNAME_MAX_LENGTH as REFERRAL_USERNAME_MAX_LENGTH,
    USERNAME_PATTERN as REFERRAL_USERNAME_PATTERN,
} from '@ottabase/utils/user';

/**
 * @deprecated Use {@link validateUsername} from `@ottabase/utils/user` instead.
 * Kept for backward compatibility — validates a referral username using the same rules.
 */
export { validateUsername as validateReferralUsername } from '@ottabase/utils/user';

/**
 * Generate a candidate referral username from an email address.
 *
 * Rules:
 * - Uses the part of the email before `@`
 * - Lowercased; any character outside [a-z0-9_] is replaced with underscore
 * - Leading/trailing underscores and runs of multiple underscores are collapsed
 * - Truncated to at most 15 characters (leaving room for a numeric suffix when deduping)
 * - Guaranteed to pass `validateUsername` (padded to minimum length if necessary)
 *
 * The returned string is a *candidate*; callers must still check for uniqueness in the DB
 * and append a numeric suffix (e.g. `_2`, `_3` …) when a conflict is found.
 */
export function generateReferralUsername(email: string): string {
    const prefix = email.split('@')[0] ?? email;
    const slug = prefix
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_') // replace invalid chars
        .replace(/_+/g, '_') // collapse multiple underscores
        .replace(/^_+|_+$/g, '') // trim leading/trailing underscores
        .slice(0, 15); // leave room for numeric suffix

    // Ensure minimum length (pad with 'u' to avoid exposing a numeric-only name)
    if (slug.length < REFERRAL_USERNAME_MIN_LENGTH) {
        return slug.padEnd(REFERRAL_USERNAME_MIN_LENGTH, 'u');
    }

    return slug;
}

/**
 * Referral code expiry window (in milliseconds)
 * Default: 90 days
 */
export const REFERRAL_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Checks if a referral timestamp has expired
 */
export function isReferralExpired(timestamp: number): boolean {
    return Date.now() - timestamp > REFERRAL_EXPIRY_MS;
}
