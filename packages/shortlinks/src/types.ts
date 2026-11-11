import type { NewShortlinkRecord, ShortlinkRecord } from './ottaorm-models/Shortlink';

export type { NewShortlinkRecord, ShortlinkRecord };

/**
 * What a short code may be: 2 to 50 letters, numbers, dashes or underscores. The model refuses
 * anything else on create and update, so a redirect handler can turn away a path that cannot be
 * a code (`/a/b`, `/favicon.ico`) without asking the database.
 */
export const SHORT_CODE = /^[A-Za-z0-9_-]{2,50}$/;

/**
 * Shortlink type enum for categorization
 */
export const ShortlinkTypes = {
    REDIRECT: 'redirect',
    TRACKING: 'tracking',
    INTERNAL: 'internal',
    EXTERNAL: 'external',
} as const;

export type ShortlinkType = (typeof ShortlinkTypes)[keyof typeof ShortlinkTypes];

/**
 * Request payload for creating a new shortlink
 */
export interface CreateShortlinkRequest {
    fullUrl: string;
    shortCode: string;
    type?: ShortlinkType;
    appId?: string;
    expiryDate?: Date | null;
    interstitialEnabled?: boolean;
    interstitialSeconds?: number | null;
}

/**
 * Request payload for updating an existing shortlink
 */
export interface UpdateShortlinkRequest {
    fullUrl?: string;
    shortCode?: string;
    type?: ShortlinkType;
    expiryDate?: Date | null;
    interstitialEnabled?: boolean;
    interstitialSeconds?: number | null;
}

/**
 * Response for shortlink operations
 */
export interface ShortlinkResponse {
    success: boolean;
    data?: ShortlinkRecord;
    error?: string;
}

// ============================================================
// Pagination Types (Simplified)
// ============================================================

/**
 * Pagination metadata
 */
export interface Pagination {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    next: string | null;
    prev: string | null;
}

/**
 * Paginated response for shortlinks
 */
export interface ShortlinksPaginatedResponse {
    data: ShortlinkRecord[];
    pagination: Pagination;
}

/**
 * Query parameters for paginated shortlink requests
 */
export interface ShortlinksQueryParams {
    page?: number;
    per_page?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    appId?: string;
    type?: ShortlinkType;
    search?: string;
}
