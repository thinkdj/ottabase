/**
 * API Client Configuration
 *
 * Centralized settings for the app's API client.
 * Extracted here so all API behavior can be tuned in one place.
 */

/** localStorage key for persisting the current organization ID */
export const CURRENT_ORG_KEY = 'ottabase.current-org-id';

/** Default request timeout in milliseconds */
export const API_TIMEOUT = 30_000;

/** Default base URL for API requests (empty = same origin) */
export const API_BASE_URL = '';
