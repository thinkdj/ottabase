/**
 * TanStack Query hooks for RBAC operations
 * Provides optimistic updates, cache invalidation, and error handling
 *
 * Cache layer: all queries and mutations route through the framework's
 * standard cache — createModelHooks for ottaorm CRUD, useApiQuery for
 * the custom audit-log endpoint, and raw useMutation with meta.entity
 * for the five hooks that carry optimistic updates.
 */

import { api } from '@/lib/api';
import type {
    AuditLogRecord,
    MemberRole,
    OrganizationMemberRecord,
    OrganizationRecord,
    RoleRecord,
} from '@/types/rbac';
import { createModelHooks, useApiQuery } from '@ottabase/ottaorm/client';
import type { PaginatedResponse } from '@ottabase/utils/pagination';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Model hook instances
// ============================================================================

const organizationHooks = createModelHooks<OrganizationRecord>({ entityName: 'organizations' });
const orgMemberHooks = createModelHooks<OrganizationMemberRecord>({ entityName: 'organization_members' });
const roleHooks = createModelHooks<RoleRecord>({ entityName: 'roles' });

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

export function useOrganizationMembers(organizationId: string, page = 1, perPage = 25) {
    const queryParams = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
    }).toString();

    return useApiQuery<PaginatedResponse<OrganizationMemberRecord>>({
        entity: 'organization_members',
        queryKey: ['admin-organization-members', organizationId, page, perPage],
        endpoint: `/api/admin/organizations/${organizationId}/members?${queryParams}`,
        queryOptions: {
            enabled: !!organizationId,
        },
    });
}

// ============================================================================
// Organization Members — Mutation Hooks
// ============================================================================

/**
 * Invite a new member — no optimistic update needed; delegates cache
 * invalidation to the global observer via meta.entity.
 */
export function useInviteMember() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organization_members' },
        mutationFn: async ({
            organizationId,
            userId,
            invitedEmail,
            role,
            status,
        }: {
            organizationId: string;
            userId?: string;
            invitedEmail?: string;
            role: MemberRole;
            status: 'active' | 'invited' | 'suspended';
        }) => {
            const response = await api<{ data: OrganizationMemberRecord }>(
                `/api/admin/organizations/${organizationId}/members/invite`,
                {
                    method: 'POST',
                    body: {
                        userId,
                        invitedEmail,
                        role,
                        status,
                    },
                },
            );
            return response.data;
        },
        onSuccess: async (_member, variables) => {
            await queryClient.invalidateQueries({
                queryKey: ['admin-organization-members', variables.organizationId],
            });
        },
    });
}

export function useUpdateMember() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organization_members' },
        mutationFn: async ({
            organizationId,
            userId,
            role,
            status,
        }: {
            organizationId: string;
            userId: string;
            role: MemberRole;
            status: 'active' | 'invited' | 'suspended';
        }) => {
            const response = await api<{ data: OrganizationMemberRecord }>(
                `/api/admin/organizations/${organizationId}/members/${encodeURIComponent(userId)}`,
                {
                    method: 'PATCH',
                    body: {
                        role,
                        status,
                    },
                },
            );
            return response.data;
        },
        onSuccess: async (_member, variables) => {
            await queryClient.invalidateQueries({
                queryKey: ['admin-organization-members', variables.organizationId],
            });
        },
    });
}

export function useUpdateMemberRole() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organization_members' },
        mutationFn: async ({
            userId,
            role,
            organizationId,
        }: {
            userId: string;
            role: MemberRole;
            organizationId: string;
        }) => {
            const response = await api<{ data: OrganizationMemberRecord }>(
                `/api/admin/organizations/${organizationId}/members/${encodeURIComponent(userId)}`,
                {
                    method: 'PATCH',
                    body: { role },
                },
            );
            return response.data;
        },
        onSuccess: async (_member, { organizationId }) => {
            await queryClient.invalidateQueries({
                queryKey: ['admin-organization-members', organizationId],
            });
        },
    });
}

export function useUpdateMemberStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organization_members' },
        mutationFn: async ({
            userId,
            status,
            organizationId,
        }: {
            userId: string;
            status: 'active' | 'invited' | 'suspended';
            organizationId: string;
        }) => {
            const response = await api<{ data: OrganizationMemberRecord }>(
                `/api/admin/organizations/${organizationId}/members/${encodeURIComponent(userId)}`,
                {
                    method: 'PATCH',
                    body: { status },
                },
            );
            return response.data;
        },
        onSuccess: async (_member, { organizationId }) => {
            await queryClient.invalidateQueries({
                queryKey: ['admin-organization-members', organizationId],
            });
        },
    });
}

export function useRemoveMember() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organization_members' },
        mutationFn: async ({ userId, organizationId }: { userId: string; organizationId: string }) => {
            await api(`/api/admin/organizations/${organizationId}/members/${encodeURIComponent(userId)}`, {
                method: 'DELETE',
            });
        },
        onSuccess: async (_data, { organizationId }) => {
            await queryClient.invalidateQueries({
                queryKey: ['admin-organization-members', organizationId],
            });
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
    const queryClient = useQueryClient();
    const orgInvalidate = organizationHooks.useInvalidate();
    const memberInvalidate = orgMemberHooks.useInvalidate();
    const roleInvalidate = roleHooks.useInvalidate();

    return () => {
        orgInvalidate.invalidateAll();
        memberInvalidate.invalidateAll();
        roleInvalidate.invalidateAll();
        void queryClient.invalidateQueries({ queryKey: ['admin-organization-members'] });
    };
}
