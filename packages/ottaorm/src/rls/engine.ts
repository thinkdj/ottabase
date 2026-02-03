/**
 * Row-Level Security (RLS) Engine
 *
 * Automatically enforces security policies at the database level
 */

import type {
  SecurityContext,
  RLSPolicy,
  ModelRLSConfig,
  RLSViolation,
} from './types';
import { logSecurityViolation } from './logger';

/**
 * RLS Engine - Core security enforcement
 */
export class RLSEngine {
  private policies: Map<string, ModelRLSConfig> = new Map();

  /**
   * Register a model with its RLS policy
   */
  register(config: ModelRLSConfig): void {
    this.policies.set(config.model, config);
  }

  /**
   * Get policy for a model
   */
  getPolicy(model: string): ModelRLSConfig | undefined {
    return this.policies.get(model);
  }

  /**
   * Apply RLS filters for READ operations
   */
  applyReadFilter(
    model: string,
    context: SecurityContext,
    existingWhere?: Record<string, any>
  ): Record<string, any> {
    const config = this.policies.get(model);
    if (!config) {
      // No policy = no access (secure by default)
      throw new RLSError(`No RLS policy defined for model: ${model}`, {
        type: 'unauthorized_access',
        model,
        context,
      });
    }

    const { policy } = config;

    // Check permissions/roles first
    this.checkAccess(model, context, policy);

    // Generate filter based on policy level
    const rlsFilter = this.generateFilter(policy, context, model);

    // Merge with existing where clause
    return {
      ...existingWhere,
      ...rlsFilter,
    };
  }

  /**
   * Validate WRITE operations (create/update/delete)
   */
  validateWrite(
    model: string,
    context: SecurityContext,
    data: Record<string, any>,
    operation: 'create' | 'update' | 'delete'
  ): void {
    const config = this.policies.get(model);
    if (!config) {
      throw new RLSError(`No RLS policy defined for model: ${model}`, {
        type: 'unauthorized_access',
        model,
        context,
      });
    }

    const { policy } = config;

    // Check if read-only
    if (policy.readOnly) {
      throw new RLSError(`Model ${model} is read-only`, {
        type: 'unauthorized_access',
        model,
        context,
        attemptedAccess: { operation, data },
      });
    }

    // Check permissions/roles
    this.checkAccess(model, context, policy);

    // Validate data matches security context
    this.validateDataIntegrity(model, policy, context, data, operation);
  }

  /**
   * Generate filter based on policy
   */
  private generateFilter(
    policy: RLSPolicy,
    context: SecurityContext,
    model: string
  ): Record<string, any> {
    switch (policy.level) {
      case 'tenant':
        if (!policy.field) {
          throw new RLSError(`Tenant policy requires 'field' definition for ${model}`);
        }
        if (context.organizationId === undefined && !policy.allowNullTenant) {
          throw new RLSError(`Missing organizationId in context for ${model}`, {
            type: 'cross_tenant_read',
            model,
            context,
          });
        }
        return { [policy.field]: context.organizationId };

      case 'user':
        if (!policy.field) {
          throw new RLSError(`User policy requires 'field' definition for ${model}`);
        }
        if (!context.userId) {
          throw new RLSError(`Missing userId in context for ${model}`, {
            type: 'unauthorized_access',
            model,
            context,
          });
        }
        return { [policy.field]: context.userId };

      case 'app':
        if (!policy.field) {
          throw new RLSError(`App policy requires 'field' definition for ${model}`);
        }
        if (!context.appId) {
          throw new RLSError(`Missing appId in context for ${model}`, {
            type: 'unauthorized_access',
            model,
            context,
          });
        }
        return { [policy.field]: context.appId };

      case 'public':
        return {}; // No filtering for public models

      case 'custom':
        if (policy.filter) {
          const customFilter = policy.filter(context);
          if (customFilter === null) {
            throw new RLSError(`Custom filter denied access to ${model}`, {
              type: 'unauthorized_access',
              model,
              context,
            });
          }
          return customFilter;
        }
        return {}; // Custom policy without filter = role/permission check only

      default:
        throw new RLSError(`Unknown security level: ${policy.level}`);
    }
  }

  /**
   * Check role/permission requirements
   */
  private checkAccess(model: string, context: SecurityContext, policy: RLSPolicy): void {
    // Check required roles
    if (policy.requiredRoles && policy.requiredRoles.length > 0) {
      const hasRole = policy.requiredRoles.some(
        (role) => context.roles?.includes(role)
      );
      if (!hasRole) {
        throw new RLSError(
          `Access denied: ${model} requires one of roles: ${policy.requiredRoles.join(', ')}`,
          {
            type: 'permission_denied',
            model,
            context,
          }
        );
      }
    }

    // Check required permissions
    if (policy.requiredPermissions && policy.requiredPermissions.length > 0) {
      const hasPermission = policy.requiredPermissions.every(
        (perm) => context.permissions?.includes(perm)
      );
      if (!hasPermission) {
        throw new RLSError(
          `Access denied: ${model} requires permissions: ${policy.requiredPermissions.join(', ')}`,
          {
            type: 'permission_denied',
            model,
            context,
          }
        );
      }
    }
  }

  /**
   * Validate data integrity (prevent cross-tenant writes)
   */
  private validateDataIntegrity(
    model: string,
    policy: RLSPolicy,
    context: SecurityContext,
    data: Record<string, any>,
    operation: 'create' | 'update' | 'delete'
  ): void {
    // For tenant-scoped models, ensure organizationId matches
    if (policy.level === 'tenant' && policy.field) {
      const dataOrgId = data[policy.field];

      // On CREATE, inject organizationId if not provided
      if (operation === 'create' && dataOrgId === undefined) {
        data[policy.field] = context.organizationId;
      }

      // Validate organizationId matches context
      if (dataOrgId !== undefined && dataOrgId !== context.organizationId) {
        throw new RLSError(
          `Cross-tenant write attempt blocked: data.${policy.field}=${dataOrgId} != context.organizationId=${context.organizationId}`,
          {
            type: 'cross_tenant_write',
            model,
            context,
            attemptedAccess: { operation, data },
          }
        );
      }
    }

    // For user-scoped models, ensure userId matches
    if (policy.level === 'user' && policy.field) {
      const dataUserId = data[policy.field];

      if (operation === 'create' && dataUserId === undefined) {
        data[policy.field] = context.userId;
      }

      if (dataUserId !== undefined && dataUserId !== context.userId) {
        throw new RLSError(
          `User write attempt blocked: data.${policy.field}=${dataUserId} != context.userId=${context.userId}`,
          {
            type: 'unauthorized_access',
            model,
            context,
            attemptedAccess: { operation, data },
          }
        );
      }
    }
  }

  /**
   * Get all registered models
   */
  getRegisteredModels(): string[] {
    return Array.from(this.policies.keys());
  }

  /**
   * Clear all policies (for testing)
   */
  clear(): void {
    this.policies.clear();
  }
}

/**
 * RLS Error with violation details
 */
export class RLSError extends Error {
  public violation?: RLSViolation;

  constructor(message: string, violation?: Partial<RLSViolation>) {
    super(message);
    this.name = 'RLSError';

    if (violation) {
      this.violation = {
        type: violation.type || 'unauthorized_access',
        model: violation.model || 'unknown',
        context: violation.context || {},
        attemptedAccess: violation.attemptedAccess,
        timestamp: Date.now(),
      };

      // Log security violation
      logSecurityViolation(this.violation);
    }
  }
}

/**
 * Global RLS engine instance
 */
export const globalRLS = new RLSEngine();
