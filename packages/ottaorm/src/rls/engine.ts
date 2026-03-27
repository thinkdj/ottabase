/**
 * Row-Level Security (RLS) Engine
 *
 * Automatically enforces security policies at the database level
 */

import { logSecurityViolation } from './logger';
import type { ModelRLSConfig, RLSPolicy, RLSViolation, SecurityContext } from './types';

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
    applyReadFilter(model: string, context: SecurityContext, existingWhere?: Record<string, any>): Record<string, any> {
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
        operation: 'create' | 'update' | 'delete',
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
        this.validateDataIntegrity(model, policy, context, data, operation, config);
    }

    /**
     * Generate filter based on policy
     */
    private generateFilter(policy: RLSPolicy, context: SecurityContext, model: string): Record<string, any> {
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
     * Check if context has permission. Supports wildcards:
     * - *:* grants all (bare * does NOT grant—use *:* for super-admin)
     * - brand:* matches brand:edit, brand:read
     * - *:edit matches posts:edit, brand:edit
     *
     * Only 2-segment (resource:action) permissions are supported.
     * 3+ segment permissions (e.g. brand:edit:admin) are rejected—no wildcard matching.
     */
    private hasPermission(context: SecurityContext, required: string): boolean {
        const perms = context.permissions ?? [];
        if (perms.includes(required)) return true;

        const reqParts = required.split(':');
        if (reqParts.length !== 2) {
            return false; // 3+ segments: no wildcard matching, only exact match (checked above)
        }
        const [reqResource, reqAction] = reqParts;

        for (const perm of perms) {
            const permParts = perm.split(':');
            if (permParts.length !== 2) continue; // Skip malformed/multi-segment; no wildcard from these
            const [permResource, permAction] = permParts;
            if (permResource === '*' && permAction === '*') return true;
            const resourceMatches = permResource === '*' || permResource === reqResource;
            const actionMatches = permAction === '*' || permAction === reqAction;
            if (resourceMatches && actionMatches) return true;
        }
        return false;
    }

    /**
     * Check role/permission requirements
     */
    private checkAccess(model: string, context: SecurityContext, policy: RLSPolicy): void {
        // Check required roles
        if (policy.requiredRoles && policy.requiredRoles.length > 0) {
            const hasRole = policy.requiredRoles.some((role) => context.roles?.includes(role));
            if (!hasRole) {
                throw new RLSError(
                    `Access denied: ${model} requires one of roles: ${policy.requiredRoles.join(', ')}`,
                    {
                        type: 'permission_denied',
                        model,
                        context,
                    },
                );
            }
        }

        // Check required permissions (with wildcard: *:* grants all, brand:* matches brand:edit)
        if (policy.requiredPermissions && policy.requiredPermissions.length > 0) {
            const hasPermission = policy.requiredPermissions.every((perm) => this.hasPermission(context, perm));
            if (!hasPermission) {
                throw new RLSError(
                    `Access denied: ${model} requires permissions: ${policy.requiredPermissions.join(', ')}`,
                    {
                        type: 'permission_denied',
                        model,
                        context,
                    },
                );
            }
        }
    }

    /**
     * Validate data integrity (prevent cross-tenant writes).
     * Note: For UPDATE/DELETE, secure-crud pre-verifies access via applyReadFilter before
     * calling this—so records you cannot read cannot be updated or deleted.
     */
    private validateDataIntegrity(
        model: string,
        policy: RLSPolicy,
        context: SecurityContext,
        data: Record<string, any>,
        operation: 'create' | 'update' | 'delete',
        config: ModelRLSConfig,
    ): void {
        // For tenant-scoped models, ensure organizationId matches
        if (policy.level === 'tenant' && policy.field) {
            if (context.organizationId === undefined && !policy.allowNullTenant) {
                throw new RLSError(`Missing organizationId in context for ${model}`, {
                    type: 'unauthorized_access',
                    model,
                    context,
                    attemptedAccess: { operation, data },
                });
            }

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
                    },
                );
            }
        }

        // For user-scoped models, ensure userId matches
        if (policy.level === 'user' && policy.field) {
            if (!context.userId) {
                throw new RLSError(`Missing userId in context for ${model}`, {
                    type: 'unauthorized_access',
                    model,
                    context,
                    attemptedAccess: { operation, data },
                });
            }

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
                    },
                );
            }
        }

        // For app-scoped models, ensure appId matches
        if (policy.level === 'app' && policy.field) {
            if (!context.appId) {
                throw new RLSError(`Missing appId in context for ${model}`, {
                    type: 'unauthorized_access',
                    model,
                    context,
                    attemptedAccess: { operation, data },
                });
            }

            const dataAppId = data[policy.field];

            if (operation === 'create' && dataAppId === undefined) {
                data[policy.field] = context.appId;
            }

            if (dataAppId !== undefined && dataAppId !== context.appId) {
                throw new RLSError(
                    `Cross-app write attempt blocked: data.${policy.field}=${dataAppId} != context.appId=${context.appId}`,
                    {
                        type: 'cross_tenant_write',
                        model,
                        context,
                        attemptedAccess: { operation, data },
                    },
                );
            }
        }

        // Optional: enforce specific context fields even for custom policies
        const fieldsToEnforce = config.contextFields ?? [];
        for (const field of fieldsToEnforce) {
            const contextValue =
                field === 'organizationId'
                    ? context.organizationId
                    : field === 'appId'
                      ? context.appId
                      : context.userId;

            // Inject on create if missing
            if (operation === 'create' && data[field] === undefined && contextValue !== undefined) {
                data[field] = contextValue;
            }

            // Validate if provided
            if (data[field] !== undefined && data[field] !== contextValue) {
                throw new RLSError(
                    `Context enforcement failed: data.${field}=${data[field]} != context.${field}=${contextValue}`,
                    {
                        type: field === 'organizationId' ? 'cross_tenant_write' : 'unauthorized_access',
                        model,
                        context,
                        attemptedAccess: { operation, data },
                    },
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
