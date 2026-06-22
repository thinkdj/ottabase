// ============================================================
// @ottabase/ottaorm - UserGroup models
// ============================================================
//
// A reusable membership primitive: a `UserGroup` is a named group of users within an organization
// (optionally app-scoped), and `UserGroupMember` is a user's (or a pending email invite's)
// membership in it, with a free-form `role` and an invited -> active -> suspended status lifecycle.
//
// App features attach their own entity to a group via a `user_group_id` FK and get member
// management for free. Access is membership-scoped at the RLS layer: see `groupIdsForUser`, which
// the security-context builder uses to populate `SecurityContext.memberGroupIds`.
// ============================================================

import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { BaseModel, type ModelFields, type PackageType } from '../base/BaseModel';
import { usersTable } from './User.schema';
import {
    userGroupMembersTable,
    userGroupsTable,
    type NewUserGroupMemberType,
    type NewUserGroupType,
    type UserGroupMemberType,
    type UserGroupType,
} from './UserGroup.schema';

/** Membership status lifecycle, shared with organization_members. */
export type UserGroupMemberStatus = 'invited' | 'active' | 'suspended';

export class UserGroup extends BaseModel {
    static entity = 'user_groups';
    static table = userGroupsTable;
    static primaryKey = 'id';
    static connection = 'default';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    static displayName = 'User Group';
    static displayNamePlural = 'User Groups';
    static defaultSort = 'name';
    static defaultSortDirection = 'asc' as const;

    static casts = {
        metadata: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        name: { type: 'string', editable: true, searchable: true, uiConfig: { label: 'Name' } },
        slug: { type: 'string', editable: true, searchable: true, uiConfig: { label: 'Slug' } },
        description: { type: 'string', editable: true, searchable: true, uiConfig: { label: 'Description' } },
        organizationId: { type: 'string', editable: false, filterable: true, uiConfig: { label: 'Organization' } },
        appId: { type: 'string', editable: true, filterable: true, uiConfig: { label: 'App' } },
        createdBy: { type: 'string', editable: false, filterable: true, uiConfig: { label: 'Created by' } },
        metadata: { type: 'json', editable: true, uiConfig: { label: 'Metadata' } },
        createdAt: { type: 'date', editable: false, sortable: true, uiConfig: { label: 'Created' } },
        updatedAt: { type: 'date', editable: false, sortable: true, uiConfig: { label: 'Updated' } },
    };

    protected static validationRules = {
        name: { rules: 'required', fieldName: 'Name' },
        slug: { rules: 'required', fieldName: 'Slug' },
        organizationId: { rules: 'required', fieldName: 'Organization' },
    };

    /** All groups in an organization (optionally narrowed to one app), ordered by name. */
    static async forOrganization(organizationId: string, options?: { appId?: string | null }) {
        const where: Record<string, unknown> = { organizationId };
        if (options?.appId !== undefined) where.appId = options.appId;
        return this.where(where, { orderBy: 'name', orderDirection: 'asc' });
    }

    /**
     * The authoritative set of group IDs a user can access: their ACTIVE memberships plus any
     * groups they created (so a creator never loses access). Use this to populate
     * `SecurityContext.memberGroupIds` for membership-scoped RLS — it mirrors
     * `OrganizationMember.organizationIdsForUser`.
     */
    static async groupIdsForUser(userId: string, organizationId?: string): Promise<string[]> {
        if (!userId) return [];
        const ids = new Set<string>();

        const memberWhere: Record<string, unknown> = { userId, status: 'active' };
        if (organizationId) memberWhere.organizationId = organizationId;
        const memberships = await UserGroupMember.where(memberWhere);
        for (const m of memberships) {
            const gid = m.get('groupId') as string | undefined;
            if (gid) ids.add(gid);
        }

        const createdWhere: Record<string, unknown> = { createdBy: userId };
        if (organizationId) createdWhere.organizationId = organizationId;
        const created = await this.where(createdWhere);
        for (const g of created) {
            const id = g.get('id') as string | undefined;
            if (id) ids.add(id);
        }

        return Array.from(ids);
    }

    /** Members of this group (relation). */
    async members() {
        return this.hasMany(UserGroupMember, 'groupId');
    }
}

export class UserGroupMember extends BaseModel {
    static entity = 'user_group_members';
    static table = userGroupMembersTable;
    static primaryKey = 'id';
    static connection = 'default';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    static displayName = 'User Group Member';
    static displayNamePlural = 'User Group Members';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        invitedAt: 'date' as const,
        joinedAt: 'date' as const,
        metadata: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        groupId: { type: 'string', editable: true, filterable: true, uiConfig: { label: 'Group' } },
        organizationId: { type: 'string', editable: false, filterable: true, uiConfig: { label: 'Organization' } },
        userId: { type: 'string', editable: true, filterable: true, uiConfig: { label: 'User' } },
        invitedEmail: { type: 'string', editable: true, searchable: true, uiConfig: { label: 'Invited email' } },
        role: { type: 'string', editable: true, filterable: true, uiConfig: { label: 'Role' } },
        status: { type: 'string', editable: true, filterable: true, uiConfig: { label: 'Status' } },
        invitedBy: { type: 'string', editable: false, uiConfig: { label: 'Invited by' } },
        invitedAt: { type: 'date', editable: false, uiConfig: { label: 'Invited' } },
        joinedAt: { type: 'date', editable: false, uiConfig: { label: 'Joined' } },
        metadata: { type: 'json', editable: true, uiConfig: { label: 'Metadata' } },
        createdAt: { type: 'date', editable: false, sortable: true, uiConfig: { label: 'Created' } },
        updatedAt: { type: 'date', editable: false, sortable: true, uiConfig: { label: 'Updated' } },
    };

    /** Find an existing membership row for a user OR a pending email invite in a group. */
    static async findExisting(params: {
        groupId: string;
        userId?: string | null;
        invitedEmail?: string | null;
    }): Promise<UserGroupMemberType | undefined> {
        const db = this.getDriver().getDb();
        const identities = [];
        if (params.userId) identities.push(eq(userGroupMembersTable.userId, params.userId));
        if (params.invitedEmail) identities.push(eq(userGroupMembersTable.invitedEmail, params.invitedEmail));
        if (identities.length === 0) return undefined;

        const [member] = await db
            .select()
            .from(userGroupMembersTable)
            .where(and(eq(userGroupMembersTable.groupId, params.groupId), or(...identities)!))
            .limit(1);
        return member;
    }

    /** Add a member or invite. `joinedAt` is stamped only when the row starts `active`. */
    static async addMember(data: NewUserGroupMemberType): Promise<UserGroupMemberType> {
        const db = this.getDriver().getDb();
        const isActive = (data.status ?? 'invited') === 'active';
        const [member] = await db
            .insert(userGroupMembersTable)
            .values({
                ...data,
                invitedAt: data.invitedAt ?? Date.now(),
                joinedAt: isActive ? (data.joinedAt ?? Date.now()) : data.joinedAt,
            })
            .returning();
        return member;
    }

    /** All members of a group with basic user info, newest first. */
    static async getGroupMembers(groupId: string): Promise<Array<UserGroupMemberType & { user?: any }>> {
        const db = this.getDriver().getDb();
        return db
            .select({
                id: userGroupMembersTable.id,
                groupId: userGroupMembersTable.groupId,
                organizationId: userGroupMembersTable.organizationId,
                userId: userGroupMembersTable.userId,
                invitedEmail: userGroupMembersTable.invitedEmail,
                role: userGroupMembersTable.role,
                status: userGroupMembersTable.status,
                invitedBy: userGroupMembersTable.invitedBy,
                invitedAt: userGroupMembersTable.invitedAt,
                joinedAt: userGroupMembersTable.joinedAt,
                metadata: userGroupMembersTable.metadata,
                createdAt: userGroupMembersTable.createdAt,
                updatedAt: userGroupMembersTable.updatedAt,
                user: { id: usersTable.id, name: usersTable.name, email: usersTable.email, image: usersTable.image },
            })
            .from(userGroupMembersTable)
            .leftJoin(usersTable, eq(userGroupMembersTable.userId, usersTable.id))
            .where(eq(userGroupMembersTable.groupId, groupId))
            .orderBy(desc(userGroupMembersTable.createdAt));
    }

    /** Groups a user belongs to (optionally within one org). */
    static async getUserGroups(userId: string, organizationId?: string) {
        const where: Record<string, unknown> = { userId };
        if (organizationId) where.organizationId = organizationId;
        return this.where(where);
    }

    /** The user's role in a group if they are an ACTIVE member, else null. */
    static async getRole(groupId: string, userId: string): Promise<string | null> {
        const [member] = await this.where({ groupId, userId, status: 'active' });
        return member ? ((member.get('role') as string) ?? null) : null;
    }

    /** True when the user is an ACTIVE member of the group holding `role`. */
    static async hasRole(groupId: string, userId: string, role: string): Promise<boolean> {
        return (await this.getRole(groupId, userId)) === role;
    }

    /** True when the user is any ACTIVE member of the group. */
    static async isMember(groupId: string, userId: string): Promise<boolean> {
        const [member] = await this.where({ groupId, userId, status: 'active' });
        return !!member;
    }

    /**
     * Activate a user's pending email invites. When a user signs up / signs in, flip their
     * `invited` rows (matched by email and not yet linked to a user) to `active`, link the userId,
     * and stamp `joinedAt`. Returns the number of invites activated. Apps call this from their auth
     * flow (the org-level equivalent lives on OrganizationMember).
     */
    static async activatePendingInvites(userId: string, email: string): Promise<number> {
        if (!userId || !email) return 0;
        const normalizedEmail = email.trim().toLowerCase();
        const db = this.getDriver().getDb();
        const now = Date.now();
        const rows = await db
            .update(userGroupMembersTable)
            .set({
                status: 'active',
                userId,
                joinedAt: sql`COALESCE(${userGroupMembersTable.joinedAt}, ${now})`,
                updatedAt: now,
            })
            .where(
                and(
                    // Case-insensitive: invited emails may be stored with mixed case.
                    sql`lower(${userGroupMembersTable.invitedEmail}) = ${normalizedEmail}`,
                    eq(userGroupMembersTable.status, 'invited'),
                    isNull(userGroupMembersTable.userId),
                ),
            )
            .returning({ id: userGroupMembersTable.id });
        return rows.length;
    }
}

export {
    userGroupMembersTable,
    userGroupsTable,
    type NewUserGroupMemberType,
    type NewUserGroupType,
    type UserGroupMemberType,
    type UserGroupType,
};
