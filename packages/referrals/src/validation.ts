/**
 * Referral username validation rules
 */
export const REFERRAL_USERNAME_MIN_LENGTH = 3;
export const REFERRAL_USERNAME_MAX_LENGTH = 20;
export const REFERRAL_USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates a username (public handle or referral username).
 *
 * Rules:
 * - 3-20 characters
 * - Letters, numbers, and underscores only
 * - Cannot be empty or just whitespace
 */
export function validateUsername(username: string): ValidationResult {
    if (!username || username.trim().length === 0) {
        return {
            valid: false,
            error: 'Username is required',
        };
    }

    const trimmed = username.trim();

    if (trimmed.length < REFERRAL_USERNAME_MIN_LENGTH) {
        return {
            valid: false,
            error: `Username must be at least ${REFERRAL_USERNAME_MIN_LENGTH} characters`,
        };
    }

    if (trimmed.length > REFERRAL_USERNAME_MAX_LENGTH) {
        return {
            valid: false,
            error: `Username must be at most ${REFERRAL_USERNAME_MAX_LENGTH} characters`,
        };
    }

    if (!REFERRAL_USERNAME_PATTERN.test(trimmed)) {
        return {
            valid: false,
            error: 'Username can only contain letters, numbers, and underscores',
        };
    }

    return {
        valid: true,
    };
}

/**
 * @deprecated Use {@link validateUsername} instead.
 * Kept for backward compatibility — validates a referral username using the same rules.
 */
export const validateReferralUsername = validateUsername;

/**
 * Generate a candidate referral username from an email address (and optional display name).
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
