/**
 * TanStack Query hooks for RBAC operations
 * Provides optimistic updates, cache invalidation, and error handling
 *
 * Cache layer: all queries and mutations route through the framework's
 * standard cache — createModelHooks for ottaorm CRUD, useApiQuery for
 * the custom audit-log endpoint, and raw useMutation for the hooks that
 * carry optimistic updates. There is no global invalidation observer;
 * every mutation below explicitly invalidates the query families its
 * write affects in onSuccess. `meta: { entity }` is retained only to
 * tag the entity on terminal-error reports (see QueryProvider), not for
 * invalidation.
 */

import { useSession } from '@/lib/auth';
import type {
    AuditLogRecord,
    MemberRole,
    OrganizationMemberRecord,
    OrganizationRecord,
    RoleRecord,
} from '@/types/rbac';
import { createModelHooks, useApiClient, useApiQuery } from '@ottabase/ottaorm/client';
import type { PaginatedResponse } from '@ottabase/utils/pagination';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

// ============================================================================
// Model hook instances
// ============================================================================

const organizationHooks = createModelHooks<OrganizationRecord>({ entityName: 'organizations' });
const orgMemberHooks = createModelHooks<OrganizationMemberRecord>({ entityName: 'organization_members' });
// Role definitions are managed via the platform-scoped admin endpoint, NOT generic CRUD
// (/api/ottaorm/roles is default-denied). Same REST shape (GET list, POST, PATCH/:id, DELETE/:id).
const roleHooks = createModelHooks<RoleRecord>({ entityName: 'roles', apiPath: '/api/admin/roles' });

/** Refresh only when a successful RBAC mutation can change this browser's session snapshot. */
function useSessionRefreshAfterRbacChange() {
    const { user, refreshSession } = useSession();

    return useCallback(
        async (affectedUserId?: string) => {
            if (affectedUserId && affectedUserId !== user?.id) return;
            await refreshSession();
        },
        [refreshSession, user?.id],
    );
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
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organizations' },
        mutationFn: async (data: Partial<OrganizationRecord>) => {
            const createdOrg = await api<OrganizationRecord>('/api/ottaorm/organizations', {
                method: 'POST',
                body: data,
            });

            if (!createdOrg?.id) {
                throw new Error('Organization creation returned an invalid payload');
            }

            return createdOrg;
        },
        onSuccess: async () => {
            // Organization creation also provisions its owner membership server-side. Only
            // publish the canonical list after that all-or-nothing operation succeeds.
            await queryClient.invalidateQueries({ queryKey: organizationHooks.queryKeys.lists() });
        },
    });
}

export function useUpdateOrganization() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organizations' },
        mutationFn: async ({ id, data }: { id: string; data: Partial<OrganizationRecord> }) => {
            const updatedOrg = await api<OrganizationRecord>(`/api/ottaorm/organizations/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                body: data,
            });

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
        onSuccess: async (updatedOrg) => {
            // Reconcile the optimistic patch with the server's canonical record.
            await queryClient.invalidateQueries({ queryKey: organizationHooks.queryKeys.detail(updatedOrg.id) });
            await queryClient.invalidateQueries({ queryKey: organizationHooks.queryKeys.lists() });
        },
    });
}

export function useDeleteOrganization() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organizations' },
        mutationFn: async (id: string) => {
            await api(`/api/ottaorm/organizations/${encodeURIComponent(id)}`, {
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
        onSuccess: async (_data, id) => {
            queryClient.removeQueries({ queryKey: organizationHooks.queryKeys.detail(id) });
            await queryClient.invalidateQueries({ queryKey: organizationHooks.queryKeys.lists() });
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
 * Invite a new member — no optimistic update needed; invalidates the
 * member list directly in onSuccess.
 */
export function useInviteMember() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    const refreshSessionAfterRbacChange = useSessionRefreshAfterRbacChange();

    return useMutation({
        meta: { entity: 'organization_members' },
        mutationFn: async ({
            organizationId,
            userId,
            email,
            role,
            status,
        }: {
            organizationId: string;
            userId?: string;
            email?: string;
            role: MemberRole;
            status?: 'active' | 'invited' | 'suspended';
        }) => {
            const response = await api<{ data: OrganizationMemberRecord }>(
                `/api/admin/organizations/${encodeURIComponent(organizationId)}/members/invite`,
                {
                    method: 'POST',
                    body: {
                        userId,
                        email,
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
            if (variables.userId) await refreshSessionAfterRbacChange(variables.userId);
        },
    });
}

export function useUpdateMember() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    const refreshSessionAfterRbacChange = useSessionRefreshAfterRbacChange();

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
                `/api/admin/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`,
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
            await refreshSessionAfterRbacChange(variables.userId);
        },
    });
}

export function useUpdateMemberRole() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    const refreshSessionAfterRbacChange = useSessionRefreshAfterRbacChange();

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
                `/api/admin/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`,
                {
                    method: 'PATCH',
                    body: { role },
                },
            );
            return response.data;
        },
        onSuccess: async (_member, { organizationId, userId }) => {
            await queryClient.invalidateQueries({
                queryKey: ['admin-organization-members', organizationId],
            });
            await refreshSessionAfterRbacChange(userId);
        },
    });
}

export function useUpdateMemberStatus() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    const refreshSessionAfterRbacChange = useSessionRefreshAfterRbacChange();

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
                `/api/admin/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`,
                {
                    method: 'PATCH',
                    body: { status },
                },
            );
            return response.data;
        },
        onSuccess: async (_member, { organizationId, userId }) => {
            await queryClient.invalidateQueries({
                queryKey: ['admin-organization-members', organizationId],
            });
            await refreshSessionAfterRbacChange(userId);
        },
    });
}

export function useRemoveMember() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    const refreshSessionAfterRbacChange = useSessionRefreshAfterRbacChange();

    return useMutation({
        meta: { entity: 'organization_members' },
        mutationFn: async ({
            memberId,
            organizationId,
        }: {
            memberId: string;
            userId?: string;
            organizationId: string;
        }) => {
            await api(
                `/api/admin/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}`,
                {
                    method: 'DELETE',
                },
            );
        },
        onSuccess: async (_data, { organizationId, userId }) => {
            await queryClient.invalidateQueries({
                queryKey: ['admin-organization-members', organizationId],
            });
            if (userId) await refreshSessionAfterRbacChange(userId);
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
    const api = useApiClient();
    const queryClient = useQueryClient();
    const refreshSessionAfterRbacChange = useSessionRefreshAfterRbacChange();

    return useMutation({
        meta: { entity: 'roles' },
        mutationFn: async ({ id, data }: { id: string; data: Partial<RoleRecord> }) => {
            const response = await api<{ data: RoleRecord }>(`/api/admin/roles/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                body: data,
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
        onSuccess: async () => {
            await refreshSessionAfterRbacChange();
        },
    });
}

export function useDeleteRole() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    const refreshSessionAfterRbacChange = useSessionRefreshAfterRbacChange();

    return useMutation({
        meta: { entity: 'roles' },
        mutationFn: async (id: string) => {
            await api(`/api/admin/roles/${encodeURIComponent(id)}`, { method: 'DELETE' });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: roleHooks.queryKeys.lists() });
            await refreshSessionAfterRbacChange();
        },
    });
}

export function useTogglePermission() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    const refreshSessionAfterRbacChange = useSessionRefreshAfterRbacChange();

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

            const response = await api<{ data: RoleRecord }>(`/api/admin/roles/${encodeURIComponent(roleId)}`, {
                method: 'PATCH',
                body: { permissions: newPermissions },
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
        onSuccess: async () => {
            await refreshSessionAfterRbacChange();
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
