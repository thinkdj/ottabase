// ============================================================
// @ottabase/ottaorm - OrganizationMember model
// ============================================================

import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { BaseModel, type ModelFields, type PackageType } from '../base/BaseModel';
import { organizationsTable } from './Organization.schema';
import {
    organizationMembersTable,
    type NewOrganizationMemberType,
    type OrganizationMemberType,
} from './OrganizationMember.schema';
import { usersTable } from './User.schema';

/**
 * OrganizationMember model
 * Manages user membership in organizations
 */
export class OrganizationMember extends BaseModel {
    static entity = 'organization_members';
    static table = organizationMembersTable;
    static primaryKey = 'id';
    static connection = 'default';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    // UI/Forms metadata
    static displayName = 'Organization Member';
    static displayNamePlural = 'Organization Members';
    static defaultSort = 'joinedAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        joinedAt: 'date' as const,
        invitedAt: 'date' as const,
        metadata: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
            },
            tableConfig: {
                visible: true,
            },
        },
        userId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'User ID',
            },
            tableConfig: {
                visible: true,
            },
        },
        invitedEmail: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Invited Email',
            },
            tableConfig: {
                visible: true,
            },
        },
        organizationId: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Organization ID',
            },
            tableConfig: {
                visible: true,
            },
        },
        role: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Role',
                description: 'Member role in organization',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [
                    { id: 'owner', name: 'Owner' },
                    { id: 'admin', name: 'Admin' },
                    { id: 'member', name: 'Member' },
                ],
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required|in:owner,admin,member',
                messages: {
                    required: 'Role is required',
                    in: 'Invalid role',
                },
            },
        },
        status: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Status',
                description: 'Membership status',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [
                    { id: 'active', name: 'Active' },
                    { id: 'invited', name: 'Invited' },
                    { id: 'suspended', name: 'Suspended' },
                ],
            },
            tableConfig: {
                visible: true,
            },
        },
        invitedBy: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Invited By',
            },
            tableConfig: {
                visible: false,
            },
        },
        invitedAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Invited At',
            },
            tableConfig: {
                visible: false,
            },
        },
        joinedAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Joined At',
            },
            tableConfig: {
                visible: true,
            },
        },
        metadata: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Metadata',
            },
            tableConfig: {
                visible: false,
            },
        },
    };

    /**
     * Add a user to an organization
     */
    static async addMember(data: NewOrganizationMemberType): Promise<OrganizationMemberType> {
        const db = this.getDriver().getDb();

        const [member] = await db
            .insert(organizationMembersTable)
            .values({
                ...data,
                invitedAt: data.invitedAt ?? Date.now(),
                // Stamp joinedAt only when the row starts active; invites get it on activation.
                joinedAt: (data.status ?? 'active') === 'active' ? (data.joinedAt ?? Date.now()) : data.joinedAt,
            })
            .returning();

        return member;
    }

    /**
     * Find an existing membership row for a user OR a pending email invite in an organization.
     * Use before adding to avoid duplicate invites/memberships.
     */
    static async findExistingInvite(params: {
        organizationId: string;
        userId?: string | null;
        invitedEmail?: string | null;
    }): Promise<OrganizationMemberType | undefined> {
        const db = this.getDriver().getDb();
        const identities = [];
        if (params.userId) identities.push(eq(organizationMembersTable.userId, params.userId));
        if (params.invitedEmail) identities.push(eq(organizationMembersTable.invitedEmail, params.invitedEmail));
        if (identities.length === 0) return undefined;

        const [member] = await db
            .select()
            .from(organizationMembersTable)
            .where(and(eq(organizationMembersTable.organizationId, params.organizationId), or(...identities)!))
            .limit(1);
        return member;
    }

    /**
     * Activate a user's pending email invites: when a user signs up / signs in, flip their
     * `invited` org rows (matched by email and not yet linked to a user) to `active`, link the
     * userId, and stamp `joinedAt`. Returns the number activated. Call from your auth flow — the
     * group-level equivalent lives on `UserGroupMember`.
     */
    static async activatePendingInvites(userId: string, email: string): Promise<number> {
        if (!userId || !email) return 0;
        const normalizedEmail = email.trim().toLowerCase();
        const db = this.getDriver().getDb();
        const now = Date.now();
        const rows = await db
            .update(organizationMembersTable)
            .set({
                status: 'active',
                userId,
                joinedAt: sql`COALESCE(${organizationMembersTable.joinedAt}, ${now})`,
                updatedAt: now,
            })
            .where(
                and(
                    // Case-insensitive: invited emails may be stored with mixed case.
                    sql`lower(${organizationMembersTable.invitedEmail}) = ${normalizedEmail}`,
                    eq(organizationMembersTable.status, 'invited'),
                    isNull(organizationMembersTable.userId),
                ),
            )
            .returning({ id: organizationMembersTable.id });
        return rows.length;
    }

    /**
     * Remove a user from an organization
     */
    static async removeMember(userId: string, organizationId: string): Promise<boolean> {
        const db = this.getDriver().getDb();

        await db
            .delete(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                ),
            );

        const [remaining] = await db
            .select({ count: sql<number>`count(*)` })
            .from(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                ),
            );

        return Number(remaining?.count ?? 0) === 0;
    }

    /**
     * Update member role in organization
     */
    static async updateRole(
        userId: string,
        organizationId: string,
        role: 'owner' | 'admin' | 'member',
    ): Promise<OrganizationMemberType | undefined> {
        const db = this.getDriver().getDb();

        const [updated] = await db
            .update(organizationMembersTable)
            .set({ role })
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                ),
            )
            .returning();

        return updated;
    }

    /**
     * Update member status
     */
    static async updateStatus(
        userId: string,
        organizationId: string,
        status: 'active' | 'invited' | 'suspended',
    ): Promise<OrganizationMemberType | undefined> {
        const db = this.getDriver().getDb();

        const [updated] = await db
            .update(organizationMembersTable)
            .set({ status })
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                ),
            )
            .returning();

        return updated;
    }

    /**
     * Get all members of an organization
     */
    static async getOrganizationMembers(
        organizationId: string,
        options?: {
            status?: 'active' | 'invited' | 'suspended';
            role?: 'owner' | 'admin' | 'member';
            limit?: number;
            /** Zero-based row offset for pagination */
            offset?: number;
        },
    ): Promise<Array<OrganizationMemberType & { user?: any }>> {
        const db = this.getDriver().getDb();

        let conditions = [eq(organizationMembersTable.organizationId, organizationId)];

        if (options?.status) {
            conditions.push(eq(organizationMembersTable.status, options.status));
        }

        if (options?.role) {
            conditions.push(eq(organizationMembersTable.role, options.role));
        }

        let query = db
            .select({
                id: organizationMembersTable.id,
                userId: organizationMembersTable.userId,
                invitedEmail: organizationMembersTable.invitedEmail,
                organizationId: organizationMembersTable.organizationId,
                role: organizationMembersTable.role,
                status: organizationMembersTable.status,
                invitedBy: organizationMembersTable.invitedBy,
                invitedAt: organizationMembersTable.invitedAt,
                joinedAt: organizationMembersTable.joinedAt,
                metadata: organizationMembersTable.metadata,
                createdAt: organizationMembersTable.createdAt,
                updatedAt: organizationMembersTable.updatedAt,
                user: {
                    id: usersTable.id,
                    name: usersTable.name,
                    email: usersTable.email,
                    image: usersTable.image,
                },
            })
            .from(organizationMembersTable)
            .leftJoin(usersTable, eq(organizationMembersTable.userId, usersTable.id))
            .where(and(...conditions))
            .orderBy(desc(organizationMembersTable.joinedAt), desc(organizationMembersTable.userId));

        if (options?.limit) {
            query = query.limit(options.limit) as any;
        }

        if (options?.offset !== undefined) {
            query = query.offset(options.offset) as any;
        }

        return query;
    }

    /**
     * Count all members of an organization (for pagination totals).
     * Supports the same status/role filters as getOrganizationMembers.
     */
    static async countOrganizationMembers(
        organizationId: string,
        options?: {
            status?: 'active' | 'invited' | 'suspended';
            role?: 'owner' | 'admin' | 'member';
        },
    ): Promise<number> {
        const db = this.getDriver().getDb();

        const conditions = [eq(organizationMembersTable.organizationId, organizationId)];

        if (options?.status) {
            conditions.push(eq(organizationMembersTable.status, options.status));
        }

        if (options?.role) {
            conditions.push(eq(organizationMembersTable.role, options.role));
        }

        const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(organizationMembersTable)
            .where(and(...conditions));

        return Number(result?.count ?? 0);
    }

    /**
     * Count active owners in an organization.
     */
    static async countActiveOwners(organizationId: string): Promise<number> {
        return this.countOrganizationMembers(organizationId, {
            role: 'owner',
            status: 'active',
        });
    }

    /**
     * True when the target member is the only active owner in the organization.
     */
    static async isLastActiveOwner(userId: string, organizationId: string): Promise<boolean> {
        const [isOwner, ownerCount] = await Promise.all([
            this.hasRole(userId, organizationId, 'owner'),
            this.countActiveOwners(organizationId),
        ]);

        return isOwner && ownerCount <= 1;
    }

    /**
     * Get all organizations for a user
     */
    static async getUserOrganizations(
        userId: string,
        options?: {
            status?: 'active' | 'invited' | 'suspended';
            role?: 'owner' | 'admin' | 'member';
        },
    ): Promise<Array<OrganizationMemberType & { organization?: any }>> {
        const db = this.getDriver().getDb();

        let conditions = [eq(organizationMembersTable.userId, userId)];

        if (options?.status) {
            conditions.push(eq(organizationMembersTable.status, options.status));
        }

        if (options?.role) {
            conditions.push(eq(organizationMembersTable.role, options.role));
        }

        return db
            .select({
                id: organizationMembersTable.id,
                userId: organizationMembersTable.userId,
                invitedEmail: organizationMembersTable.invitedEmail,
                organizationId: organizationMembersTable.organizationId,
                role: organizationMembersTable.role,
                status: organizationMembersTable.status,
                invitedBy: organizationMembersTable.invitedBy,
                invitedAt: organizationMembersTable.invitedAt,
                joinedAt: organizationMembersTable.joinedAt,
                metadata: organizationMembersTable.metadata,
                createdAt: organizationMembersTable.createdAt,
                updatedAt: organizationMembersTable.updatedAt,
                organization: {
                    id: organizationsTable.id,
                    name: organizationsTable.name,
                    slug: organizationsTable.slug,
                    plan: organizationsTable.plan,
                    status: organizationsTable.status,
                },
            })
            .from(organizationMembersTable)
            .leftJoin(organizationsTable, eq(organizationMembersTable.organizationId, organizationsTable.id))
            .where(and(...conditions));
    }

    /**
     * Check if user is member of organization
     */
    static async isMember(userId: string, organizationId: string): Promise<boolean> {
        const db = this.getDriver().getDb();

        const [member] = await db
            .select()
            .from(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                    eq(organizationMembersTable.status, 'active'),
                ),
            )
            .limit(1);

        return !!member;
    }

    /**
     * All organization IDs a user can access, from ACTIVE MEMBERSHIPS only. This is the
     * authoritative "accessible orgs" set — use it to validate a user's active org and to populate
     * `SecurityContext.memberOrganizationIds` (the tenant-isolation boundary).
     *
     * Deliberately does NOT union `Organization.ownerId`: that field is stamped once at creation and
     * never cleared on removal/demotion (there is no ownership-transfer code), so unioning it would
     * let a user who was removed from an org they created retain access to it — a stale-ownership
     * cross-tenant leak. The org creator is always also given an ACTIVE owner membership row (see
     * user-provisioning / bootstrap), so active membership already covers every legitimate owner.
     */
    static async organizationIdsForUser(userId: string): Promise<string[]> {
        if (!userId) return [];
        const ids = new Set<string>();

        const memberships = await this.where({ userId, status: 'active' });
        for (const m of memberships) {
            const orgId = m.get('organizationId') as string | undefined;
            if (orgId) ids.add(orgId);
        }

        return Array.from(ids);
    }

    /**
     * Check if user has specific role in organization
     */
    static async hasRole(userId: string, organizationId: string, role: 'owner' | 'admin' | 'member'): Promise<boolean> {
        const db = this.getDriver().getDb();

        const [member] = await db
            .select()
            .from(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                    eq(organizationMembersTable.role, role),
                    eq(organizationMembersTable.status, 'active'),
                ),
            )
            .limit(1);

        return !!member;
    }

    /**
     * Check if user is owner or admin
     */
    static async isOwnerOrAdmin(userId: string, organizationId: string): Promise<boolean> {
        const db = this.getDriver().getDb();

        const [member] = await db
            .select()
            .from(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                    eq(organizationMembersTable.status, 'active'),
                    sql`${organizationMembersTable.role} IN ('owner', 'admin')`,
                ),
            )
            .limit(1);

        return !!member;
    }

    /**
     * Get member details
     */
    static async getMember(userId: string, organizationId: string): Promise<OrganizationMemberType | undefined> {
        const db = this.getDriver().getDb();

        const [member] = await db
            .select()
            .from(organizationMembersTable)
            .where(
                and(
                    eq(organizationMembersTable.userId, userId),
                    eq(organizationMembersTable.organizationId, organizationId),
                ),
            )
            .limit(1);

        return member;
    }
}

export { organizationMembersTable, type NewOrganizationMemberType, type OrganizationMemberType };
