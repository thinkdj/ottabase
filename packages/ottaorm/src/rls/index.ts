/**
 * Row-Level Security (RLS) System
 *
 * Automatic tenant isolation at the database level
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
 * // Register custom model
 * import { registerPolicy, RLSPolicies } from '@ottabase/ottaorm/rls';
 * registerPolicy({
 *   model: 'my_custom_model',
 *   policy: RLSPolicies.TenantScoped(false),
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
    rlsMiddleware,
    secureCrud,
    type SecureCrudOptions,
} from './secure-crud';

// Logger
export { getRecentViolations, logSecurityViolation } from './logger';
