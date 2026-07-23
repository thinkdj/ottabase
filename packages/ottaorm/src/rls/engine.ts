/**
 * Row-Level Security (RLS) Engine
 *
 * Automatically enforces security policies at the database level
 */

import { hasGrantedPermission } from '@ottabase/utils/permissions';
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
        // Merge with existing where clause. The RLS filter is spread LAST so callers
        // can never widen scope by passing their own value for a security field.
        return {
            ...existingWhere,
            ...this.getReadFilter(model, context),
        };
    }

    /**
     * Compute the pure RLS read filter for a model — without any caller-supplied
     * `where` merged in. Runs role/permission checks. Exposed so the secure CRUD
     * layer can validate the filter's columns against the model BEFORE running a
     * query, and fail closed if a security column is missing (rather than silently
     * dropping the filter and returning unscoped rows).
     */
    getReadFilter(model: string, context: SecurityContext): Record<string, any> {
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
        const filter = this.generateFilter(policy, context, model);

        // Defense-in-depth: a user can only read within organizations they belong to.
        this.enforceOrgMembership(filter?.organizationId, context, model);

        return filter;
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
        return hasGrantedPermission(context.permissions, required);
    }

    /**
     * Check role/permission requirements
     */
    private checkAccess(model: string, context: SecurityContext, policy: RLSPolicy): void {
        // Platform-admin gate (scope-aware — set upstream from a system-scoped grant, never a role name)
        if (policy.requirePlatformAdmin && !context.platformAdmin) {
            throw new RLSError(`Access denied: ${model} requires platform administrator`, {
                type: 'permission_denied',
                model,
                context,
            });
        }

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
     * Defense-in-depth tenant check. When the caller supplies the set of organizations the
     * user actually belongs to (`context.memberOrganizationIds`), refuse any operation scoped
     * to an organization outside that set — closing the "trust the X-Org-Id header" gap.
     *
     * Opt-in by data, and the empty list is meaningful:
     *  - `undefined` → caller didn't resolve membership → no-op (backward compatible).
     *  - `[]`        → caller resolved it and the user belongs to ZERO orgs → fail closed; no
     *                  organization claim can ever be satisfied by an empty set.
     * A null/undefined org (system or single-founder rows) is not a tenant claim and is skipped.
     * Only PLATFORM administrators may act across tenants — gated on the scope-aware
     * `platformAdmin` flag, NOT the `*:*` permission string. Those differ: a platform owner has
     * both, but a stale/org-scoped grant can carry `*:*` (org-level) WITHOUT being a platform
     * admin. Trusting the permission string here would let such a grant bypass the tenant check;
     * gating on `platformAdmin` keeps this consistent with the checkAccess platform gate.
     */
    private enforceOrgMembership(orgId: unknown, context: SecurityContext, model: string): void {
        if (orgId === null || orgId === undefined) return;
        const memberships = context.memberOrganizationIds;
        // Only `undefined` is "membership unknown". An empty array is a real answer ("no orgs"),
        // so it must fall through to the membership check below, which then always fails closed.
        if (!Array.isArray(memberships)) return;
        if (context.platformAdmin) return;
        if (!memberships.includes(orgId as string)) {
            throw new RLSError(
                `Cross-tenant access blocked: organization "${orgId}" is not one of the user's organizations`,
                { type: 'cross_tenant_read', model, context },
            );
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

        // Enforce explicit data-field → context mappings. Needed for custom policies whose
        // read filter field differs from the data field — e.g. organizations are filtered by
        // ownerId, so { ownerId: 'userId' } pins the owner on create and blocks forging it.
        const enforceOnWrite = config.enforceOnWrite ?? {};
        for (const [dataField, contextKey] of Object.entries(enforceOnWrite)) {
            if (!contextKey) continue;
            const contextValue = (context as Record<string, unknown>)[contextKey];

            // Inject on create if missing
            if (operation === 'create' && data[dataField] === undefined && contextValue !== undefined) {
                data[dataField] = contextValue;
            }

            // Validate if provided
            if (data[dataField] !== undefined && data[dataField] !== contextValue) {
                throw new RLSError(
                    `Write ownership check failed: data.${dataField}=${data[dataField]} != context.${contextKey}=${contextValue}`,
                    {
                        type: 'unauthorized_access',
                        model,
                        context,
                        attemptedAccess: { operation, data },
                    },
                );
            }
        }

        // Defense-in-depth: block writes scoped to an organization the user isn't a member of.
        this.enforceOrgMembership(data.organizationId, context, model);
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

            // NOTE: persistence is intentionally NOT done here. Firing an un-awaited async
            // write from a constructor is unreliable on edge runtimes (the isolate can be torn
            // down before it completes) and risks double-logging. The secure CRUD boundary
            // awaits `logSecurityViolation(error.violation)` when it catches an RLSError.
        }
    }
}

/**
 * Global RLS engine instance
 */
export const globalRLS = new RLSEngine();
