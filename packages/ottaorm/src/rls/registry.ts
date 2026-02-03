/**
 * RLS Model Registry
 *
 * Pre-configured RLS policies for all models in the system
 */

import { globalRLS } from './engine';
import { RLSPolicies } from './types';
import type { ModelRLSConfig } from './types';

/**
 * Define RLS policies for all models
 */
export const MODEL_POLICIES: ModelRLSConfig[] = [
  // ========================================
  // TENANT-SCOPED MODELS
  // ========================================

  {
    model: 'organizations',
    policy: RLSPolicies.TenantScoped(true), // Allow null for system-level ops
    auditEnabled: true,
  },

  {
    model: 'organization_members',
    policy: RLSPolicies.TenantScoped(false), // Must have org context
    auditEnabled: true,
  },

  {
    model: 'roles',
    policy: RLSPolicies.TenantScoped(true), // System roles have null orgId
    auditEnabled: true,
  },

  {
    model: 'permissions',
    policy: RLSPolicies.TenantScoped(true), // System permissions have null orgId
    auditEnabled: true,
  },

  {
    model: 'user_roles',
    policy: RLSPolicies.TenantScoped(false),
    auditEnabled: true,
  },

  {
    model: 'audit_logs',
    policy: {
      ...RLSPolicies.TenantScoped(true),
      readOnly: true, // Audit logs are append-only
    },
    auditEnabled: false, // Don't audit the audit logs
  },

  // ========================================
  // USER-SCOPED MODELS (No tenant isolation)
  // ========================================

  {
    model: 'users',
    policy: RLSPolicies.OwnerOnly('id'), // Users can only see themselves
    auditEnabled: true,
  },

  {
    model: 'accounts',
    policy: RLSPolicies.UserScoped(),
    auditEnabled: true,
  },

  {
    model: 'sessions',
    policy: RLSPolicies.UserScoped(),
    auditEnabled: false, // Too noisy
  },

  {
    model: 'verification_tokens',
    policy: RLSPolicies.PublicReadOnly(), // Token validation needs read access
    auditEnabled: false,
  },

  // ========================================
  // ADMIN-ONLY MODELS
  // ========================================

  {
    model: 'system_config',
    policy: RLSPolicies.AdminOnly(),
    auditEnabled: true,
  },

  // ========================================
  // CUSTOM POLICIES (Examples)
  // ========================================

  // Example: Posts that belong to org AND created by user
  {
    model: 'posts',
    policy: RLSPolicies.Hierarchical(false), // Tenant + User scoped
    auditEnabled: true,
  },

  // Example: Comments that anyone in org can read, but only owner can edit
  {
    model: 'comments',
    policy: {
      level: 'custom',
      filter: (context) => ({
        organizationId: context.organizationId,
      }),
      // Additional owner check happens in validateWrite
    },
    auditEnabled: true,
  },
];

/**
 * Register all model policies with the global RLS engine
 */
export function registerAllPolicies(): void {
  MODEL_POLICIES.forEach((config) => {
    globalRLS.register(config);
  });
}

/**
 * Register a custom policy (for app-specific models)
 */
export function registerPolicy(config: ModelRLSConfig): void {
  globalRLS.register(config);
}

/**
 * Get all registered models
 */
export function getRegisteredModels(): string[] {
  return globalRLS.getRegisteredModels();
}

/**
 * Initialize RLS system
 */
export function initRLS(): void {
  registerAllPolicies();
  console.log(`✅ RLS initialized: ${getRegisteredModels().length} models registered`);
}
