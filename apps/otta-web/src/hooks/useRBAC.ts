/**
 * TanStack Query hooks for RBAC and organization management.
 * Organization data now uses explicit account/current-tenant/platform-admin APIs.
 */

import { api } from '@/lib/api';
import type {
    AccessibleOrganizationRecord,
    AuditLogRecord,
    MemberRole,
    OrganizationMemberRecord,
    OrganizationPendingInviteRecord,
    OrganizationRecord,
    RoleRecord,
} from '@/types/rbac';
import { createModelHooks, useApiQuery } from '@ottabase/ottaorm/client';
import type { PaginatedResponse } from '@ottabase/utils/pagination';
import { useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

const roleHooks = createModelHooks<RoleRecord>({ entityName: 'roles' });

const organizationQueryKeys = {
    accessible: ['account-organizations'] as const,
    current: ['current-organization'] as const,
    currentMembers: ['current-organization-members'] as const,
    currentInvites: ['current-organization-invites'] as const,
    platformList: ['platform-organizations'] as const,
    platformDetail: (organizationId: string) => ['platform-organizations', organizationId] as const,
    platformMembers: (organizationId: string) => ['platform-organization-members', organizationId] as const,
    platformInvites: (organizationId: string) => ['platform-organization-invites', organizationId] as const,
    availability: (query: string) => ['platform-organization-availability', query] as const,
};

function scopedOrganizationEndpoint(organizationId?: string | null): string {
    return organizationId ? `/api/admin-platform/organizations/${organizationId}` : '/api/admin/organization';
}

function scopedMembersEndpoint(organizationId?: string | null, page = 1, perPage = 25): string {
    const query = new URLSearchParams({ page: String(page), per_page: String(perPage) }).toString();
    return `${scopedOrganizationEndpoint(organizationId)}/members?${query}`;
}

function scopedInvitesEndpoint(organizationId?: string | null): string {
    return `${scopedOrganizationEndpoint(organizationId)}/invites`;
}

function scopedMembersQueryKey(organizationId: string | null | undefined, page: number, perPage: number) {
    return organizationId
        ? ([...organizationQueryKeys.platformMembers(organizationId), page, perPage] as const)
        : ([...organizationQueryKeys.currentMembers, page, perPage] as const);
}

function scopedInvitesQueryKey(organizationId?: string | null) {
    return organizationId
        ? organizationQueryKeys.platformInvites(organizationId)
        : organizationQueryKeys.currentInvites;
}

async function invalidateOrganizationQueries(
    queryClient: ReturnType<typeof useQueryClient>,
    organizationId?: string | null,
) {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationQueryKeys.accessible }),
        queryClient.invalidateQueries({ queryKey: organizationQueryKeys.current }),
        queryClient.invalidateQueries({ queryKey: organizationQueryKeys.currentMembers }),
        queryClient.invalidateQueries({ queryKey: organizationQueryKeys.currentInvites }),
        queryClient.invalidateQueries({ queryKey: organizationQueryKeys.platformList }),
        organizationId
            ? queryClient.invalidateQueries({ queryKey: organizationQueryKeys.platformDetail(organizationId) })
            : Promise.resolve(),
        organizationId
            ? queryClient.invalidateQueries({ queryKey: organizationQueryKeys.platformMembers(organizationId) })
            : Promise.resolve(),
        organizationId
            ? queryClient.invalidateQueries({ queryKey: organizationQueryKeys.platformInvites(organizationId) })
            : Promise.resolve(),
    ]);
}

export function useAccessibleOrganizations() {
    return useApiQuery<{ data: AccessibleOrganizationRecord[] }, AccessibleOrganizationRecord[]>({
        entity: 'organizations',
        queryKey: organizationQueryKeys.accessible,
        endpoint: '/api/account/organizations',
        transform: (response) => response.data,
    });
}

export function usePlatformOrganizations() {
    return useApiQuery<{ data: OrganizationRecord[] }, OrganizationRecord[]>({
        entity: 'organizations',
        queryKey: organizationQueryKeys.platformList,
        endpoint: '/api/admin-platform/organizations',
        transform: (response) => response.data,
    });
}

export function useCurrentOrganization(queryOptions?: Partial<UseQueryOptions<OrganizationRecord, Error>>) {
    return useApiQuery<{ data: OrganizationRecord }, OrganizationRecord>({
        entity: 'organizations',
        queryKey: organizationQueryKeys.current,
        endpoint: '/api/admin/organization',
        transform: (response) => response.data,
        queryOptions,
    });
}

export function useOrganization(
    organizationId?: string | null,
    queryOptions?: Partial<UseQueryOptions<OrganizationRecord, Error>>,
) {
    return useApiQuery<{ data: OrganizationRecord }, OrganizationRecord>({
        entity: 'organizations',
        queryKey: organizationId ? organizationQueryKeys.platformDetail(organizationId) : organizationQueryKeys.current,
        endpoint: organizationId ? `/api/admin-platform/organizations/${organizationId}` : '/api/admin/organization',
        transform: (response) => response.data,
        queryOptions: {
            ...queryOptions,
            enabled: organizationId
                ? !!organizationId && (queryOptions?.enabled ?? true)
                : (queryOptions?.enabled ?? true),
        },
    });
}

export function useOnboardingCreateOrganization() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organizations' },
        mutationFn: async (data: Partial<OrganizationRecord>) => {
            const response = await api<{ data: OrganizationRecord }>('/api/onboarding/organizations', {
                method: 'POST',
                body: data,
            });
            return response.data;
        },
        onSuccess: async (organization) => {
            await invalidateOrganizationQueries(queryClient, organization.id);
        },
    });
}

export function usePlatformCreateOrganization() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organizations' },
        mutationFn: async (data: Partial<OrganizationRecord>) => {
            const response = await api<{ data: OrganizationRecord }>('/api/admin-platform/organizations', {
                method: 'POST',
                body: data,
            });
            return response.data;
        },
        onSuccess: async (organization) => {
            await invalidateOrganizationQueries(queryClient, organization.id);
        },
    });
}

export function useCurrentOrganizationUpdate() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organizations' },
        mutationFn: async (data: Partial<OrganizationRecord>) => {
            const response = await api<{ data: OrganizationRecord }>('/api/admin/organization', {
                method: 'PATCH',
                body: data,
            });
            return response.data;
        },
        onSuccess: async () => {
            await invalidateOrganizationQueries(queryClient);
        },
    });
}

export function usePlatformUpdateOrganization() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organizations' },
        mutationFn: async ({ id, data }: { id: string; data: Partial<OrganizationRecord> }) => {
            const response = await api<{ data: OrganizationRecord }>(`/api/admin-platform/organizations/${id}`, {
                method: 'PATCH',
                body: data,
            });
            return response.data;
        },
        onSuccess: async (organization) => {
            await invalidateOrganizationQueries(queryClient, organization.id);
        },
    });
}

export function useDeleteOrganization() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organizations' },
        mutationFn: async (organizationId: string) => {
            await api(`/api/admin-platform/organizations/${organizationId}`, {
                method: 'DELETE',
            });
        },
        onSuccess: async (_data, organizationId) => {
            await invalidateOrganizationQueries(queryClient, organizationId);
        },
    });
}

export function useOrganizationMembers(organizationId?: string | null, page = 1, perPage = 25, enabled = true) {
    return useApiQuery<PaginatedResponse<OrganizationMemberRecord>>({
        entity: 'organization_members',
        queryKey: scopedMembersQueryKey(organizationId, page, perPage),
        endpoint: scopedMembersEndpoint(organizationId, page, perPage),
        queryOptions: { enabled },
    });
}

export function useInviteMember() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organization_members' },
        mutationFn: async ({
            organizationId,
            userId,
            role,
            status,
        }: {
            organizationId?: string;
            userId: string;
            role: MemberRole;
            status: 'active' | 'invited' | 'suspended';
        }) => {
            const response = await api<{ data: OrganizationMemberRecord }>(
                `${scopedOrganizationEndpoint(organizationId)}/members/invite`,
                {
                    method: 'POST',
                    body: { userId, role, status },
                },
            );
            return response.data;
        },
        onSuccess: async (_member, { organizationId }) => {
            await invalidateOrganizationQueries(queryClient, organizationId);
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
            organizationId?: string;
            userId: string;
            role: MemberRole;
            status: 'active' | 'invited' | 'suspended';
        }) => {
            const response = await api<{ data: OrganizationMemberRecord }>(
                `${scopedOrganizationEndpoint(organizationId)}/members/${encodeURIComponent(userId)}`,
                {
                    method: 'PATCH',
                    body: { role, status },
                },
            );
            return response.data;
        },
        onSuccess: async (_member, { organizationId }) => {
            await invalidateOrganizationQueries(queryClient, organizationId);
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
            organizationId?: string;
        }) => {
            const response = await api<{ data: OrganizationMemberRecord }>(
                `${scopedOrganizationEndpoint(organizationId)}/members/${encodeURIComponent(userId)}`,
                {
                    method: 'PATCH',
                    body: { role },
                },
            );
            return response.data;
        },
        onSuccess: async (_member, { organizationId }) => {
            await invalidateOrganizationQueries(queryClient, organizationId);
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
            organizationId?: string;
        }) => {
            const response = await api<{ data: OrganizationMemberRecord }>(
                `${scopedOrganizationEndpoint(organizationId)}/members/${encodeURIComponent(userId)}`,
                {
                    method: 'PATCH',
                    body: { status },
                },
            );
            return response.data;
        },
        onSuccess: async (_member, { organizationId }) => {
            await invalidateOrganizationQueries(queryClient, organizationId);
        },
    });
}

export function useRemoveMember() {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'organization_members' },
        mutationFn: async ({
            userId,
            organizationId,
            reason,
            notifyMember,
        }: {
            userId: string;
            organizationId?: string;
            reason?: string;
            notifyMember?: boolean;
        }) => {
            await api(`${scopedOrganizationEndpoint(organizationId)}/members/${encodeURIComponent(userId)}`, {
                method: 'DELETE',
                body: { reason, notifyMember },
            });
        },
        onSuccess: async (_data, { organizationId }) => {
            await invalidateOrganizationQueries(queryClient, organizationId);
        },
    });
}

export function useOrganizationPendingInvites(organizationId?: string | null, enabled = true) {
    return useApiQuery<{ data: OrganizationPendingInviteRecord[] }, OrganizationPendingInviteRecord[]>({
        entity: 'organization_invites',
        queryKey: scopedInvitesQueryKey(organizationId),
        endpoint: scopedInvitesEndpoint(organizationId),
        transform: (response) => response.data,
        queryOptions: { enabled },
    });
}

export function useInviteByEmail() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            organizationId,
            email,
            role,
        }: {
            organizationId?: string;
            email: string;
            role: MemberRole;
        }) => {
            const response = await api<{ data: OrganizationPendingInviteRecord }>(
                scopedInvitesEndpoint(organizationId),
                {
                    method: 'POST',
                    body: { email, role },
                },
            );
            return response.data;
        },
        onSuccess: async (_data, { organizationId }) => {
            await invalidateOrganizationQueries(queryClient, organizationId);
        },
    });
}

export function useRevokeOrganizationInvite() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ organizationId, inviteId }: { organizationId?: string; inviteId: string }) => {
            await api(`${scopedInvitesEndpoint(organizationId)}/${inviteId}/revoke`, {
                method: 'POST',
                body: {},
            });
        },
        onSuccess: async (_data, { organizationId }) => {
            await invalidateOrganizationQueries(queryClient, organizationId);
        },
    });
}

export function useResendOrganizationInvite() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ organizationId, inviteId }: { organizationId?: string; inviteId: string }) => {
            await api(`${scopedInvitesEndpoint(organizationId)}/${inviteId}/resend`, {
                method: 'POST',
                body: {},
            });
        },
        onSuccess: async (_data, { organizationId }) => {
            await invalidateOrganizationQueries(queryClient, organizationId);
        },
    });
}

export function useOrganizationAvailability(params: { slug?: string; name?: string; excludeId?: string }) {
    const query = new URLSearchParams();
    if (params.slug) query.set('slug', params.slug);
    if (params.name) query.set('name', params.name);
    if (params.excludeId) query.set('excludeId', params.excludeId);

    const queryString = query.toString();

    return useApiQuery<{
        data: { slugAvailable: boolean; nameAvailable: boolean; slugTaken: boolean; nameTaken: boolean };
    }>({
        entity: 'organizations',
        queryKey: organizationQueryKeys.availability(queryString),
        endpoint: `/api/admin-platform/organizations/availability?${queryString}`,
        queryOptions: { enabled: !!queryString },
    });
}

export function useOrganizationOffboard() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (organizationId: string) => {
            await api(`/api/admin-platform/organizations/${organizationId}/offboard`, {
                method: 'POST',
                body: {},
            });
        },
        onSuccess: async (_data, organizationId) => {
            await invalidateOrganizationQueries(queryClient, organizationId);
        },
    });
}

export function useRoles() {
    return roleHooks.useList();
}

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
        onError: (_error, _variables, context) => {
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
            const roles = queryClient.getQueryData<RoleRecord[]>(roleHooks.queryKeys.lists());
            const role = roles?.find((entry) => entry.id === roleId);

            if (!role) throw new Error('Role not found');

            const currentPermissions = role.permissions || [];
            const nextPermissions = hasPermission
                ? currentPermissions.filter((permission) => permission !== permissionId)
                : [...currentPermissions, permissionId];

            const response = await api<{ data: RoleRecord }>(`/api/ottaorm/roles/${roleId}`, {
                method: 'PATCH',
                body: JSON.stringify({ permissions: nextPermissions }),
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
                        const nextPermissions = hasPermission
                            ? currentPermissions.filter((permission) => permission !== permissionId)
                            : [...currentPermissions, permissionId];

                        return { ...role, permissions: nextPermissions };
                    }),
                );
            }

            return { previous };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(roleHooks.queryKeys.lists(), context.previous);
            }
        },
    });
}

export function useAuditLogs(filters?: Record<string, string>) {
    const params = new URLSearchParams(filters);
    return useApiQuery<PaginatedResponse<AuditLogRecord>>({
        entity: 'audit_logs',
        queryKey: ['list', filters],
        endpoint: `/api/audit/logs?${params.toString()}`,
        queryOptions: {
            staleTime: 1 * 60 * 1000,
        },
    });
}

export function usePrefetchOrganizations() {
    const queryClient = useQueryClient();
    return () =>
        queryClient.prefetchQuery({
            queryKey: organizationQueryKeys.accessible,
            queryFn: async () => {
                const response = await api<{ data: AccessibleOrganizationRecord[] }>('/api/account/organizations');
                return response.data;
            },
        });
}

export function useInvalidateRBAC() {
    const queryClient = useQueryClient();
    const roleInvalidate = roleHooks.useInvalidate();

    return () => {
        roleInvalidate.invalidateAll();
        void invalidateOrganizationQueries(queryClient);
    };
}
