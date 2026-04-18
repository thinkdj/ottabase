/**
 * Row-Level Security (RLS) System
 *
 * Automatic tenant isolation at the database level. Supports permission wildcards
 * (*:*, brand:*, *:edit) for requiredPermissions—same semantics as @ottabase/rbac.
 *
 * @example
 * ```typescript
 * // Initialize RLS (in worker startup)
 * import { initRLS } from '@ottabase/ottaorm/rls';
 * initRLS();
 *
 * // Use secure CRUD (in worker handler)
 * import { rlsMiddleware } from '@ottabase/ottaorm/rls';
 * return rlsMiddleware(request, env);
 *
 * // Register custom model (requiredPermissions uses wildcards: *:*, brand:*)
 * import { registerPolicy, RLSPolicies } from '@ottabase/ottaorm/rls';
 * registerPolicy({
 *   model: 'my_custom_model',
 *   policy: { ...RLSPolicies.AppScoped(), requiredPermissions: ['brand:edit'] },
 *   auditEnabled: true,
 * });
 * ```
 */

// Core engine
export { RLSEngine, RLSError, globalRLS } from './engine';

// Types
export { RLSPolicies } from './types';
export type { ModelRLSConfig, RLSPolicy, RLSViolation, SecurityContext, SecurityLevel } from './types';

// Registry
export { MODEL_POLICIES, getRegisteredModels, initRLS, registerAllPolicies, registerPolicy } from './registry';

// Secure CRUD
export {
    executeSecureCrudRequest,
    extractSecurityContext,
    parseSqliteUniqueConstraintForApi,
    rlsMiddleware,
    secureCrud,
    type SecureCrudOptions,
} from './secure-crud';

// Logger
export { getRecentViolations, logSecurityViolation } from './logger';
