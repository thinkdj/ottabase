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
export { RLSEngine, globalRLS, RLSError } from './engine';

// Types
export type {
  SecurityContext,
  RLSPolicy,
  ModelRLSConfig,
  RLSViolation,
  SecurityLevel,
} from './types';
export { RLSPolicies } from './types';

// Registry
export {
  MODEL_POLICIES,
  registerAllPolicies,
  registerPolicy,
  getRegisteredModels,
  initRLS,
} from './registry';

// Secure CRUD
export {
  secureCrud,
  extractSecurityContext,
  rlsMiddleware,
  type SecureCrudOptions,
} from './secure-crud';

// Logger
export { logSecurityViolation, getRecentViolations } from './logger';
