/**
 * TanStack Query hooks for RBAC operations
 * Provides optimistic updates, cache invalidation, and error handling
 */

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  OrganizationRecord,
  OrganizationMemberRecord,
  RoleRecord,
  AuditLogRecord,
  MemberRole,
} from '@/types/rbac';

// ============================================================================
// Query Keys
// ============================================================================

export const rbacKeys = {
  all: ['rbac'] as const,

  // Organizations
  organizations: () => [...rbacKeys.all, 'organizations'] as const,
  organization: (id: string) => [...rbacKeys.organizations(), id] as const,

  // Members
  members: (orgId: string) => [...rbacKeys.all, 'members', orgId] as const,
  member: (id: string) => [...rbacKeys.all, 'member', id] as const,

  // Roles
  roles: () => [...rbacKeys.all, 'roles'] as const,
  role: (id: string) => [...rbacKeys.roles(), id] as const,

  // Audit Logs
  auditLogs: (filters?: Record<string, string>) =>
    [...rbacKeys.all, 'audit', filters] as const,
};

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

interface ApiError {
  error: string;
  message?: string;
}

// ============================================================================
// Organizations Hooks
// ============================================================================

export function useOrganizations(options?: UseQueryOptions<OrganizationRecord[]>) {
  return useQuery({
    queryKey: rbacKeys.organizations(),
    queryFn: async () => {
      const response = await api<{ data: OrganizationRecord[] }>('/api/ottaorm/organizations');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

export function useOrganization(id: string, options?: UseQueryOptions<OrganizationRecord>) {
  return useQuery({
    queryKey: rbacKeys.organization(id),
    queryFn: async () => {
      const response = await api<{ data: OrganizationRecord }>(`/api/ottaorm/organizations/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<OrganizationRecord>) => {
      const response = await api<{ data: OrganizationRecord }>('/api/ottaorm/organizations', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data;
    },
    onMutate: async (newOrg) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: rbacKeys.organizations() });

      // Snapshot previous value
      const previous = queryClient.getQueryData<OrganizationRecord[]>(rbacKeys.organizations());

      // Optimistically update
      if (previous) {
        queryClient.setQueryData<OrganizationRecord[]>(
          rbacKeys.organizations(),
          [...previous, { ...newOrg, id: 'temp-' + Date.now() } as OrganizationRecord]
        );
      }

      return { previous };
    },
    onError: (err, newOrg, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(rbacKeys.organizations(), context.previous);
      }
    },
    onSettled: () => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: rbacKeys.organizations() });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<OrganizationRecord> }) => {
      const response = await api<{ data: OrganizationRecord }>(`/api/ottaorm/organizations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return response.data;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: rbacKeys.organization(id) });
      await queryClient.cancelQueries({ queryKey: rbacKeys.organizations() });

      const previousOrg = queryClient.getQueryData<OrganizationRecord>(rbacKeys.organization(id));
      const previousOrgs = queryClient.getQueryData<OrganizationRecord[]>(rbacKeys.organizations());

      // Optimistically update single org
      if (previousOrg) {
        queryClient.setQueryData<OrganizationRecord>(
          rbacKeys.organization(id),
          { ...previousOrg, ...data }
        );
      }

      // Optimistically update list
      if (previousOrgs) {
        queryClient.setQueryData<OrganizationRecord[]>(
          rbacKeys.organizations(),
          previousOrgs.map(org => org.id === id ? { ...org, ...data } : org)
        );
      }

      return { previousOrg, previousOrgs };
    },
    onError: (err, { id }, context) => {
      if (context?.previousOrg) {
        queryClient.setQueryData(rbacKeys.organization(id), context.previousOrg);
      }
      if (context?.previousOrgs) {
        queryClient.setQueryData(rbacKeys.organizations(), context.previousOrgs);
      }
    },
    onSettled: (data, err, { id }) => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.organization(id) });
      queryClient.invalidateQueries({ queryKey: rbacKeys.organizations() });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api(`/api/ottaorm/organizations/${id}`, {
        method: 'DELETE',
      });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: rbacKeys.organizations() });

      const previous = queryClient.getQueryData<OrganizationRecord[]>(rbacKeys.organizations());

      if (previous) {
        queryClient.setQueryData<OrganizationRecord[]>(
          rbacKeys.organizations(),
          previous.filter(org => org.id !== id)
        );
      }

      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(rbacKeys.organizations(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.organizations() });
    },
  });
}

// ============================================================================
// Organization Members Hooks
// ============================================================================

export function useOrganizationMembers(organizationId: string, options?: UseQueryOptions<OrganizationMemberRecord[]>) {
  return useQuery({
    queryKey: rbacKeys.members(organizationId),
    queryFn: async () => {
      const response = await api<{ data: OrganizationMemberRecord[] }>(
        `/api/ottaorm/organization_members?organizationId=${organizationId}`
      );
      return response.data;
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<OrganizationMemberRecord>) => {
      const response = await api<{ data: OrganizationMemberRecord }>('/api/ottaorm/organization_members', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.organizationId) {
        queryClient.invalidateQueries({ queryKey: rbacKeys.members(data.organizationId) });
      }
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, role, organizationId }: {
      memberId: string;
      role: MemberRole;
      organizationId: string;
    }) => {
      const response = await api<{ data: OrganizationMemberRecord }>(
        `/api/ottaorm/organization_members/${memberId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        }
      );
      return response.data;
    },
    onMutate: async ({ memberId, role, organizationId }) => {
      await queryClient.cancelQueries({ queryKey: rbacKeys.members(organizationId) });

      const previous = queryClient.getQueryData<OrganizationMemberRecord[]>(
        rbacKeys.members(organizationId)
      );

      if (previous) {
        queryClient.setQueryData<OrganizationMemberRecord[]>(
          rbacKeys.members(organizationId),
          previous.map(member =>
            member.id === memberId ? { ...member, role } : member
          )
        );
      }

      return { previous, organizationId };
    },
    onError: (err, { organizationId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(rbacKeys.members(organizationId), context.previous);
      }
    },
    onSettled: (data, err, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.members(organizationId) });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, organizationId }: { memberId: string; organizationId: string }) => {
      await api(`/api/ottaorm/organization_members/${memberId}`, {
        method: 'DELETE',
      });
    },
    onMutate: async ({ memberId, organizationId }) => {
      await queryClient.cancelQueries({ queryKey: rbacKeys.members(organizationId) });

      const previous = queryClient.getQueryData<OrganizationMemberRecord[]>(
        rbacKeys.members(organizationId)
      );

      if (previous) {
        queryClient.setQueryData<OrganizationMemberRecord[]>(
          rbacKeys.members(organizationId),
          previous.filter(member => member.id !== memberId)
        );
      }

      return { previous, organizationId };
    },
    onError: (err, { organizationId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(rbacKeys.members(organizationId), context.previous);
      }
    },
    onSettled: (data, err, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.members(organizationId) });
    },
  });
}

// ============================================================================
// Roles Hooks
// ============================================================================

export function useRoles(options?: UseQueryOptions<RoleRecord[]>) {
  return useQuery({
    queryKey: rbacKeys.roles(),
    queryFn: async () => {
      const response = await api<{ data: RoleRecord[] }>('/api/ottaorm/roles');
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (roles change infrequently)
    ...options,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<RoleRecord>) => {
      const response = await api<{ data: RoleRecord }>('/api/ottaorm/roles', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RoleRecord> }) => {
      const response = await api<{ data: RoleRecord }>(`/api/ottaorm/roles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return response.data;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: rbacKeys.roles() });

      const previous = queryClient.getQueryData<RoleRecord[]>(rbacKeys.roles());

      if (previous) {
        queryClient.setQueryData<RoleRecord[]>(
          rbacKeys.roles(),
          previous.map(role => role.id === id ? { ...role, ...data } : role)
        );
      }

      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(rbacKeys.roles(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api(`/api/ottaorm/roles/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
    },
  });
}

export function useTogglePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleId,
      permissionId,
      hasPermission
    }: {
      roleId: string;
      permissionId: string;
      hasPermission: boolean;
    }) => {
      // Get current role
      const roles = queryClient.getQueryData<RoleRecord[]>(rbacKeys.roles());
      const role = roles?.find(r => r.id === roleId);

      if (!role) throw new Error('Role not found');

      const currentPermissions = role.permissions || [];
      const newPermissions = hasPermission
        ? currentPermissions.filter(p => p !== permissionId)
        : [...currentPermissions, permissionId];

      const response = await api<{ data: RoleRecord }>(`/api/ottaorm/roles/${roleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions: newPermissions }),
      });

      return response.data;
    },
    onMutate: async ({ roleId, permissionId, hasPermission }) => {
      await queryClient.cancelQueries({ queryKey: rbacKeys.roles() });

      const previous = queryClient.getQueryData<RoleRecord[]>(rbacKeys.roles());

      if (previous) {
        queryClient.setQueryData<RoleRecord[]>(
          rbacKeys.roles(),
          previous.map(role => {
            if (role.id !== roleId) return role;

            const currentPermissions = role.permissions || [];
            const newPermissions = hasPermission
              ? currentPermissions.filter(p => p !== permissionId)
              : [...currentPermissions, permissionId];

            return { ...role, permissions: newPermissions };
          })
        );
      }

      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(rbacKeys.roles(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
    },
  });
}

// ============================================================================
// Audit Logs Hooks
// ============================================================================

export function useAuditLogs(
  filters?: Record<string, string>,
  options?: UseQueryOptions<PaginatedResponse<AuditLogRecord>>
) {
  return useQuery({
    queryKey: rbacKeys.auditLogs(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const response = await api<PaginatedResponse<AuditLogRecord>>(
        `/api/audit/logs?${params.toString()}`
      );
      return response;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    ...options,
  });
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Prefetch organizations for faster navigation
 */
export function usePrefetchOrganizations() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.prefetchQuery({
      queryKey: rbacKeys.organizations(),
      queryFn: async () => {
        const response = await api<{ data: OrganizationRecord[] }>('/api/ottaorm/organizations');
        return response.data;
      },
    });
  };
}

/**
 * Invalidate all RBAC caches (use after major changes)
 */
export function useInvalidateRBAC() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: rbacKeys.all });
  };
}
