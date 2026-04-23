// ============================================================
// @ottabase/auth - Shared constants
// ============================================================

/**
 * The "system" organization id — a sentinel used for SaaS-founder / platform
 * admin RBAC rows. Real tenant orgs use UUID-based ids (`org-...`).
 *
 * Everything that previously imported this from `./bootstrap` now imports it
 * from here. The auth package exposes this so that downstream packages
 * (`@ottabase/rbac`) can align their scope checks without duplicating the
 * literal string in three places.
 */
export const SYSTEM_ORGANIZATION_ID = 'system';
