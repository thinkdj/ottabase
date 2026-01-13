import type { NewReferral, Referral } from "./schema";

export type { NewReferral, Referral };

/**
 * Configuration options for the ReferralProvider
 */
export interface ReferralProviderConfig {
  /**
   * Storage key for localStorage
   * @default "ottabase.referral"
   */
  storageKey?: string;

  /**
   * Query parameter name to check for referrer code
   * @default "referrer"
   */
  queryParam?: string;

  /**
   * Whether to override existing referral with new one
   * When true, latest referral code always overrides previous
   * When false, first referral is preserved
   * @default true
   */
  overrideReferral?: boolean;

  /**
   * Expiry time in milliseconds for referral code
   * After this time, referral code is cleared from storage
   * Set to 0 or null to never expire
   * @default 2592000000 (30 days)
   */
  expiryMs?: number | null;

  /**
   * App name identifier for multi-tenant support
   * @default "default"
   */
  appName?: string;

  /**
   * Custom callback when referral code is detected
   */
  onReferralDetected?: (referrerCode: string) => void;

  /**
   * Custom callback when referral code is cleared
   */
  onReferralCleared?: () => void;

  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Referral data stored in localStorage
 */
export interface ReferralData {
  /**
   * The referrer code
   */
  referrerCode: string;

  /**
   * Timestamp when referral was first captured
   */
  capturedAt: number;

  /**
   * Timestamp when referral expires
   */
  expiresAt: number | null;

  /**
   * Source URL where referral was captured
   */
  sourceUrl?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Context value provided by ReferralProvider
 */
export interface ReferralContextValue {
  /**
   * Current referral data
   */
  referralData: ReferralData | null;

  /**
   * Current referrer code (shorthand for referralData?.referrerCode)
   */
  referrerCode: string | null;

  /**
   * Whether a referral code is currently active
   */
  hasReferral: boolean;

  /**
   * Manually set a referral code
   */
  setReferral: (code: string, metadata?: Record<string, unknown>) => void;

  /**
   * Clear the current referral
   */
  clearReferral: () => void;

  /**
   * Check if referral has expired
   */
  isExpired: () => boolean;

  /**
   * Get time remaining until expiry (in ms), or null if no expiry
   */
  getTimeRemaining: () => number | null;
}

/**
 * Request payload for creating a referral record
 */
export interface CreateReferralRequest {
  referrerCode: string;
  referredUserId?: string;
  appName?: string;
  source?: string;
  landingUrl?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request payload for updating a referral (e.g., marking as converted)
 */
export interface UpdateReferralRequest {
  referredUserId?: string;
  converted?: boolean;
  convertedAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Response for referral operations
 */
export interface ReferralResponse {
  success: boolean;
  data?: Referral;
  error?: string;
}

/**
 * Response for list operations
 */
export interface ReferralsListResponse {
  success: boolean;
  data?: Referral[];
  total?: number;
  error?: string;
}

/**
 * Referral source types
 */
export const ReferralSources = {
  LINK: "link",
  QR: "qr",
  EMAIL: "email",
  SOCIAL: "social",
  OTHER: "other",
} as const;

export type ReferralSource =
  (typeof ReferralSources)[keyof typeof ReferralSources];
