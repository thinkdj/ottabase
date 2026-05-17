/**
 * TanStack Query hooks for User Groups
 * Uses createModelHooks for standard CRUD on user_groups and user_group_members
 */

import { api } from '@/lib/api';
import type { InviteGroupMemberInput, UserGroupMemberRecord, UserGroupRecord } from '@/types/rbac';
import { createModelHooks } from '@ottabase/ottaorm/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Model hook instances
// ============================================================================

const userGroupHooks = createModelHooks<UserGroupRecord>({ entityName: 'user_groups' });
const userGroupMemberHooks = createModelHooks<UserGroupMemberRecord>({ entityName: 'user_group_members' });

// ============================================================================
// User Groups — Query Hooks
// ============================================================================

export function useUserGroups() {
    return userGroupHooks.useList();
}

export function useUserGroup(id: string) {
    return userGroupHooks.useDetail(id);
}

// ============================================================================
// User Groups — Mutation Hooks
// ============================================================================

export function useCreateUserGroup() {
    return userGroupHooks.useCreate();
}

export function useUpdateUserGroup() {
    return userGroupHooks.useUpdate();
}

export function useDeleteUserGroup() {
    return userGroupHooks.useDelete();
}

// ============================================================================
// User Group Members — Query Hooks
// ============================================================================

export function useUserGroupMembers(groupId: string) {
    return userGroupMemberHooks.useList({ where: { groupId } }, { enabled: !!groupId });
}

// ============================================================================
// User Group Members — Mutation Hooks
// ============================================================================

/** Add a member to a group — supports userId or invitedEmail. */
export function useAddGroupMember(groupId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        meta: { entity: 'user_group_members' },
        mutationFn: async (data: InviteGroupMemberInput & { organizationId: string }) => {
            const response = await api<{ data: UserGroupMemberRecord }>(`/api/ottaorm/user_group_members`, {
                method: 'POST',
                body: {
                    groupId,
                    organizationId: data.organizationId,
                    userId: data.userId,
                    invitedEmail: data.invitedEmail,
                    role: data.role ?? 'member',
                    status: data.userId ? 'active' : 'invited',
                    invitedAt: Date.now(),
                    joinedAt: data.userId ? Date.now() : undefined,
                },
            });
            return response.data;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: userGroupMemberHooks.queryKeys.lists(),
            });
        },
    });
}

export function useUpdateGroupMember() {
    return userGroupMemberHooks.useUpdate();
}

export function useRemoveGroupMember() {
    return userGroupMemberHooks.useDelete();
}
