/**
 * TanStack Query hooks for RBAC operations
 * Provides optimistic updates, cache invalidation, and error handling
 *
 * Cache layer: all queries and mutations route through the framework's
 * standard cache — createModelHooks for ottaorm CRUD, useApiQuery for
 * the custom audit-log endpoint, and raw useMutation with meta.entity
 * for the five hooks that carry optimistic updates.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createModelHooks, useApiQuery } from '@ottabase/ottaorm/client';
import { api } from '@/lib/api';
import type {
    OrganizationRecord,
    OrganizationMemberRecord,
    RoleRecord,
    AuditLogRecord,
    MemberRole,
} from '@/types/rbac';

// ============================================================================
// Model hook instances
// ============================================================================

const organizationHooks = createModelHooks<OrganizationRecord>({ entityName: 'organizations' });
const orgMemberHooks = createModelHooks<OrganizationMemberRecord>({ entityName: 'organization_members' });
const roleHooks = createModelHooks<RoleRecord>({ entityName: 'roles' });

// ============================================================================
// API Response Types
// ============================================================================

interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}

// ============================================================================
// Organizations — Query Hooks
// ============================================================================

export function useOrganizations() {
    return organizationHooks.useList();
}

export function useOrganization(id: string) {
    return organizationHooks.useDetail(id);
}

// ============================================================================
// Organizations — Mutation Hooks (with optimistic updates)
// ============================================================================

export function useCreateOrganization() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organizations' },
        mutationFn: async (data: Partial<OrganizationRecord>) => {
            const response = await api<Record<string, unknown>>('/api/ottaorm/organizations', {
                method: 'POST',
                body: data,
            });

            const createdOrg =
                response && typeof response === 'object' && 'data' in response
                    ? (response.data as OrganizationRecord | undefined)
                    : (response as OrganizationRecord | undefined);

            if (!createdOrg?.id) {
                throw new Error('Organization creation returned an invalid payload');
            }

            return createdOrg;
        },
        onMutate: async (newOrg) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: organizationHooks.queryKeys.lists() });

            // Snapshot previous value
            const previous = queryClient.getQueryData<OrganizationRecord[]>(organizationHooks.queryKeys.lists());

            // Optimistically update
            if (previous) {
                queryClient.setQueryData<OrganizationRecord[]>(organizationHooks.queryKeys.lists(), [
                    ...previous,
                    { ...newOrg, id: 'temp-' + Date.now() } as OrganizationRecord,
                ]);
            }

            return { previous };
        },
        onError: (err, newOrg, context) => {
            if (context?.previous) {
                queryClient.setQueryData(organizationHooks.queryKeys.lists(), context.previous);
            }
        },
    });
}

export function useUpdateOrganization() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organizations' },
        mutationFn: async ({ id, data }: { id: string; data: Partial<OrganizationRecord> }) => {
            const response = await api<Record<string, unknown>>(`/api/ottaorm/organizations/${id}`, {
                method: 'PATCH',
                body: data,
            });

            const updatedOrg =
                response && typeof response === 'object' && 'data' in response
                    ? (response.data as OrganizationRecord | undefined)
                    : (response as OrganizationRecord | undefined);

            if (!updatedOrg?.id) {
                throw new Error('Organization update returned an invalid payload');
            }

            return updatedOrg;
        },
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey: organizationHooks.queryKeys.detail(id) });
            await queryClient.cancelQueries({ queryKey: organizationHooks.queryKeys.lists() });

            const previousOrg = queryClient.getQueryData<OrganizationRecord>(organizationHooks.queryKeys.detail(id));
            const previousOrgs = queryClient.getQueryData<OrganizationRecord[]>(organizationHooks.queryKeys.lists());

            // Optimistically update single org
            if (previousOrg) {
                queryClient.setQueryData<OrganizationRecord>(organizationHooks.queryKeys.detail(id), {
                    ...previousOrg,
                    ...data,
                });
            }

            // Optimistically update list
            if (previousOrgs) {
                queryClient.setQueryData<OrganizationRecord[]>(
                    organizationHooks.queryKeys.lists(),
                    previousOrgs.map((org) => (org.id === id ? { ...org, ...data } : org)),
                );
            }

            return { previousOrg, previousOrgs };
        },
        onError: (err, { id }, context) => {
            if (context?.previousOrg) {
                queryClient.setQueryData(organizationHooks.queryKeys.detail(id), context.previousOrg);
            }
            if (context?.previousOrgs) {
                queryClient.setQueryData(organizationHooks.queryKeys.lists(), context.previousOrgs);
            }
        },
    });
}

export function useDeleteOrganization() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organizations' },
        mutationFn: async (id: string) => {
            await api(`/api/ottaorm/organizations/${id}`, {
                method: 'DELETE',
            });
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: organizationHooks.queryKeys.lists() });

            const previous = queryClient.getQueryData<OrganizationRecord[]>(organizationHooks.queryKeys.lists());

            if (previous) {
                queryClient.setQueryData<OrganizationRecord[]>(
                    organizationHooks.queryKeys.lists(),
                    previous.filter((org) => org.id !== id),
                );
            }

            return { previous };
        },
        onError: (err, id, context) => {
            if (context?.previous) {
                queryClient.setQueryData(organizationHooks.queryKeys.lists(), context.previous);
            }
        },
    });
}

// ============================================================================
// Organization Members — Query Hooks
// ============================================================================

export function useOrganizationMembers(organizationId: string) {
    return orgMemberHooks.useList({ where: { organizationId } }, { enabled: !!organizationId });
}

// ============================================================================
// Organization Members — Mutation Hooks
// ============================================================================

/**
 * Invite a new member — no optimistic update needed; delegates cache
 * invalidation to the global observer via meta.entity.
 */
export function useInviteMember() {
    return orgMemberHooks.useCreate();
}

export function useUpdateMemberRole() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organization_members' },
        mutationFn: async ({
            memberId,
            role,
            organizationId,
        }: {
            memberId: string;
            role: MemberRole;
            organizationId: string;
        }) => {
            const response = await api<{ data: OrganizationMemberRecord }>(
                `/api/ottaorm/organization_members/${memberId}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ role }),
                },
            );
            return response.data;
        },
        onMutate: async ({ memberId, role, organizationId }) => {
            const listKey = orgMemberHooks.queryKeys.list({ where: { organizationId } });
            await queryClient.cancelQueries({ queryKey: listKey });

            const previous = queryClient.getQueryData<OrganizationMemberRecord[]>(listKey);

            if (previous) {
                queryClient.setQueryData<OrganizationMemberRecord[]>(
                    listKey,
                    previous.map((member) => (member.id === memberId ? { ...member, role } : member)),
                );
            }

            return { previous, organizationId };
        },
        onError: (err, { organizationId }, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    orgMemberHooks.queryKeys.list({ where: { organizationId } }),
                    context.previous,
                );
            }
        },
    });
}

export function useRemoveMember() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organization_members' },
        mutationFn: async ({ memberId, organizationId }: { memberId: string; organizationId: string }) => {
            await api(`/api/ottaorm/organization_members/${memberId}`, {
                method: 'DELETE',
            });
        },
        onMutate: async ({ memberId, organizationId }) => {
            const listKey = orgMemberHooks.queryKeys.list({ where: { organizationId } });
            await queryClient.cancelQueries({ queryKey: listKey });

            const previous = queryClient.getQueryData<OrganizationMemberRecord[]>(listKey);

            if (previous) {
                queryClient.setQueryData<OrganizationMemberRecord[]>(
                    listKey,
                    previous.filter((member) => member.id !== memberId),
                );
            }

            return { previous, organizationId };
        },
        onError: (err, { organizationId }, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    orgMemberHooks.queryKeys.list({ where: { organizationId } }),
                    context.previous,
                );
            }
        },
    });
}

// ============================================================================
// Roles — Query Hooks
// ============================================================================

export function useRoles() {
    return roleHooks.useList();
}

// ============================================================================
// Roles — Mutation Hooks
// ============================================================================

export function useCreateRole() {
    return roleHooks.useCreate();
}

export function useUpdateRole() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'roles' },
        mutationFn: async ({ id, data }: { id: string; data: Partial<RoleRecord> }) => {
            const response = await api<{ data: RoleRecord }>(`/api/ottaorm/roles/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            return response.data;
        },
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey: roleHooks.queryKeys.lists() });

            const previous = queryClient.getQueryData<RoleRecord[]>(roleHooks.queryKeys.lists());

            if (previous) {
                queryClient.setQueryData<RoleRecord[]>(
                    roleHooks.queryKeys.lists(),
                    previous.map((role) => (role.id === id ? { ...role, ...data } : role)),
                );
            }

            return { previous };
        },
        onError: (err, variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(roleHooks.queryKeys.lists(), context.previous);
            }
        },
    });
}

export function useDeleteRole() {
    return roleHooks.useDelete();
}

export function useTogglePermission() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'roles' },
        mutationFn: async ({
            roleId,
            permissionId,
            hasPermission,
        }: {
            roleId: string;
            permissionId: string;
            hasPermission: boolean;
        }) => {
            // Read current role state from cache
            const roles = queryClient.getQueryData<RoleRecord[]>(roleHooks.queryKeys.lists());
            const role = roles?.find((r) => r.id === roleId);

            if (!role) throw new Error('Role not found');

            const currentPermissions = role.permissions || [];
            const newPermissions = hasPermission
                ? currentPermissions.filter((p) => p !== permissionId)
                : [...currentPermissions, permissionId];

            const response = await api<{ data: RoleRecord }>(`/api/ottaorm/roles/${roleId}`, {
                method: 'PATCH',
                body: JSON.stringify({ permissions: newPermissions }),
            });

            return response.data;
        },
        onMutate: async ({ roleId, permissionId, hasPermission }) => {
            await queryClient.cancelQueries({ queryKey: roleHooks.queryKeys.lists() });

            const previous = queryClient.getQueryData<RoleRecord[]>(roleHooks.queryKeys.lists());

            if (previous) {
                queryClient.setQueryData<RoleRecord[]>(
                    roleHooks.queryKeys.lists(),
                    previous.map((role) => {
                        if (role.id !== roleId) return role;

                        const currentPermissions = role.permissions || [];
                        const newPermissions = hasPermission
                            ? currentPermissions.filter((p) => p !== permissionId)
                            : [...currentPermissions, permissionId];

                        return { ...role, permissions: newPermissions };
                    }),
                );
            }

            return { previous };
        },
        onError: (err, variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(roleHooks.queryKeys.lists(), context.previous);
            }
        },
    });
}

// ============================================================================
// Audit Logs — Query Hook (custom endpoint, useApiQuery)
// ============================================================================

export function useAuditLogs(filters?: Record<string, string>) {
    const params = new URLSearchParams(filters);
    return useApiQuery<PaginatedResponse<AuditLogRecord>>({
        entity: 'audit_logs',
        queryKey: ['list', filters],
        endpoint: `/api/audit/logs?${params.toString()}`,
        queryOptions: {
            staleTime: 1 * 60 * 1000, // 1 minute
        },
    });
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Prefetch organizations for faster navigation.
 * Returns a callable that triggers the prefetch.
 */
export function usePrefetchOrganizations() {
    const { prefetchList } = organizationHooks.usePrefetch();
    return () => prefetchList();
}

/**
 * Invalidate all RBAC caches (use after major changes).
 * Invalidates organizations, organization_members, and roles namespaces.
 */
export function useInvalidateRBAC() {
    const orgInvalidate = organizationHooks.useInvalidate();
    const memberInvalidate = orgMemberHooks.useInvalidate();
    const roleInvalidate = roleHooks.useInvalidate();

    return () => {
        orgInvalidate.invalidateAll();
        memberInvalidate.invalidateAll();
        roleInvalidate.invalidateAll();
    };
}
