/**
 * Referral-specific validation and username generation helpers.
 *
 * Core username validation lives in `@ottabase/utils/user`.
 */
import { USERNAME_MIN_LENGTH } from '@ottabase/utils/user';

export type { UsernameValidationResult } from '@ottabase/utils/user';
export { validateUsername, USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, USERNAME_PATTERN } from '@ottabase/utils/user';

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
    const atIndex = email.indexOf('@');
    const prefix = atIndex >= 0 ? email.slice(0, atIndex) : email;
    const slug = prefix
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_') // replace invalid chars
        .replace(/_+/g, '_') // collapse multiple underscores
        .replace(/^_+|_+$/g, '') // trim leading/trailing underscores
        .slice(0, 15); // leave room for numeric suffix

    // Ensure minimum length (pad with 'u' to avoid exposing a numeric-only name)
    if (slug.length < USERNAME_MIN_LENGTH) {
        return slug.padEnd(USERNAME_MIN_LENGTH, 'u');
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
