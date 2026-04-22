// ============================================================
// @ottabase/ottaorm - RBAC Constants
// ============================================================

/**
 * Re-export default role constants from DefaultRoles for centralized access.
 * This avoids duplication across the codebase.
 */
export { DEFAULT_ROLE_NAMES, type DefaultRoleName } from './models/DefaultRoles';
export { DEFAULT_ROLE_NAMES as SYSTEM_ROLE_NAMES } from './models/DefaultRoles';
export type { DefaultRoleName as SystemRoleName } from './models/DefaultRoles';

/**
 * Set of system role names for efficient lookups (pre-computed)
 */
export const SYSTEM_ROLE_NAMES_SET = new Set<string>(['owner', 'admin', 'member', 'viewer']);

/**
 * Check if a role name is a system role
 */
export function isSystemRoleName(name: string): boolean {
    return SYSTEM_ROLE_NAMES_SET.has(name);
}

