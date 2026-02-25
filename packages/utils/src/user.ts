/**
 * User-related utility functions
 */

// Re-export getInitials from string utilities for backward compatibility
export { getInitials } from './string';

/**
 * Minimum / maximum length for a username handle.
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

/** Allowed characters for a username: letters, digits, underscores. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export interface UsernameValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates a public username or referral username handle.
 *
 * Rules:
 * - 3–20 characters
 * - Letters, numbers, and underscores only (`[a-zA-Z0-9_]`)
 * - Cannot be empty or contain only whitespace
 */
export function validateUsername(username: string): UsernameValidationResult {
    if (!username || username.trim().length === 0) {
        return { valid: false, error: 'Username is required' };
    }

    const trimmed = username.trim();

    if (trimmed.length < USERNAME_MIN_LENGTH) {
        return { valid: false, error: `Username must be at least ${USERNAME_MIN_LENGTH} characters` };
    }

    if (trimmed.length > USERNAME_MAX_LENGTH) {
        return { valid: false, error: `Username must be at most ${USERNAME_MAX_LENGTH} characters` };
    }

    if (!USERNAME_PATTERN.test(trimmed)) {
        return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
    }

    return { valid: true };
}
