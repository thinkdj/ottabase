import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
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

/** Allowed values for `user_group_members.status`. */
export type UserGroupMemberStatus = 'invited' | 'active' | 'declined' | 'removed';
export const USER_GROUP_MEMBER_STATUSES: ReadonlyArray<UserGroupMemberStatus> = [
    'invited',
    'active',
    'declined',
    'removed',
] as const;

/** Allowed values for `user_group_members.role`. */
export type UserGroupMemberRole = 'admin' | 'member';
export const USER_GROUP_MEMBER_ROLES: ReadonlyArray<UserGroupMemberRole> = ['admin', 'member'] as const;

/** Normalize an email for storage / comparison (lowercase + trim). */
export function normalizeGroupInviteEmail(email: string | null | undefined): string | null {
    if (!email) return null;
    const trimmed = email.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
}

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
        name: { rules: 'required|min:1|max:120', fieldName: 'Name' },
        slug: { rules: 'required|min:1|max:120', fieldName: 'Slug' },
        organizationId: { rules: 'required', fieldName: 'Organization' },
    };

    /** List all groups in an organization (optionally scoped to an app), ordered by name. */
    static async forOrganization(organizationId: string, options?: { appId?: string | null }) {
        const where: Record<string, unknown> = { organizationId };
        if (options?.appId !== undefined) where.appId = options.appId;
        return this.where(where, { orderBy: 'name', orderDirection: 'asc' });
    }

    /** Find a group by slug within an organization (and optional app scope). */
    static async findBySlug(organizationId: string, slug: string, options?: { appId?: string | null }) {
        const where: Record<string, unknown> = { organizationId, slug };
        if (options?.appId !== undefined) where.appId = options.appId;
        return (await this.first(where)) ?? null;
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

    /**
     * Find an existing membership in a group, identified by either `userId` or a normalized
     * `invitedEmail`. Returns the raw row (or undefined).
     */
    static async findExisting(params: {
        groupId: string;
        userId?: string | null;
        invitedEmail?: string | null;
    }): Promise<UserGroupMemberType | undefined> {
        const db = this.getDriver().getDb();

        if (params.userId) {
            const [byUser] = await db
                .select()
                .from(userGroupMembersTable)
                .where(
                    and(
                        eq(userGroupMembersTable.groupId, params.groupId),
                        eq(userGroupMembersTable.userId, params.userId),
                    ),
                )
                .limit(1);
            if (byUser) return byUser;
        }

        const normalizedEmail = normalizeGroupInviteEmail(params.invitedEmail);
        if (normalizedEmail) {
            const [byEmail] = await db
                .select()
                .from(userGroupMembersTable)
                .where(
                    and(
                        eq(userGroupMembersTable.groupId, params.groupId),
                        eq(userGroupMembersTable.invitedEmail, normalizedEmail),
                    ),
                )
                .limit(1);
            if (byEmail) return byEmail;
        }

        return undefined;
    }

    /**
     * Securely add a member to a group. Server-derived fields (`status`, `joinedAt`, `invitedAt`)
     * are computed here — callers cannot spoof them. `invitedEmail` is normalized.
     *
     * @returns the new (or pre-existing) membership row.
     */
    static async addMember(data: NewUserGroupMemberType): Promise<UserGroupMemberType> {
        const db = this.getDriver().getDb();
        const now = Date.now();

        const normalizedEmail = normalizeGroupInviteEmail(data.invitedEmail ?? null);
        const userId = data.userId ?? null;

        if (!userId && !normalizedEmail) {
            throw new Error('addMember requires either userId or invitedEmail');
        }

        // Idempotency: if the member already exists, return it instead of erroring on the unique index.
        const existing = await this.findExisting({
            groupId: data.groupId!,
            userId,
            invitedEmail: normalizedEmail,
        });
        if (existing) return existing;

        const status: UserGroupMemberStatus = userId ? 'active' : 'invited';
        const role: UserGroupMemberRole = USER_GROUP_MEMBER_ROLES.includes(data.role as UserGroupMemberRole)
            ? (data.role as UserGroupMemberRole)
            : 'member';

        const [member] = await db
            .insert(userGroupMembersTable)
            .values({
                ...data,
                userId,
                invitedEmail: normalizedEmail,
                role,
                status,
                invitedAt: data.invitedAt ?? now,
                joinedAt: userId ? (data.joinedAt ?? now) : null,
            })
            .returning();
        return member!;
    }

    /**
     * List all members of a group, joined with user info (when registered).
     * Pending invites (no `userId`) return with `user` = null.
     */
    static async getGroupMembers(groupId: string): Promise<
        Array<
            UserGroupMemberType & {
                user: { id: string; name: string | null; email: string; image: string | null } | null;
            }
        >
    > {
        const db = this.getDriver().getDb();
        const rows = await db
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

        return rows.map((row: any) => ({
            ...row,
            user: row.user?.id ? row.user : null,
        })) as any;
    }

    /** List all groups a user belongs to (optionally scoped to an organization). */
    static async getUserGroups(userId: string, organizationId?: string) {
        const where: Record<string, unknown> = { userId, status: 'active' };
        if (organizationId) where.organizationId = organizationId;
        return this.where(where);
    }

    /**
     * Claim any pending email-invite memberships for the given user.
     *
     * Called on user signup / first OAuth sign-in. Rows with a matching (lowercased) `invitedEmail`
     * and a NULL `userId` are atomically updated to bind them to the new user and flipped to
     * status='active'. Rows where the user is already a member of the group are skipped to
     * avoid violating the `(group_id, user_id)` unique index.
     *
     * Idempotent and safe to call on every sign-in.
     *
     * @returns the number of pending invites that were claimed.
     */
    static async claimPendingInvitesForEmail(email: string, userId: string): Promise<number> {
        const normalizedEmail = normalizeGroupInviteEmail(email);
        if (!normalizedEmail || !userId) return 0;

        const db = this.getDriver().getDb();

        // Find pending invites for this email
        const pending = await db
            .select({ id: userGroupMembersTable.id, groupId: userGroupMembersTable.groupId })
            .from(userGroupMembersTable)
            .where(and(eq(userGroupMembersTable.invitedEmail, normalizedEmail), isNull(userGroupMembersTable.userId)));

        if (pending.length === 0) return 0;

        // Pre-fetch existing memberships for this user across the candidate groups so we can
        // skip rows that would violate the (group_id, user_id) unique index.
        const groupIds = pending.map((p: { id: string; groupId: string }) => p.groupId);
        const existingMemberships = await db
            .select({ groupId: userGroupMembersTable.groupId })
            .from(userGroupMembersTable)
            .where(
                and(
                    eq(userGroupMembersTable.userId, userId),
                    // Drizzle `inArray` builds a properly parameterized IN clause — no
                    // hand-rolled SQL string interpolation.
                    inArray(userGroupMembersTable.groupId, groupIds),
                ),
            );
        const alreadyMemberOf = new Set(existingMemberships.map((row: { groupId: string }) => row.groupId));

        const now = Date.now();
        let claimed = 0;
        for (const row of pending) {
            if (alreadyMemberOf.has(row.groupId)) {
                // The user is already a registered member of this group via another path —
                // leave the pending invite alone (admins can clean it up). Do not throw.
                continue;
            }
            try {
                const result = await db
                    .update(userGroupMembersTable)
                    .set({
                        userId,
                        status: 'active',
                        joinedAt: now,
                        // Clear the invited email so subsequent invites with the same address
                        // can be created. The audit trail is preserved via createdAt/invitedAt.
                        invitedEmail: null,
                        updatedAt: now,
                    })
                    .where(
                        and(
                            eq(userGroupMembersTable.id, row.id),
                            // Re-check the row is still pending — protects against races.
                            isNull(userGroupMembersTable.userId),
                            eq(userGroupMembersTable.invitedEmail, normalizedEmail),
                        ),
                    )
                    .returning({ id: userGroupMembersTable.id });
                if (result.length > 0) claimed += 1;
            } catch (error) {
                // A unique-constraint race may still occur if another path inserted a
                // (group_id, user_id) row between our pre-check and the UPDATE. Log full
                // context (including stack) and continue.
                console.warn('[UserGroupMember.claimPendingInvitesForEmail] skipped row due to conflict', {
                    userId,
                    email: normalizedEmail,
                    rowId: row.id,
                    groupId: row.groupId,
                    error,
                });
            }
        }

        return claimed;
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
