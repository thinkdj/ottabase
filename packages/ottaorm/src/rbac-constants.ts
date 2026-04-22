// ============================================================
// @ottabase/ottaorm - RBAC Constants
// ============================================================

import { DEFAULT_ROLE_NAMES } from './models/DefaultRoles';

/**
 * Virtual platform-level organization scope used for superadmin/platform-owner
 * role assignments. Not a real tenant — no `organization_members` rows are
 * created for this id. Roles granted under this scope apply platform-wide.
 */
export const SYSTEM_ORGANIZATION_ID = 'system';

/**
 * Re-export default role constants from DefaultRoles for centralized access.
 * This avoids duplication across the codebase.
 */
export {
    DEFAULT_ROLE_NAMES,
    DEFAULT_ROLE_NAMES as SYSTEM_ROLE_NAMES,
    type DefaultRoleName,
} from './models/DefaultRoles';
export type { DefaultRoleName as SystemRoleName } from './models/DefaultRoles';

/**
 * Set of system role names for efficient lookups (pre-computed)
 */
export const SYSTEM_ROLE_NAMES_SET = new Set<string>(DEFAULT_ROLE_NAMES);

/**
 * Check if a role name is a system role
 */
export function isSystemRoleName(name: string): boolean {
    return SYSTEM_ROLE_NAMES_SET.has(name);
}
