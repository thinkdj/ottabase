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
 * Validates a referral username
 *
 * Rules:
 * - 3-20 characters
 * - Letters, numbers, and underscores only
 * - Cannot be empty or just whitespace
 */
export function validateReferralUsername(username: string): ValidationResult {
  if (!username || username.trim().length === 0) {
    return {
      valid: false,
      error: "Referral username is required",
    };
  }

  const trimmed = username.trim();

  if (trimmed.length < REFERRAL_USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Referral username must be at least ${REFERRAL_USERNAME_MIN_LENGTH} characters`,
    };
  }

  if (trimmed.length > REFERRAL_USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Referral username must be at most ${REFERRAL_USERNAME_MAX_LENGTH} characters`,
    };
  }

  if (!REFERRAL_USERNAME_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: "Referral username can only contain letters, numbers, and underscores",
    };
  }

  return {
    valid: true,
  };
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
