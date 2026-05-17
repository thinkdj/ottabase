import { and, desc, eq, or } from 'drizzle-orm';
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

export class UserGroup extends BaseModel {
    static entity = 'user_groups';
    static table = userGroupsTable;
    static primaryKey = 'id';
    static connection = 'default';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

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
        organizationId: { type: 'string', editable: true, filterable: true, uiConfig: { label: 'Organization' } },
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

    static async forOrganization(organizationId: string, options?: { appId?: string | null }) {
        const where: Record<string, unknown> = { organizationId };
        if (options?.appId !== undefined) where.appId = options.appId;
        return this.where(where, { orderBy: 'name', orderDirection: 'asc' });
    }

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
        organizationId: { type: 'string', editable: true, filterable: true, uiConfig: { label: 'Organization' } },
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

    static async findExisting(params: { groupId: string; userId?: string | null; invitedEmail?: string | null }) {
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

    static async addMember(data: NewUserGroupMemberType): Promise<UserGroupMemberType> {
        const db = this.getDriver().getDb();
        const [member] = await db
            .insert(userGroupMembersTable)
            .values({
                ...data,
                invitedAt: data.invitedAt ?? Date.now(),
                joinedAt: data.status === 'active' ? (data.joinedAt ?? Date.now()) : data.joinedAt,
            })
            .returning();
        return member;
    }

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
                user: {
                    id: usersTable.id,
                    name: usersTable.name,
                    email: usersTable.email,
                    image: usersTable.image,
                },
            })
            .from(userGroupMembersTable)
            .leftJoin(usersTable, eq(userGroupMembersTable.userId, usersTable.id))
            .where(eq(userGroupMembersTable.groupId, groupId))
            .orderBy(desc(userGroupMembersTable.createdAt));
    }

    static async getUserGroups(userId: string, organizationId?: string) {
        const where: Record<string, unknown> = { userId };
        if (organizationId) where.organizationId = organizationId;
        return this.where(where);
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
